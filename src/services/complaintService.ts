import crypto from "crypto";
import {
  COMPLAINT_CONFIG,
  COMPLAINT_RESOLUTIONS,
  COMPLAINT_STATUS,
  ORDER_STATUS,
  ORDER_TYPES,
  USER_ROLES,
  UserRole,
} from "../config/constants";
import { ComplaintRepository } from "../repositories/complaintRepository";
import {
  ComplaintQueryParams,
  CreateComplaintDTO,
  CreateReviewDTO,
  HandleComplaintDTO,
  ProductReviewQueryParams,
  UploadedEvidenceFile,
} from "../types/complaintTypes";
import { AppError } from "../utils/appError";
import { uploadToSupabaseStorage } from "../utils/storageUtil";

export class ComplaintService {
  private complaintRepo = new ComplaintRepository();

  private generateReplacementOrderNumber(): string {
    const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const datePart = vnNow.toISOString().split("T")[0].replace(/-/g, "");
    const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `REP-${datePart}-${randomPart}`;
  }

  // ============================================================================
  // 1. GỬI KHIẾU NẠI NÔNG SẢN HỎNG TRONG 24H (POST /api/v1/orders/:orderItemId/complaints)
  // ============================================================================
  async createComplaint(
    customerId: string,
    orderItemId: number,
    payload: CreateComplaintDTO,
    files: Express.Multer.File[],
  ) {
    // 1. Bắt buộc đính kèm ít nhất 1 ảnh/video minh chứng (UC03 - E4)
    if (!files || files.length === 0) {
      throw new AppError(
        "Vui lòng đính kèm ít nhất 1 ảnh hoặc video minh chứng (tối đa 5 tệp)",
        400,
      );
    }

    if (files.length > COMPLAINT_CONFIG.MAX_FILES) {
      throw new AppError(
        `Chỉ được đính kèm tối đa ${COMPLAINT_CONFIG.MAX_FILES} tệp`,
        400,
      );
    }

    // 2. Kiểm tra kích thước chi tiết từng tệp (Ảnh <= 5MB, Video <= 50MB - UC03 E3)
    const validatedFiles: Array<{
      file: Express.Multer.File;
      media_type: "image" | "video";
      size_kb: number;
    }> = [];

    for (const file of files) {
      const isImage = file.mimetype.startsWith("image/");
      const mediaType: "image" | "video" = isImage ? "image" : "video";
      const sizeKb = Math.max(1, Math.ceil(file.size / 1024));

      if (
        mediaType === "image" &&
        sizeKb > COMPLAINT_CONFIG.MAX_IMAGE_SIZE_KB
      ) {
        throw new AppError(
          `Ảnh "${file.originalname}" vượt quá giới hạn 5 MB (${Math.round(sizeKb / 1024)} MB)`,
          413,
        );
      }

      if (
        mediaType === "video" &&
        sizeKb > COMPLAINT_CONFIG.MAX_VIDEO_SIZE_KB
      ) {
        throw new AppError(
          `Video "${file.originalname}" vượt quá giới hạn 50 MB (${Math.round(sizeKb / 1024)} MB)`,
          413,
        );
      }

      validatedFiles.push({ file, media_type: mediaType, size_kb: sizeKb });
    }

    // 3. Kiểm tra dòng hàng & quyền sở hữu đơn hàng
    const orderItem: any =
      await this.complaintRepo.findOrderItemWithContext(orderItemId);
    if (!orderItem || !orderItem.order) {
      throw new AppError("Không tìm thấy sản phẩm trong đơn hàng", 404);
    }

    const order = orderItem.order;
    if (order.customer_id !== customerId) {
      throw new AppError(
        "Bạn không có quyền gửi khiếu nại cho đơn hàng này (Forbidden)",
        403,
      );
    }

    if (order.status !== ORDER_STATUS.DELIVERED || !order.delivered_at) {
      throw new AppError(
        "Chỉ được gửi khiếu nại đối với đơn hàng đã giao thành công",
        400,
      );
    }

    // 4. Kiểm tra cửa sổ thời gian 24 giờ kể từ lúc nhận hàng (UC03 - BR1 & E1)
    const deliveredTime = new Date(order.delivered_at).getTime();
    const elapsedMs = Date.now() - deliveredTime;
    const maxWindowMs = COMPLAINT_CONFIG.WINDOW_HOURS * 60 * 60 * 1000;

    if (elapsedMs > maxWindowMs) {
      throw new AppError(
        "Đã quá 24 giờ kể từ lúc nhận hàng, hệ thống không thể tiếp nhận khiếu nại",
        400,
      );
    }

    // 5. Kiểm tra số lượng bị lỗi không vượt quá số lượng đã mua
    const purchasedQty = Number(orderItem.quantity);
    if (payload.quantity_affected > purchasedQty) {
      throw new AppError(
        `Số lượng khiếu nại (${payload.quantity_affected}) vượt quá số lượng đã mua (${purchasedQty})`,
        400,
      );
    }

    // 6. Chống tạo trùng khiếu nại đang chờ xử lý trên cùng dòng hàng (UC03 - E5)
    const existingComplaints =
      await this.complaintRepo.findActiveComplaintsByOrderItem(orderItemId);
    if (
      existingComplaints.some((c: any) => c.status === COMPLAINT_STATUS.PENDING)
    ) {
      throw new AppError(
        "Sản phẩm này đã có yêu cầu khiếu nại đang chờ Sales xử lý",
        409,
      );
    }

    const alreadyClaimedQty = existingComplaints.reduce(
      (sum: number, c: any) => sum + Number(c.quantity_affected),
      0,
    );
    if (alreadyClaimedQty + payload.quantity_affected > purchasedQty) {
      throw new AppError(
        `Tổng số lượng khiếu nại vượt quá số lượng đã mua (đã xử lý ${alreadyClaimedQty}/${purchasedQty})`,
        400,
      );
    }

    // 7. Upload các tệp minh chứng lên Supabase Storage
    const uploadedMedia: UploadedEvidenceFile[] = [];
    for (const item of validatedFiles) {
      const publicUrl = await uploadToSupabaseStorage(
        item.file,
        "complaint-media",
        `order-items/${orderItemId}`,
      );
      uploadedMedia.push({
        media_type: item.media_type,
        url: publicUrl,
        size_kb: item.size_kb,
      });
    }

    // 8. Lưu khiếu nại ở trạng thái 'pending'
    const createdComplaint = await this.complaintRepo.createComplaintWithMedia(
      {
        order_item_id: orderItemId,
        quantity_affected: payload.quantity_affected,
        reason: payload.reason,
        description: payload.description || null,
        requested_resolution: payload.requested_resolution,
        status: COMPLAINT_STATUS.PENDING,
      },
      uploadedMedia,
    );

    // 9. Thông báo cho bộ phận Sales tiếp nhận xử lý (UC03 Bước 7)
    const staffIds = await this.complaintRepo.findSalesAndAdminIds();
    for (const staffId of staffIds) {
      await this.complaintRepo.createNotification(
        staffId,
        "NEW_COMPLAINT",
        `Khiếu nại mới #${createdComplaint.id} - Đơn ${order.order_number}`,
        `Khách hàng ${order.customer_name} khiếu nại ${payload.quantity_affected} "${orderItem.product_name}" (lý do: ${payload.reason}). Vui lòng kiểm tra minh chứng.`,
        "warning",
      );
    }

    await this.complaintRepo.writeActivityLog(
      customerId,
      "CREATE_COMPLAINT",
      "complaints",
      createdComplaint.id,
      null,
      {
        order_item_id: orderItemId,
        quantity_affected: payload.quantity_affected,
        reason: payload.reason,
        media_count: uploadedMedia.length,
      },
    );

    return createdComplaint;
  }

