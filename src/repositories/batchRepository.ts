import { supabaseAdmin } from "../config/supabaseClient";
import { BatchQueryParams, CreateDisposalDTO } from "../types/batchTypes";
import { AppError } from "../utils/appError";

export class BatchRepository {
  async getSettingValue(key: string, defaultValue: string): Promise<string> {
    const { data } = await supabaseAdmin
      .from("settings")
      .select("value")
      .eq("key", key)
      .single();
    return data?.value || defaultValue;
  }

  async findAllBatches(params: BatchQueryParams) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 && params.limit <= 50
        ? params.limit
        : 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from("batches")
      .select(
        `
        *,
        product:products(id, name, unit, base_price, preservation_days)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (params.product_id) {
      query = query.eq("product_id", params.product_id);
    }

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.near_expiry) {
      const warningDays = Number(
        await this.getSettingValue("expiry_warning_days", "2"),
      );
      const today = new Date();
      const thresholdDate = new Date(today);
      thresholdDate.setDate(today.getDate() + warningDays);

      const todayStr = today.toISOString().split("T")[0];
      const thresholdStr = thresholdDate.toISOString().split("T")[0];

      query = query
        .eq("status", "in_stock")
        .gt("current_quantity", 0)
        .gte("exp_date", todayStr)
        .lte("exp_date", thresholdStr);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error)
      throw new AppError("Lỗi tải danh sách lô hàng: " + error.message, 500);

    const todayStr = new Date().toISOString().split("T")[0];
    const items = (data || []).map((batch: any) => ({
      ...batch,
      is_expired: Boolean(
        batch.exp_date &&
        batch.exp_date <= todayStr &&
        Number(batch.current_quantity) > 0,
      ),
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

  async findBatchById(id: number) {
    const { data, error } = await supabaseAdmin
      .from("batches")
      .select(
        `
        *,
        product:products(id, name, unit, base_price, preservation_days),
        disposals:inventory_disposals(id, quantity_disposed, reason, note, image_url, created_at, disposed_by)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data;
  }

  async findBatchByCode(batchCode: string) {
    const { data, error } = await supabaseAdmin
      .from("batches")
      .select(
        `
        id, batch_code, product_id, sowing_date, harvest_date, exp_date,
        initial_quantity, current_quantity, status, qr_code, qr_scan_count,
        product:products(
          id, name, unit, description, preservation_days,
          category:categories(id, name),
          images:product_images(image_url, is_primary, deleted_at),
          certifications:quality_certifications(id, cert_name, cert_number, issued_by, issue_date, expiry_date, file_url, deleted_at)
        )
      `,
      )
      .eq("batch_code", batchCode)
      .single();

    if (error || !data) return null;
    return data;
  }

  // Truy vấn sử dụng Partial Index idx_batches_fefo (product_id, exp_date ASC, created_at ASC)
  async findAvailableFefoBatches(productId: number) {
    const todayStr = new Date().toISOString().split("T")[0];

    const { data, error } = await supabaseAdmin
      .from("batches")
      .select(
        "id, batch_code, product_id, harvest_date, exp_date, current_quantity, flash_sale_price, flash_sale_ends_at, created_at",
      )
      .eq("product_id", productId)
      .eq("status", "in_stock")
      .gt("current_quantity", 0)
      .gt("exp_date", todayStr)
      .order("exp_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error)
      throw new AppError("Lỗi truy vấn lô hàng FEFO: " + error.message, 500);
    return data || [];
  }

  async createBatch(payload: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from("batches")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Mã lô hàng (batch_code) đã tồn tại", 409);
      }
      throw new AppError("Khởi tạo lô hàng thất bại: " + error.message, 400);
    }
    return data;
  }

  async updateBatch(id: number, payload: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from("batches")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(
        "Cập nhật lô hàng thất bại: " + (error?.message || "Không tìm thấy lô"),
        400,
      );
    }
    return data;
  }

  async incrementQrScanCount(batchId: number, currentCount: number) {
    await supabaseAdmin
      .from("batches")
      .update({ qr_scan_count: currentCount + 1 })
      .eq("id", batchId);
  }

  // --- NHẬT KÝ CANH TÁC (FARMING LOGS) ---
  async findFarmingLogsByBatchId(batchId: number) {
    const { data, error } = await supabaseAdmin
      .from("farming_logs")
      .select(
        `
        id, batch_id, stage, title, description, evidence_image_url, logged_at, created_at,
        staff:profiles!performed_by(id, full_name)
      `,
      )
      .eq("batch_id", batchId)
      .order("logged_at", { ascending: true });

    if (error)
      throw new AppError("Lỗi tải nhật ký canh tác: " + error.message, 500);
    return data || [];
  }

  async createFarmingLog(payload: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from("farming_logs")
      .insert(payload)
      .select(
        `
        id, batch_id, stage, title, description, evidence_image_url, logged_at, created_at,
        staff:profiles!performed_by(id, full_name)
      `,
      )
      .single();

    if (error)
      throw new AppError(
        "Thêm nhật ký canh tác thất bại: " + error.message,
        400,
      );
    return data;
  }

  // --- PHIẾU XUẤT HỦY (INVENTORY DISPOSALS) ---
  async createDisposal(
    payload: CreateDisposalDTO & { image_url: string; disposed_by: string },
  ) {
    // Trigger trg_after_inventory_disposal trên PostgreSQL sẽ tự động:
    // 1. Khóa dòng batch (FOR UPDATE)
    // 2. Trừ current_quantity, cộng disposed_quantity
    // 3. Chuyển status = 'sold_out' nếu current_quantity về 0
    const { data, error } = await supabaseAdmin
      .from("inventory_disposals")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new AppError("Tạo phiếu xuất hủy thất bại: " + error.message, 400);
    }
    return data;
  }

  async writeActivityLog(
    userId: string,
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
