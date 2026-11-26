import { supabaseAdmin } from "../config/supabaseClient";
import { AppError } from "../utils/appError";

export class PaymentRepository {
  // ============================================================================
  // 1. TRUY VẤN ĐỐI TƯỢNG THANH TOÁN (ORDER / SUBSCRIPTION)
  // ============================================================================
  async findOrderForPayment(orderId: number) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id, order_number, customer_id, status, total_amount, customer_name, customer_phone,
        items:order_items(product_name, quantity, unit_price)
      `,
      )
      .eq("id", orderId)
      .single();

    if (error || !data) return null;
    return data;
  }

  async findSubscriptionForPayment(subscriptionId: number) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select(
        `
        id, customer_id, package_name, status, total_amount, start_date, end_date,
        items:subscription_items(
          quantity, unit_price,
          product:products(name)
        )
      `,
      )
      .eq("id", subscriptionId)
      .single();

    if (error || !data) return null;
    return data;
  }

  // ============================================================================
  // 2. QUẢN LÝ BẢN GHI GIAO DỊCH (PAYMENTS)
  // ============================================================================
  async findPaymentById(id: number) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select(
        `
        *,
        order:orders(id, order_number, customer_id, status, total_amount),
        subscription:subscriptions(id, package_name, customer_id, status, total_amount)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data;
  }

  async findPaymentByPayosOrderCode(payosOrderCode: number) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("payos_order_code", payosOrderCode)
      .single();

    if (error || !data) return null;
    return data;
  }

  async findPaymentsByOrderId(orderId: number) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (error)
      throw new AppError("Lỗi truy vấn lịch sử thanh toán đơn hàng", 500);
    return data || [];
  }

  async findPaymentsBySubscriptionId(subscriptionId: number) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("subscription_id", subscriptionId)
      .order("created_at", { ascending: false });

    if (error)
      throw new AppError("Lỗi truy vấn lịch sử thanh toán gói định kỳ", 500);
    return data || [];
  }

  async createPayment(payload: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(
        "Không thể khởi tạo giao dịch thanh toán: " + (error?.message || ""),
        400,
      );
    }
    return data;
  }

  async updatePayment(id: number, payload: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(
        "Cập nhật giao dịch thanh toán thất bại: " + (error?.message || ""),
        400,
      );
    }
    return data;
  }

  // ============================================================================
  // 3. KÍCH HOẠT NGHIỆP VỤ SAU THANH TOÁN THÀNH CÔNG
  // ============================================================================
  async executeAllocateFefoRpc(orderId: number) {
    const { error } = await supabaseAdmin.rpc("allocate_fefo", {
      p_order_id: orderId,
    });

    if (error) {
      throw new Error(
        error.message || "Không đủ tồn kho khả dụng khi tự động trừ kho FEFO",
      );
    }
  }

  async confirmOrderAfterPayment(orderId: number) {
    await supabaseAdmin
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId)
      .eq("status", "pending");
  }

  async activateSubscriptionAfterPayment(subscriptionId: number) {
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "active" })
      .eq("id", subscriptionId)
      .eq("status", "pending_payment");
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