  // ============================================================================
  // 2. XEM HÀNG ĐỢI & CHI TIẾT KHIẾU NẠI (GET /api/v1/complaints & /:id)
  // ============================================================================
  async getComplaintsQueue(params: ComplaintQueryParams) {
    return await this.complaintRepo.findComplaintsQueue(params);
  }

  async getComplaintDetail(
    complaintId: number,
    requester: { id: string; role: UserRole },
  ) {
    const complaint: any =
      await this.complaintRepo.findComplaintById(complaintId);
    if (!complaint) {
      throw new AppError("Không tìm thấy yêu cầu khiếu nại", 404);
    }

    const ownerId = complaint.order_item?.order?.customer_id;
    if (requester.role === USER_ROLES.CUSTOMER && ownerId !== requester.id) {
      throw new AppError(
        "Bạn không có quyền xem yêu cầu khiếu nại này (Forbidden)",
        403,
      );
    }

    return complaint;
  }

  // ============================================================================
  // 3. SALES DUYỆT KHIẾU NẠI: HOÀN TIỀN HOẶC GIAO BÙ 0Đ (PATCH /api/v1/complaints/:id/handle)
  // ============================================================================
  async handleComplaint(
    complaintId: number,
    salesUserId: string,
    payload: HandleComplaintDTO,
  ) {
    const complaint: any =
      await this.complaintRepo.findComplaintById(complaintId);
    if (!complaint) {
      throw new AppError("Không tìm thấy yêu cầu khiếu nại", 404);
    }

    if (complaint.status !== COMPLAINT_STATUS.PENDING) {
      throw new AppError(
        `Khiếu nại này đã được xử lý trước đó (trạng thái: "${complaint.status}")`,
        400,
      );
    }

    const orderItem = complaint.order_item;
    const order = orderItem?.order;

    // TRƯỜNG HỢP A: SALES TỪ CHỐI KHIẾU NẠI (UC03 - A1)
    if (payload.action === "reject") {
      await this.complaintRepo.updateComplaint(complaintId, {
        status: COMPLAINT_STATUS.REJECTED,
        sales_note: payload.sales_note!.trim(),
        handled_by: salesUserId,
      });

      if (order?.customer_id) {
        await this.complaintRepo.createNotification(
          order.customer_id,
          "COMPLAINT_REJECTED",
          `Khiếu nại #${complaintId} bị từ chối`,
          `Yêu cầu khiếu nại cho sản phẩm "${orderItem.product_name}" (đơn ${order.order_number}) không được chấp nhận. Lý do: ${payload.sales_note}`,
          "warning",
        );
      }

      await this.complaintRepo.writeActivityLog(
        salesUserId,
        "REJECT_COMPLAINT",
        "complaints",
        complaintId,
        { status: COMPLAINT_STATUS.PENDING },
        { status: COMPLAINT_STATUS.REJECTED, sales_note: payload.sales_note },
      );

      return await this.complaintRepo.findComplaintById(complaintId);
    }

    // TRƯỜNG HỢP B1: CHẤP NHẬN & HOÀN TIỀN QUA PAYOS / ĐỐI SOÁT (UC03 Bước 9)
    if (payload.resolution === COMPLAINT_RESOLUTIONS.REFUND) {
      const maxItemRefund = Math.round(
        Number(orderItem.unit_price) * Number(complaint.quantity_affected),
      );

      const finalRefundAmount =
        payload.refund_amount !== undefined
          ? Math.round(payload.refund_amount)
          : maxItemRefund;

      // UC03 - BR2: Số tiền hoàn không vượt quá giá trị phần hàng bị lỗi
      if (finalRefundAmount <= 0 || finalRefundAmount > maxItemRefund) {
        throw new AppError(
          `Số tiền hoàn (${finalRefundAmount.toLocaleString(
            "vi-VN",
          )}đ) phải lớn hơn 0 và không vượt quá giá trị hàng lỗi (${maxItemRefund.toLocaleString(
            "vi-VN",
          )}đ)`,
          400,
        );
      }

      const refundPayment = await this.complaintRepo.recordRefundPayment(
        order.id,
        finalRefundAmount,
        complaintId,
      );

      await this.complaintRepo.updateComplaint(complaintId, {
        status: COMPLAINT_STATUS.RESOLVED,
        refund_amount: finalRefundAmount,
        sales_note:
          payload.sales_note?.trim() || "Đã duyệt hoàn tiền theo khiếu nại",
        handled_by: salesUserId,
      });

      if (order?.customer_id) {
        await this.complaintRepo.createNotification(
          order.customer_id,
          "COMPLAINT_REFUNDED",
          `Đã duyệt hoàn tiền ${finalRefundAmount.toLocaleString("vi-VN")}đ`,
          `Khiếu nại #${complaintId} cho "${orderItem.product_name}" (đơn ${order.order_number}) đã được duyệt hoàn ${finalRefundAmount.toLocaleString(
            "vi-VN",
          )}đ (Mã GD: ${refundPayment.transaction_id}).`,
          "info",
        );
      }

      await this.complaintRepo.writeActivityLog(
        salesUserId,
        "RESOLVE_COMPLAINT_REFUND",
        "complaints",
        complaintId,
        { status: COMPLAINT_STATUS.PENDING },
        {
          status: COMPLAINT_STATUS.RESOLVED,
          refund_amount: finalRefundAmount,
          refund_transaction_id: refundPayment.transaction_id,
        },
      );

      return await this.complaintRepo.findComplaintById(complaintId);
    }

    // TRƯỜNG HỢP B2: CHẤP NHẬN & TẠO ĐƠN GIAO BÙ 0Đ (UC03 Bước 9 -> UC01)
    if (payload.resolution === COMPLAINT_RESOLUTIONS.REPLACEMENT) {
      const replacementOrderNumber = this.generateReplacementOrderNumber();

      const replacementOrder = await this.complaintRepo.createReplacementOrder(
        {
          order_number: replacementOrderNumber,
          customer_id: order.customer_id,
          confirmed_by: payload.auto_confirm_replacement ? salesUserId : null,
          order_type: ORDER_TYPES.REPLACEMENT,
          status: ORDER_STATUS.PENDING,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          shipping_address: order.shipping_address,
          distance_km: 0,
          shipping_fee: 0,
          total_amount: 0,
          customer_note: `Đơn giao bù 0đ cho khiếu nại #${complaintId} (từ đơn gốc ${order.order_number})`,
        },
        {
          product_id: orderItem.product_id,
          product_name: orderItem.product_name,
          unit_price: Number(orderItem.unit_price),
          quantity: Number(complaint.quantity_affected),
        },
        Boolean(payload.auto_confirm_replacement),
      );

      await this.complaintRepo.updateComplaint(complaintId, {
        status: COMPLAINT_STATUS.RESOLVED,
        replacement_order_id: replacementOrder.id,
        sales_note:
          payload.sales_note?.trim() ||
          `Đã tạo đơn giao bù 0đ (${replacementOrderNumber})`,
        handled_by: salesUserId,
      });

      if (order?.customer_id) {
        await this.complaintRepo.createNotification(
          order.customer_id,
          "COMPLAINT_REPLACEMENT_CREATED",
          `Đã tạo đơn giao bù 0đ (${replacementOrderNumber})`,
          `Khiếu nại #${complaintId} cho "${orderItem.product_name}" (đơn ${order.order_number}) đã được duyệt giao bù miễn phí qua đơn ${replacementOrderNumber}.`,
          "info",
        );
      }

      await this.complaintRepo.writeActivityLog(
        salesUserId,
        "RESOLVE_COMPLAINT_REPLACEMENT",
        "complaints",
        complaintId,
        { status: COMPLAINT_STATUS.PENDING },
        {
          status: COMPLAINT_STATUS.RESOLVED,
          replacement_order_id: replacementOrder.id,
          replacement_order_number: replacementOrderNumber,
        },
      );

      return await this.complaintRepo.findComplaintById(complaintId);
    }

    throw new AppError("Phương án xử lý khiếu nại không hợp lệ", 400);
  }

