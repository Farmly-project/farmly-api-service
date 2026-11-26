import { supabaseAdmin } from "../config/supabaseClient";
import {
  CreateStaffAccountDTO,
  DateRangeQueryParams,
  NotificationQueryParams,
  StaffAccountQueryParams,
} from "../types/dashboardTypes";
import { AppError } from "../utils/appError";

export class DashboardRepository {
  // ============================================================================
  // 1. TRUY VẤN DỮ LIỆU THỐNG KÊ DOANH THU, ĐƠN HÀNG & HAO HỤT (UC08)
  // ============================================================================
  async fetchOrdersInRange(startIso: string, endIso: string) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id, order_number, order_type, status, total_amount, shipping_fee,
        delivered_at, created_at,
        items:order_items(product_id, product_name, quantity, unit_price)
      `,
      )
      .gte("created_at", startIso)
      .lte("created_at", endIso);

    if (error) {
      throw new AppError(
        "Lỗi truy vấn thống kê đơn hàng: " + error.message,
        500,
      );
    }
    return data || [];
  }

  async fetchPaidSubscriptionsInRange(startIso: string, endIso: string) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("id, subscription_id, amount, paid_at, created_at")
      .eq("payment_type", "subscription_payment")
      .eq("status", "paid")
      .gte("paid_at", startIso)
      .lte("paid_at", endIso);

    if (error) {
      throw new AppError(
        "Lỗi truy vấn doanh thu gói định kỳ: " + error.message,
        500,
      );
    }
    return data || [];
  }

  async fetchRefundedPaymentsInRange(startIso: string, endIso: string) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("id, order_id, amount, paid_at, created_at")
      .eq("payment_type", "refund")
      .eq("status", "refunded")
      .gte("created_at", startIso)
      .lte("created_at", endIso);

    if (error) {
      throw new AppError(
        "Lỗi truy vấn dữ liệu hoàn tiền: " + error.message,
        500,
      );
    }
    return data || [];
  }

  async countActiveSubscriptions(): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    if (error) return 0;
    return count || 0;
  }

  async fetchBatchesAndDisposals(
    startDate: string,
    endDate: string,
    filters: DateRangeQueryParams,
  ) {
    let query = supabaseAdmin
      .from("batches")
      .select(
        `
        id, batch_code, product_id, sowing_date, harvest_date, exp_date,
        initial_quantity, current_quantity, disposed_quantity, status, created_at,
        product:products!inner(id, name, unit, category_id),
        disposals:inventory_disposals(
          id, quantity_disposed, reason, note, image_url, created_at,
          staff:profiles!disposed_by(id, full_name)
        )
      `,
      )
      .gte("created_at", `${startDate}T00:00:00.000Z`)
      .lte("created_at", `${endDate}T23:59:59.999Z`)
      .order("created_at", { ascending: false });

    if (filters.product_id) {
      query = query.eq("product_id", filters.product_id);
    }
    if (filters.category_id) {
      query = query.eq("products.category_id", filters.category_id);
    }

    const { data, error } = await query;
    if (error) {
      throw new AppError(
        "Lỗi truy vấn báo cáo xuất hủy theo lô: " + error.message,
        500,
      );
    }
    return data || [];
  }

  // ============================================================================
  // 2. QUẢN LÝ THÔNG BÁO (NOTIFICATIONS - STT 67)
  // ============================================================================
  async findUserNotifications(userId: string, params: NotificationQueryParams) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 && params.limit <= 50
        ? params.limit
        : 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Đếm số thông báo chưa đọc bằng partial index idx_notifications_unread
    const { count: unreadCount } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    let query = supabaseAdmin
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (params.unread_only) {
      query = query.is("read_at", null);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      throw new AppError("Lỗi tải danh sách thông báo: " + error.message, 500);
    }

    return {
      unread_count: unreadCount || 0,
      items: data || [],
      pagination: {
        page,
        limit,
        total_items: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async markNotificationAsRead(notificationId: number, userId: string) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(
        "Không tìm thấy thông báo hoặc không có quyền thao tác",
        404,
      );
    }
    return data;
  }

  async markAllNotificationsAsRead(userId: string) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null)
      .select("id");

    if (error) {
      throw new AppError(
        "Lỗi cập nhật trạng thái đã đọc thông báo: " + error.message,
        500,
      );
    }
    return (data || []).length;
  }

  // ============================================================================
  // 3. QUẢN TRỊ TÀI KHOẢN NHÂN SỰ (ACCOUNTS - UC27, STT 68-70)
  // ============================================================================
  async findStaffAccounts(params: StaffAccountQueryParams) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 && params.limit <= 50
        ? params.limit
        : 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from("profiles")
      .select(
        "id, email, full_name, phone, avatar_url, role, created_at, updated_at, deleted_at",
        {
          count: "exact",
        },
      )
      .in("role", ["farm_staff", "sales"])
      .order("created_at", { ascending: false });

    if (params.role) {
      query = query.eq("role", params.role);
    }

    if (params.status === "active") {
      query = query.is("deleted_at", null);
    } else if (params.status === "locked") {
      query = query.not("deleted_at", "is", null);
    }

    if (params.search) {
      query = query.or(
        `full_name.ilike.%${params.search}%,email.ilike.%${params.search}%,phone.ilike.%${params.search}%`,
      );
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      throw new AppError(
        "Lỗi tải danh sách tài khoản nhân viên: " + error.message,
        500,
      );
    }

    const items = (data || []).map((acc: any) => ({
      ...acc,
      is_active: acc.deleted_at === null,
    }));

    return {
      items,
      pagination: {
        page,
        limit,
        total_items: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async createStaffAccount(payload: CreateStaffAccountDTO) {
    // 1. Tạo tài khoản qua Supabase Auth Admin API (Trigger on_auth_user_created tự tạo profile)
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: payload.email.toLowerCase().trim(),
        password: payload.password,
        email_confirm: true,
        user_metadata: {
          full_name: payload.full_name.trim(),
          role: payload.role,
        },
      });

    if (authError || !authData.user) {
      throw new AppError(
        `Không thể khởi tạo tài khoản nhân viên: ${authError?.message || "Email đã tồn tại"}`,
        400,
      );
    }

    // 2. Đồng bộ số điện thoại và vai trò chính xác trên bảng profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authData.user.id,
        email: payload.email.toLowerCase().trim(),
        full_name: payload.full_name.trim(),
        phone: payload.phone || null,
        role: payload.role,
        deleted_at: null,
      })
      .select(
        "id, email, full_name, phone, avatar_url, role, created_at, deleted_at",
      )
      .single();

    if (profileError || !profile) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new AppError("Lỗi đồng bộ hồ sơ nhân viên trong CSDL", 500);
    }

    return {
      ...profile,
      is_active: true,
    };
  }

  async findProfileById(userId: string) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, phone, role, deleted_at")
      .eq("id", userId)
      .single();

    return data || null;
  }

  async updateStaffLockStatus(userId: string, isActive: boolean) {
    // Khóa/mở khóa phiên đăng nhập trên Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        ban_duration: isActive ? "none" : "876000h",
      },
    );

    if (authError) {
      throw new AppError(
        "Không thể cập nhật trạng thái khóa trên Auth: " + authError.message,
        500,
      );
    }

    // Cập nhật trạng thái trên bảng profiles
    const { data: updated, error: dbError } = await supabaseAdmin
      .from("profiles")
      .update({
        deleted_at: isActive ? null : new Date().toISOString(),
      })
      .eq("id", userId)
      .select(
        "id, email, full_name, phone, avatar_url, role, created_at, updated_at, deleted_at",
      )
      .single();

    if (dbError || !updated) {
      throw new AppError(
        "Lỗi cập nhật trạng thái hồ sơ nhân viên: " + (dbError?.message || ""),
        500,
      );
    }

    return {
      ...updated,
      is_active: updated.deleted_at === null,
    };
  }

  // ============================================================================
  // 4. CẤU HÌNH THAM SỐ HỆ THỐNG (SETTINGS - UC24, STT 71)
  // ============================================================================
  async getAllSettings(): Promise<Record<string, string>> {
    const { data, error } = await supabaseAdmin
      .from("settings")
      .select("key, value, updated_at");
    if (error) {
      throw new AppError("Lỗi đọc cấu hình hệ thống: " + error.message, 500);
    }

    const result: Record<string, string> = {};
    for (const row of data || []) {
      result[row.key] = row.value;
    }
    return result;
  }

  async upsertSettings(entries: Array<{ key: string; value: string }>) {
    const rows = entries.map((e) => ({
      key: e.key,
      value: e.value,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from("settings")
      .upsert(rows, { onConflict: "key" });
    if (error) {
      throw new AppError(
        "Cập nhật tham số hệ thống thất bại: " + error.message,
        400,
      );
    }

    return await this.getAllSettings();
  }

  // ============================================================================
  // 5. TRUY VẤN CHO CRONJOB QUÉT LÔ SẮP HẾT HẠN 06:00 (UC05 & UC19)
  // ============================================================================
  async findBatchesExpiringOnOrBefore(thresholdDate: string) {
    // Sử dụng Partial Index idx_batches_exp_date (exp_date) WHERE status = 'in_stock'
    const { data, error } = await supabaseAdmin
      .from("batches")
      .select(
        `
        id, batch_code, product_id, exp_date, current_quantity, flash_sale_price, status,
        product:products(id, name, unit, base_price)
      `,
      )
      .eq("status", "in_stock")
      .gt("current_quantity", 0)
      .lte("exp_date", thresholdDate)
      .order("exp_date", { ascending: true });

    if (error) {
      throw new AppError("Lỗi quét lô hàng sắp hết hạn: " + error.message, 500);
    }
    return data || [];
  }

  async findTodayNotificationBodiesByTypes(
    types: string[],
    todayStartIso: string,
  ) {
    const { data } = await supabaseAdmin
      .from("notifications")
      .select("user_id, type, body")
      .in("type", types)
      .gte("created_at", todayStartIso);

    return data || [];
  }

  async findStaffIdsByRoles(roles: string[]): Promise<string[]> {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("role", roles)
      .is("deleted_at", null);

    return (data || []).map((u: any) => u.id);
  }

  async createNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    level: "info" | "warning" | "danger" = "info",
  ) {
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type,
      title,
      body,
      level,
    });
  }

  async writeActivityLog(
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string | number,
    oldData: any,
    newData: any,
  ) {
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      old_data: oldData,
      new_data: newData,
    });
  }
}
