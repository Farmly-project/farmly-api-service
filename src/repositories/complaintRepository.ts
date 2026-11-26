import { supabaseAdmin } from "../config/supabaseClient";
import {
  ComplaintQueryParams,
  ProductReviewQueryParams,
  UploadedEvidenceFile,
} from "../types/complaintTypes";
import { AppError } from "../utils/appError";

export class ComplaintRepository {
  // ============================================================================
  // 1. TRUY VẤN ORDER_ITEM & KIỂM TRA ĐIỀU KIỆN KHIẾU NẠI / ĐÁNH GIÁ
  // ============================================================================
  async findOrderItemWithContext(orderItemId: number) {
    const { data, error } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id, order_id, product_id, product_name, unit_price, quantity,
        order:orders!inner(
          id, order_number, customer_id, order_type, status,
          customer_name, customer_phone, shipping_address, delivered_at, total_amount
        ),
        batch_allocations:order_details(
          id, quantity,
          batch:batches(id, batch_code, harvest_date, exp_date)
        )
      `,
      )
      .eq("id", orderItemId)
      .single();

    if (error || !data) return null;
    return data;
  }

  async findActiveComplaintsByOrderItem(orderItemId: number) {
    const { data, error } = await supabaseAdmin
      .from("complaints")
      .select("id, status, quantity_affected")
      .eq("order_item_id", orderItemId)
      .in("status", ["pending", "approved", "resolved"]);

    if (error) {
      throw new AppError(
        "Lỗi kiểm tra lịch sử khiếu nại của dòng hàng: " + error.message,
        500,
      );
    }
    return data || [];
  }

  // ============================================================================
  // 2. QUẢN LÝ KHIẾU NẠI & TỆP MINH CHỨNG (COMPLAINTS & COMPLAINT_MEDIA)
  // ============================================================================
  async createComplaintWithMedia(
    complaintPayload: Record<string, any>,
    mediaFiles: UploadedEvidenceFile[],
  ) {
    const { data: complaint, error: compError } = await supabaseAdmin
      .from("complaints")
      .insert(complaintPayload)
      .select("*")
      .single();

    if (compError || !complaint) {
      throw new AppError(
        "Không thể tạo yêu cầu khiếu nại: " + (compError?.message || ""),
        400,
      );
    }

    const mediaRows = mediaFiles.map((file) => ({
      complaint_id: complaint.id,
      media_type: file.media_type,
      url: file.url,
      size_kb: file.size_kb,
    }));

    const { error: mediaError } = await supabaseAdmin
      .from("complaint_media")
      .insert(mediaRows);
    if (mediaError) {
      await supabaseAdmin.from("complaints").delete().eq("id", complaint.id);
      throw new AppError(
        "Lỗi lưu tệp minh chứng khiếu nại: " + mediaError.message,
        400,
      );
    }

    return await this.findComplaintById(complaint.id);
  }

  async findComplaintsQueue(params: ComplaintQueryParams) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 && params.limit <= 50
        ? params.limit
        : 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Sử dụng Index idx_complaints_status_created (status, created_at ASC)
    let query = supabaseAdmin
      .from("complaints")
      .select(
        `
        *,
        media:complaint_media(id, media_type, url, size_kb, created_at),
        order_item:order_items!inner(
          id, order_id, product_id, product_name, unit_price, quantity,
          order:orders!inner(
            id, order_number, customer_id, customer_name, customer_phone, delivered_at
          ),
          batch_allocations:order_details(
            quantity,
            batch:batches(id, batch_code, harvest_date, exp_date)
          )
        ),
        handler:profiles!handled_by(id, full_name, email)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: true });

    if (params.status) {
      query = query.eq("status", params.status);
    } else {
      // Mặc định ưu tiên hàng đợi khiếu nại chưa xử lý ('pending')
      query = query.eq("status", "pending");
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      throw new AppError(
        "Lỗi tải danh sách hàng đợi khiếu nại: " + error.message,
        500,
      );
    }

    return {
      items: data || [],
      pagination: {
        page,
        limit,
        total_items: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async findComplaintById(id: number) {
    const { data, error } = await supabaseAdmin
      .from("complaints")
      .select(
        `
        *,
        media:complaint_media(id, media_type, url, size_kb, created_at),
        order_item:order_items(
          id, order_id, product_id, product_name, unit_price, quantity,
          order:orders(
            id, order_number, customer_id, customer_name, customer_phone,
            shipping_address, delivered_at, total_amount
          ),
          batch_allocations:order_details(
            id, quantity,
            batch:batches(id, batch_code, harvest_date, exp_date)
          )
        ),
        replacement_order:orders!replacement_order_id(id, order_number, status, created_at),
        handler:profiles!handled_by(id, full_name, email)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data;
  }

  async updateComplaint(id: number, payload: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from("complaints")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(
        "Cập nhật khiếu nại thất bại: " + (error?.message || ""),
        400,
      );
    }
    return data;
  }

  async recordRefundPayment(
    orderId: number,
    refundAmount: number,
    complaintId: number,
  ) {
    // Tìm giao dịch gốc đã thanh toán của đơn hàng (nếu có)
    const { data: originalPayment } = await supabaseAdmin
      .from("payments")
      .select("payment_method, payos_order_code")
      .eq("order_id", orderId)
      .eq("status", "paid")
      .limit(1)
      .single();

    const method = originalPayment?.payment_method || "payos";

    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert({
        order_id: orderId,
        payment_method: method,
        payment_type: "refund",
        transaction_id: `REFUND-CMP-${complaintId}-${Date.now()}`,
        amount: refundAmount,
        status: "refunded",
        paid_at: new Date().toISOString(),
        gateway_response: {
          source: "complaint_resolution",
          complaint_id: complaintId,
          original_payos_order_code: originalPayment?.payos_order_code || null,
        },
      })
      .select("*")
      .single();

    if (error) {
      throw new AppError(
        "Lỗi ghi nhận giao dịch hoàn tiền: " + error.message,
        500,
      );
    }
    return data;
  }

  async createReplacementOrder(
    orderPayload: Record<string, any>,
    itemPayload: {
      product_id: number;
      product_name: string;
      unit_price: number;
      quantity: number;
    },
    autoConfirmFefo = false,
  ) {
    const { data: repOrder, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert(orderPayload)
      .select("*")
      .single();

    if (orderError || !repOrder) {
      throw new AppError(
        "Không thể tạo đơn giao bù: " + (orderError?.message || ""),
        500,
      );
    }

    const { error: itemError } = await supabaseAdmin
      .from("order_items")
      .insert({
        order_id: repOrder.id,
        product_id: itemPayload.product_id,
        product_name: itemPayload.product_name,
        unit_price: itemPayload.unit_price,
        quantity: itemPayload.quantity,
      });

    if (itemError) {
      await supabaseAdmin.from("orders").delete().eq("id", repOrder.id);
      throw new AppError(
        "Lỗi tạo chi tiết đơn giao bù: " + itemError.message,
        500,
      );
    }

    // Nếu Sales yêu cầu trừ kho FEFO ngay cho đơn giao bù (UC03 Bước 9 -> UC01)
    if (autoConfirmFefo) {
      const { error: fefoError } = await supabaseAdmin.rpc("allocate_fefo", {
        p_order_id: repOrder.id,
      });

      if (!fefoError) {
        await supabaseAdmin
          .from("orders")
          .update({
            status: "confirmed",
            confirmed_by: orderPayload.confirmed_by || null,
          })
          .eq("id", repOrder.id);
      }
    }

    return repOrder;
  }

  // ============================================================================
  // 3. QUẢN LÝ ĐÁNH GIÁ SẢN PHẨM (REVIEWS - UC14)
  // ============================================================================
  async findReviewByOrderItemId(orderItemId: number) {
    const { data } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("order_item_id", orderItemId)
      .single();

    return data || null;
  }

  async createReview(payload: {
    user_id: string;
    product_id: number;
    order_item_id: number;
    rating: number;
    comment?: string;
  }) {
    const { data, error } = await supabaseAdmin
      .from("reviews")
      .insert({
        user_id: payload.user_id,
        product_id: payload.product_id,
        order_item_id: payload.order_item_id,
        rating: payload.rating,
        comment: payload.comment || null,
      })
      .select(
        `
        *,
        user:profiles!user_id(id, full_name, avatar_url)
      `,
      )
      .single();

    if (error || !data) {
      throw new AppError(
        "Không thể lưu đánh giá sản phẩm: " + (error?.message || ""),
        400,
      );
    }
    return data;
  }

  async findPublicReviewsByProduct(
    productId: number,
    params: ProductReviewQueryParams,
  ) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 && params.limit <= 50
        ? params.limit
        : 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 1. Lấy thống kê tổng số đánh giá và phân bổ sao của sản phẩm (dùng idx_reviews_product)
    const { data: allRatings } = await supabaseAdmin
      .from("reviews")
      .select("rating")
      .eq("product_id", productId)
      .is("deleted_at", null);

    const distribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    let sumRating = 0;
    for (const r of allRatings || []) {
      const star = Number(r.rating);
      distribution[star] = (distribution[star] || 0) + 1;
      sumRating += star;
    }
    const totalAll = (allRatings || []).length;
    const averageRating =
      totalAll > 0 ? Number((sumRating / totalAll).toFixed(1)) : 0;

    // 2. Truy vấn danh sách phân trang
    let query = supabaseAdmin
      .from("reviews")
      .select(
        `
        id, product_id, order_item_id, rating, comment, created_at,
        user:profiles!user_id(id, full_name, avatar_url)
      `,
        { count: "exact" },
      )
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (params.rating) {
      query = query.eq("rating", params.rating);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      throw new AppError(
        "Lỗi tải danh sách đánh giá sản phẩm: " + error.message,
        500,
      );
    }

    return {
      summary: {
        average_rating: averageRating,
        total_reviews: totalAll,
        rating_distribution: distribution,
      },
      items: data || [],
      pagination: {
        page,
        limit,
        total_items: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  // ============================================================================
  // 4. CRONJOB TỰ ĐỘNG TỪ CHỐI KHIẾU NẠI QUÁ HẠN 24H (UC32) & HỆ THỐNG
  // ============================================================================
  async findStalePendingComplaints(cutoffIso: string) {
    const { data, error } = await supabaseAdmin
      .from("complaints")
      .select(
        `
        id, order_item_id, created_at,
        order_item:order_items(
          product_name,
          order:orders(id, order_number, customer_id)
        )
      `,
      )
      .eq("status", "pending")
      .lt("created_at", cutoffIso);

    if (error) {
      throw new AppError(
        "Lỗi quét khiếu nại quá hạn 24h: " + error.message,
        500,
      );
    }
    return data || [];
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