  // ============================================================================
  // 4. ĐÁNH GIÁ SẢN PHẨM ĐÃ MUA (POST /api/v1/reviews & GET /products/:id/reviews)
  // ============================================================================
  async createProductReview(customerId: string, payload: CreateReviewDTO) {
    const orderItem: any = await this.complaintRepo.findOrderItemWithContext(
      payload.order_item_id,
    );

    if (!orderItem || !orderItem.order) {
      throw new AppError(
        "Không tìm thấy sản phẩm trong đơn hàng để đánh giá",
        404,
      );
    }

    if (orderItem.order.customer_id !== customerId) {
      throw new AppError(
        "Bạn không có quyền đánh giá sản phẩm của đơn hàng này (Forbidden)",
        403,
      );
    }

    if (orderItem.order.status !== ORDER_STATUS.DELIVERED) {
      throw new AppError(
        "Chỉ được đánh giá sản phẩm sau khi đơn hàng đã giao thành công",
        400,
      );
    }

    // Ràng buộc UNIQUE(order_item_id): mỗi dòng hàng chỉ đánh giá 1 lần
    const existingReview = await this.complaintRepo.findReviewByOrderItemId(
      payload.order_item_id,
    );
    if (existingReview) {
      throw new AppError(
        "Bạn đã gửi đánh giá cho sản phẩm này trong đơn hàng rồi",
        409,
      );
    }

    return await this.complaintRepo.createReview({
      user_id: customerId,
      product_id: orderItem.product_id,
      order_item_id: payload.order_item_id,
      rating: payload.rating,
      comment: payload.comment,
    });
  }

