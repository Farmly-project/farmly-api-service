import { supabaseAdmin } from "../config/supabaseClient";
import { SubscriptionQueryParams } from "../types/subscriptionTypes";
import { AppError } from "../utils/appError";

export class SubscriptionRepository {
  // ============================================================================
  // 1. KIỂM TRA SẢN PHẨM & DANH MỤC CHO PHÉP ĐẶT ĐỊNH KỲ (UC02)
  // ============================================================================
  async getEligibleProductsForSubscription(productIds: number[]) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(
        `
        id, name, unit, base_price, is_active, deleted_at,
        category:categories(id, name, allow_subscription, is_active, deleted_at)
      `,
      )
      .in("id", productIds);

    if (error) {
      throw new AppError(
        "Lỗi truy vấn thông tin sản phẩm định kỳ: " + error.message,
        500,
      );
    }

    return data || [];
  }

  async findAddressById(addressId: number, userId: string) {
    const { data } = await supabaseAdmin
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    return data || null;
  }

  // ============================================================================
  // 2. KHỞI TẠO & TRUY VẤN GÓI ĐỊNH KỲ (SUBSCRIPTIONS)
  // ============================================================================
  async createSubscriptionBundle(
    subPayload: Record<string, any>,
    itemsPayload: Array<{
      product_id: number;
      quantity: number;
      unit_price: number;
    }>,
    deliveryDates: string[],
  ) {
    // 1. Tạo bản ghi chính trong bảng subscriptions (trạng thái pending_payment)
    const { data: sub, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .insert(subPayload)
      .select("*")
      .single();

    if (subError || !sub) {
      throw new AppError(
        "Không thể tạo gói định kỳ: " + (subError?.message || ""),
        400,
      );
    }

    // 2. Lưu danh sách sản phẩm cố định trong gói (subscription_items - chốt giá tại thời điểm mua)
    const itemRows = itemsPayload.map((item) => ({
      subscription_id: sub.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("subscription_items")
      .insert(itemRows);
    if (itemsError) {
      await supabaseAdmin.from("subscriptions").delete().eq("id", sub.id);
      throw new AppError(
        "Lỗi lưu danh sách sản phẩm trong gói: " + itemsError.message,
        400,
      );
    }

    // 3. Sinh từng dòng lịch giao hàng trong bảng delivery_schedules (chuẩn 1NF)
    const scheduleRows = deliveryDates.map((dateStr) => ({
      subscription_id: sub.id,
      delivery_date: dateStr,
      status: "pending",
    }));

    const { error: scheduleError } = await supabaseAdmin
      .from("delivery_schedules")
      .insert(scheduleRows);

    if (scheduleError) {
      await supabaseAdmin.from("subscriptions").delete().eq("id", sub.id);
      throw new AppError(
        "Lỗi tạo lịch giao hàng định kỳ: " + scheduleError.message,
        400,
      );
    }

    // 4. Khởi tạo bản ghi thanh toán pending trong bảng payments (ràng buộc chk_payment_target)
    const { error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        subscription_id: sub.id,
        payment_method: "payos",
        payment_type: "subscription_payment",
        amount: sub.total_amount,
        status: "pending",
      });

    if (paymentError) {
      await supabaseAdmin.from("subscriptions").delete().eq("id", sub.id);
      throw new AppError(
        "Lỗi khởi tạo thanh toán cho gói định kỳ: " + paymentError.message,
        400,
      );
    }

    return await this.findSubscriptionById(sub.id);
  }

  async findSubscriptionsByCustomer(
    customerId: string,
    params: SubscriptionQueryParams,
  ) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 && params.limit <= 50
        ? params.limit
        : 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from("subscriptions")
      .select(
        `
        *,
        items:subscription_items(
          id, product_id, quantity, unit_price,
          product:products(id, name, unit)
        ),
        schedules:delivery_schedules(id, delivery_date, status, order_id),
        payments(id, payment_method, status, amount, paid_at)
      `,
        { count: "exact" },
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (params.status) {
      query = query.eq("status", params.status);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      throw new AppError(
        "Lỗi tải danh sách gói định kỳ: " + error.message,
        500,
      );
    }

    const items = (data || []).map((sub: any) => {
      const sortedSchedules = (sub.schedules || []).sort((a: any, b: any) =>
        a.delivery_date.localeCompare(b.delivery_date),
      );
      const totalDeliveries = sortedSchedules.length;
      const deliveredOrGenerated = sortedSchedules.filter(
        (s: any) => s.status === "generated",
      ).length;
      const remainingDeliveries = sortedSchedules.filter(
        (s: any) => s.status === "pending",
      ).length;

      return {
        ...sub,
        schedules: sortedSchedules,
        progress: {
          total_deliveries: totalDeliveries,
          generated_deliveries: deliveredOrGenerated,
          remaining_deliveries: remainingDeliveries,
        },
      };
    });

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

  async findSubscriptionById(id: number) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select(
        `
        *,
        customer:profiles!customer_id(id, full_name, email, phone),
        items:subscription_items(
          id, product_id, quantity, unit_price,
          product:products(
            id, name, unit,
            images:product_images(image_url, is_primary, deleted_at)
          )
        ),
        schedules:delivery_schedules(
          id, delivery_date, status, order_id, created_at,
          order:orders(id, order_number, status, delivered_at)
        ),
        payments(id, payment_method, payment_type, transaction_id, payos_order_code, amount, status, paid_at)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data) return null;

    const sortedSchedules = (data.schedules || []).sort((a: any, b: any) =>
      a.delivery_date.localeCompare(b.delivery_date),
    );

    return {
      ...data,
      schedules: sortedSchedules,
    };
  }

  async updateSubscriptionStatus(id: number, status: string) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(
        "Cập nhật trạng thái gói định kỳ thất bại: " + (error?.message || ""),
        400,
      );
    }
    return data;
  }

  async cancelAllPendingSchedules(subscriptionId: number) {
    const { data, error } = await supabaseAdmin
      .from("delivery_schedules")
      .update({ status: "cancelled" })
      .eq("subscription_id", subscriptionId)
      .eq("status", "pending")
      .select("id");

    if (error) {
      throw new AppError(
        "Lỗi hủy các lịch giao hàng còn lại: " + error.message,
        500,
      );
    }
    return (data || []).length;
  }

  // ============================================================================
  // 3. TRUY VẤN PHỤC VỤ CRONJOB SINH ĐƠN CON (UC31 & UC02 Bước 6-8)
  // ============================================================================
  async findPendingSchedulesForDate(targetDate: string) {
    // Sử dụng Index idx_schedules_pending_date (delivery_date) WHERE status = 'pending'
    const { data, error } = await supabaseAdmin
      .from("delivery_schedules")
      .select(
        `
        id, subscription_id, delivery_date, status, order_id,
        subscription:subscriptions!inner(
          id, customer_id, package_name, status, shipping_address, total_amount,
          customer:profiles!customer_id(id, full_name, phone, email),
          items:subscription_items(
            id, product_id, quantity, unit_price,
            product:products(id, name, unit, category_id, is_active, deleted_at)
          )
        )
      `,
      )
      .eq("delivery_date", targetDate)
      .eq("status", "pending")
      .eq("subscriptions.status", "active");

    if (error) {
      throw new AppError(
        "Lỗi truy vấn lịch giao gói định kỳ: " + error.message,
        500,
      );
    }

    return data || [];
  }

  async getAvailableStockMap(productIds: number[], minValidExpDate: string) {
    const { data, error } = await supabaseAdmin
      .from("batches")
      .select("product_id, current_quantity")
      .in("product_id", productIds)
      .eq("status", "in_stock")
      .gt("current_quantity", 0)
      .gt("exp_date", minValidExpDate);

    if (error) {
      throw new AppError(
        "Lỗi kiểm tra tồn kho khả dụng cho đơn định kỳ: " + error.message,
        500,
      );
    }

    const stockMap = new Map<number, number>();
    for (const row of data || []) {
      const prev = stockMap.get(row.product_id) || 0;
      stockMap.set(row.product_id, prev + Number(row.current_quantity));
    }
    return stockMap;
  }

  async createChildOrderForSchedule(
    scheduleId: number,
    subscriptionId: number,
    orderPayload: Record<string, any>,
    orderItemsPayload: Array<{
      product_id: number;
      product_name: string;
      unit_price: number;
      quantity: number;
    }>,
  ) {
    // 1. Tạo đơn con trong bảng orders (order_type = 'subscription', total_amount = 0đ do đã trả trước)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert(orderPayload)
      .select("*")
      .single();

    if (orderError || !order) {
      throw new AppError(
        "Lỗi sinh đơn con gói định kỳ: " + (orderError?.message || ""),
        500,
      );
    }

    // 2. Chèn order_items với giá đã chốt trong gói
    const rows = orderItemsPayload.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      unit_price: item.unit_price,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(rows);
    if (itemsError) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new AppError(
        "Lỗi tạo dòng sản phẩm cho đơn con: " + itemsError.message,
        500,
      );
    }

    // 3. Cập nhật trạng thái delivery_schedules -> 'generated' và gắn order_id (quan hệ 1-1)
    const { error: schedError } = await supabaseAdmin
      .from("delivery_schedules")
      .update({
        status: "generated",
        order_id: order.id,
      })
      .eq("id", scheduleId)
      .eq("status", "pending");

    if (schedError) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new AppError(
        "Lỗi cập nhật trạng thái lịch giao: " + schedError.message,
        500,
      );
    }

    // 4. Kiểm tra xem gói định kỳ còn lịch giao nào 'pending' không -> Nếu hết thì chuyển gói sang 'completed'
    const { count: remainingPending } = await supabaseAdmin
      .from("delivery_schedules")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", subscriptionId)
      .eq("status", "pending");

    if (remainingPending === 0) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "completed" })
        .eq("id", subscriptionId)
        .eq("status", "active");
    }

    return order;
  }

  async findSalesAndAdminIds(): Promise<string[]> {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("role", ["sales", "admin"])
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