  async getPublicProductReviews(
    productId: number,
    params: ProductReviewQueryParams,
  ) {
    return await this.complaintRepo.findPublicReviewsByProduct(
      productId,
      params,
    );
  }

  // ============================================================================
  // 5. CRONJOB TỰ ĐỘNG XỬ LÝ KHIẾU NẠI QUÁ HẠN 24H (UC32)
  // ============================================================================
  async processExpiredPendingComplaints() {
    const cutoffIso = new Date(
      Date.now() - COMPLAINT_CONFIG.WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const staleComplaints: any[] =
      await this.complaintRepo.findStalePendingComplaints(cutoffIso);

    if (staleComplaints.length === 0) {
      return { processed_count: 0, complaint_ids: [] };
    }

    const processedIds: number[] = [];

    for (const cmp of staleComplaints) {
      await this.complaintRepo.updateComplaint(cmp.id, {
        status: COMPLAINT_STATUS.REJECTED,
        sales_note:
          "Hệ thống tự động đóng yêu cầu do quá thời hạn 24 giờ xử lý/bổ sung minh chứng (UC32)",
      });

      const customerId = cmp.order_item?.order?.customer_id;
      const orderNumber = cmp.order_item?.order?.order_number || "";
      if (customerId) {
        await this.complaintRepo.createNotification(
          customerId,
          "COMPLAINT_AUTO_CLOSED",
          `Khiếu nại #${cmp.id} đã tự động đóng`,
          `Yêu cầu khiếu nại #${cmp.id} (đơn ${orderNumber}) đã tự động đóng do quá thời hạn 24 giờ.`,
          "warning",
        );
      }

      processedIds.push(cmp.id);
    }

    await this.complaintRepo.writeActivityLog(
      null,
      "CRON_AUTO_REJECT_EXPIRED_COMPLAINTS",
      "complaints",
      cutoffIso,
      null,
      { processed_count: processedIds.length, complaint_ids: processedIds },
    );

    return {
      processed_count: processedIds.length,
      complaint_ids: processedIds,
    };
  }
}
