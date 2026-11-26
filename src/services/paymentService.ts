import { payos } from "../config/payos";
import { USER_ROLES, UserRole } from "../config/constants";
import { PaymentRepository } from "../repositories/paymentRepository";
import { CreatePaymentDTO, PayosReturnQuery } from "../types/paymentTypes";
import { AppError } from "../utils/appError";

export class PaymentService {
  private paymentRepo = new PaymentRepository();
  private readonly PAYMENT_TTL_SECONDS = 15 * 60; // Hiệu lực link thanh toán 15 phút (UC02-E1, UC06-E4)

  // Sinh mã đơn hàng số nguyên duy nhất cho PayOS (15 chữ số <= MAX_SAFE_INTEGER)
  private generatePayosOrderCode(): number {
    const timestamp = Date.now(); // 13 chữ số
    const randomSuffix = Math.floor(10 + Math.random() * 90); // 2 chữ số
    return Number(`${timestamp}${randomSuffix}`);
  }

  // ============================================================================
  // 1. TẠO YÊU CẦU THANH TOÁN VIETQR / PAYOS (POST /api/v1/payments)
  // ============================================================================
  async createPayosPayment(customerId: string, payload: CreatePaymentDTO) {
    const appUrl = (process.env.APP_URL || "http://localhost:5000").replace(
      /\/$/,
      "",
    );
    const defaultReturnUrl = `${appUrl}/api/v1/payments/return/payos`;
    const defaultCancelUrl = `${appUrl}/api/v1/payments/return/payos?cancel=true`;

    const returnUrl = payload.return_url || defaultReturnUrl;
    const cancelUrl = payload.cancel_url || defaultCancelUrl;

    let amount = 0;
    let description = "";
    let paymentType: "order_payment" | "subscription_payment" = "order_payment";
    let items: Array<{ name: string; quantity: number; price: number }> = [];
    let existingPendingPaymentId: number | null = null;

    // TRƯỜNG HỢP A: Thanh toán cho Đơn hàng lẻ
    if (payload.order_id) {
      const order = await this.paymentRepo.findOrderForPayment(
        payload.order_id,
      );
      if (!order) {
        throw new AppError("Không tìm thấy đơn hàng", 404);
      }

      if (order.customer_id !== customerId) {
        throw new AppError(
          "Bạn không có quyền thanh toán đơn hàng này (Forbidden)",
          403,
        );
      }

      if (order.status === "cancelled") {
        throw new AppError("Đơn hàng đã bị hủy, không thể tạo thanh toán", 400);
      }

      const existingPayments = await this.paymentRepo.findPaymentsByOrderId(
        order.id,
      );
      if (existingPayments.some((p: any) => p.status === "paid")) {
        throw new AppError("Đơn hàng này đã được thanh toán hoàn tất", 409);
      }

      // Tìm bản ghi payment pending hiện có (được khởi tạo lúc tạo đơn) để cập nhật lại mã PayOS
      const pendingPayos = existingPayments.find(
        (p: any) => p.status === "pending" && p.payment_method === "payos",
      );
      if (pendingPayos) {
        existingPendingPaymentId = pendingPayos.id;
      }

      amount = Math.round(Number(order.total_amount));
      paymentType = "order_payment";
      // PayOS giới hạn mô tả tối đa 25 ký tự để tương thích mọi ngân hàng VietQR
      description = `FARMLY DH ${order.id}`.slice(0, 25);
      items = (order.items || []).map((i: any) => ({
        name: String(i.product_name).slice(0, 50),
        quantity: Math.ceil(Number(i.quantity)),
        price: Math.round(Number(i.unit_price)),
      }));
    }

    // TRƯỜNG HỢP B: Thanh toán trước cho Gói định kỳ (Subscription)
    if (payload.subscription_id) {
      const sub = await this.paymentRepo.findSubscriptionForPayment(
        payload.subscription_id,
      );
      if (!sub) {
        throw new AppError("Không tìm thấy gói mua hàng định kỳ", 404);
      }

      if (sub.customer_id !== customerId) {
        throw new AppError(
          "Bạn không có quyền thanh toán gói định kỳ này (Forbidden)",
          403,
        );
      }

      if (sub.status !== "pending_payment") {
        throw new AppError(
          `Gói định kỳ đang ở trạng thái "${sub.status}", không thể tạo thanh toán mới`,
          400,
        );
      }

      const existingPayments =
        await this.paymentRepo.findPaymentsBySubscriptionId(sub.id);
      if (existingPayments.some((p: any) => p.status === "paid")) {
        throw new AppError("Gói định kỳ này đã được thanh toán", 409);
      }

      const pendingSubPay = existingPayments.find(
        (p: any) => p.status === "pending" && p.payment_method === "payos",
      );
      if (pendingSubPay) {
        existingPendingPaymentId = pendingSubPay.id;
      }

      amount = Math.round(Number(sub.total_amount));
      paymentType = "subscription_payment";
      description = `FARMLY GOI ${sub.id}`.slice(0, 25);
      items = (sub.items || []).map((i: any) => ({
        name: String(i.product?.name || "Nông sản định kỳ").slice(0, 50),
        quantity: Math.ceil(Number(i.quantity)),
        price: Math.round(Number(i.unit_price)),
      }));
    }

    if (amount <= 0) {
      throw new AppError("Số tiền thanh toán phải lớn hơn 0đ", 400);
    }

    const payosOrderCode = this.generatePayosOrderCode();
    const expiredAtUnix =
      Math.floor(Date.now() / 1000) + this.PAYMENT_TTL_SECONDS;
    const expiresAtIso = new Date(expiredAtUnix * 1000).toISOString();

    // Gọi API PayOS tạo mã VietQR và link thanh toán
    let paymentLink: any;
    try {
      paymentLink = await payos.paymentRequests.create({
        orderCode: payosOrderCode,
        amount,
        description,
        items:
          items.length > 0
            ? items
            : [{ name: description, quantity: 1, price: amount }],
        cancelUrl,
        returnUrl,
        expiredAt: expiredAtUnix,
      });
    } catch (err: any) {
      throw new AppError(
        `Không thể kết nối cổng thanh toán PayOS: ${err?.message || "Lỗi không xác định"}`,
        502,
      );
    }

    // Lưu hoặc cập nhật bản ghi trong bảng payments
    let savedPayment: any;
    if (existingPendingPaymentId) {
      savedPayment = await this.paymentRepo.updatePayment(
        existingPendingPaymentId,
        {
          payos_order_code: payosOrderCode,
          amount,
          qr_code_url: paymentLink.qrCode,
          gateway_response: paymentLink,
          expires_at: expiresAtIso,
        },
      );
    } else {
      savedPayment = await this.paymentRepo.createPayment({
        order_id: payload.order_id || null,
        subscription_id: payload.subscription_id || null,
        payment_method: "payos",
        payment_type: paymentType,
        payos_order_code: payosOrderCode,
        amount,
        status: "pending",
        qr_code_url: paymentLink.qrCode,
        gateway_response: paymentLink,
        expires_at: expiresAtIso,
      });
    }

    return {
      payment_id: savedPayment.id,
      payment_type: paymentType,
      order_id: savedPayment.order_id,
      subscription_id: savedPayment.subscription_id,
      payos_order_code: payosOrderCode,
      amount,
      status: savedPayment.status,
      checkout_url: paymentLink.checkoutUrl,
      qr_code: paymentLink.qrCode,
      account_number: paymentLink.accountNumber,
      account_name: paymentLink.accountName,
      bin: paymentLink.bin,
      expires_at: expiresAtIso,
    };
  }

  // ============================================================================
  // 2. XỬ LÝ WEBHOOK IPN TỪ PAYOS (POST /api/v1/payments/webhook/payos)
  // ============================================================================
  async handlePayosWebhook(webhookBody: any) {
    // 1. Xác thực chữ ký điện tử (HMAC-SHA256) từ PayOS
    let verifiedData: any;
    try {
      verifiedData = payos.webhooks.verify(webhookBody);
    } catch (err: any) {
      throw new AppError(
        "Chữ ký Webhook PayOS không hợp lệ (Invalid Signature)",
        400,
      );
    }

    const payosOrderCode = Number(verifiedData.orderCode);

    // PayOS thường gửi orderCode = 123 khi bấm "Kiểm tra Webhook" trên Dashboard
    const payment =
      await this.paymentRepo.findPaymentByPayosOrderCode(payosOrderCode);
    if (!payment) {
      return {
        acknowledged: true,
        message: `Webhook nhận thành công (không có giao dịch nội bộ khớp orderCode ${payosOrderCode})`,
      };
    }

    // 2. Chống xử lý trùng lặp (Idempotency) nếu PayOS gọi lại nhiều lần
    if (payment.status === "paid") {
      return {
        acknowledged: true,
        payment_id: payment.id,
        message: "Giao dịch đã được xác nhận thanh toán trước đó",
      };
    }

    // 3. Kiểm tra trạng thái giao dịch & số tiền chuyển khoản
    const isSuccessCode =
      webhookBody.code === "00" && verifiedData.code === "00";
    if (!isSuccessCode) {
      await this.paymentRepo.updatePayment(payment.id, {
        status: "failed",
        gateway_response: webhookBody,
      });
      return {
        acknowledged: true,
        payment_id: payment.id,
        message: "Ghi nhận thanh toán thất bại",
      };
    }

    if (Number(verifiedData.amount) < Number(payment.amount)) {
      await this.paymentRepo.writeActivityLog(
        null,
        "PAYMENT_AMOUNT_MISMATCH",
        "payments",
        payment.id,
        { expected: payment.amount },
        { received: verifiedData.amount, webhook: webhookBody },
      );
      throw new AppError(
        "Số tiền thanh toán thực tế nhỏ hơn giá trị giao dịch",
        400,
      );
    }

    // 4. Cập nhật trạng thái giao dịch sang 'paid'
    const transactionId = verifiedData.reference || `PAYOS-${payosOrderCode}`;
    const updatedPayment = await this.paymentRepo.updatePayment(payment.id, {
      status: "paid",
      transaction_id: transactionId,
      paid_at: new Date().toISOString(),
      gateway_response: webhookBody,
    });

    // 5. Kích hoạt luồng nghiệp vụ tương ứng (Đơn hàng lẻ hoặc Gói định kỳ)
    if (payment.order_id) {
      await this.fulfillPaidOrder(payment.order_id, payment.amount);
    } else if (payment.subscription_id) {
      await this.fulfillPaidSubscription(
        payment.subscription_id,
        payment.amount,
      );
    }

    await this.paymentRepo.writeActivityLog(
      null,
      "PAYOS_WEBHOOK_PAID",
      "payments",
      payment.id,
      { status: "pending" },
      {
        status: "paid",
        transaction_id: transactionId,
        payos_order_code: payosOrderCode,
      },
    );

    return {
      acknowledged: true,
      payment_id: updatedPayment.id,
      status: updatedPayment.status,
      transaction_id: transactionId,
    };
  }

  private async fulfillPaidOrder(orderId: number, amount: number) {
    const order = await this.paymentRepo.findOrderForPayment(orderId);
    if (!order) return;

    if (order.status === "pending") {
      try {
        // Kích hoạt trừ kho tự động theo lô FEFO (UC01) ngay khi thanh toán thành công
        await this.paymentRepo.executeAllocateFefoRpc(order.id);
        await this.paymentRepo.confirmOrderAfterPayment(order.id);

        await this.paymentRepo.createNotification(
          order.customer_id,
          "PAYMENT_SUCCESS",
          "Thanh toán & Xác nhận đơn hàng thành công",
          `Đơn hàng ${order.order_number} (${Number(amount).toLocaleString("vi-VN")}đ) đã thanh toán qua VietQR và đang được chuẩn bị tại nông trại.`,
          "info",
        );
      } catch (fefoError: any) {
        // Trường hợp hết hàng đột xuất trong lúc khách đang quét QR:
        // Giữ nguyên payment = 'paid' và báo Sales xử lý (UC29) thay vì làm lỗi HTTP 500 Webhook
        await this.paymentRepo.writeActivityLog(
          null,
          "AUTO_FEFO_SHORTAGE_AFTER_PAYMENT",
          "orders",
          order.id,
          { status: order.status },
          { error: fefoError.message },
        );

        await this.paymentRepo.createNotification(
          order.customer_id,
          "PAYMENT_SUCCESS_PENDING_STOCK",
          "Thanh toán thành công - Đang điều phối hàng",
          `Hệ thống đã nhận ${Number(amount).toLocaleString("vi-VN")}đ cho đơn ${order.order_number}. Nhân viên CSKH sẽ liên hệ xác nhận lịch giao sớm nhất.`,
          "warning",
        );
      }
    }
  }

  private async fulfillPaidSubscription(
    subscriptionId: number,
    amount: number,
  ) {
    const sub =
      await this.paymentRepo.findSubscriptionForPayment(subscriptionId);
    if (!sub) return;

    if (sub.status === "pending_payment") {
      await this.paymentRepo.activateSubscriptionAfterPayment(sub.id);

      await this.paymentRepo.createNotification(
        sub.customer_id,
        "SUBSCRIPTION_ACTIVATED",
        "Kích hoạt gói nông sản định kỳ thành công",
        `Gói "${sub.package_name}" (${Number(amount).toLocaleString("vi-VN")}đ) đã được thanh toán và kích hoạt. Đơn hàng sẽ tự động giao theo lịch đã chọn.`,
        "info",
      );
    }
  }

  // ============================================================================
  // 3. XỬ LÝ RETURN URL TỪ PAYOS (GET /api/v1/payments/return/payos)
  // ============================================================================
  async handlePayosReturn(query: PayosReturnQuery) {
    const clientUrl = (
      process.env.CLIENT_URL || "http://localhost:5173"
    ).replace(/\/$/, "");
    const orderCode = query.orderCode ? Number(query.orderCode) : null;
    const isCancelled = query.cancel === "true" || query.status === "CANCELLED";

    let paymentInfo: any = null;

    if (orderCode) {
      const payment =
        await this.paymentRepo.findPaymentByPayosOrderCode(orderCode);
      if (payment) {
        if (isCancelled && payment.status === "pending") {
          await this.paymentRepo.updatePayment(payment.id, {
            status: "failed",
            gateway_response: query,
          });
        }
        paymentInfo = await this.paymentRepo.findPaymentById(payment.id);
      }
    }

    const finalStatus = isCancelled
      ? "cancelled"
      : paymentInfo?.status || query.status?.toLowerCase() || "pending";

    const redirectUrl = `${clientUrl}/payment/result?status=${encodeURIComponent(
      finalStatus,
    )}${orderCode ? `&orderCode=${orderCode}` : ""}${
      paymentInfo?.id ? `&paymentId=${paymentInfo.id}` : ""
    }`;

    return {
      redirect_url: redirectUrl,
      status: finalStatus,
      order_code: orderCode,
      payment: paymentInfo,
    };
  }

  // ============================================================================
  // 4. KIỂM TRA TRẠNG THÁI GIAO DỊCH (GET /api/v1/payments/:id/status)
  // ============================================================================
  async getPaymentStatus(
    paymentId: number,
    requester: { id: string; role: UserRole },
  ) {
    let payment = await this.paymentRepo.findPaymentById(paymentId);
    if (!payment) {
      throw new AppError("Không tìm thấy giao dịch thanh toán", 404);
    }

    // Kiểm tra quyền sở hữu nếu người gọi là Customer
    const ownerId =
      payment.order?.customer_id || payment.subscription?.customer_id;
    if (requester.role === USER_ROLES.CUSTOMER && ownerId !== requester.id) {
      throw new AppError(
        "Bạn không có quyền xem giao dịch thanh toán này (Forbidden)",
        403,
      );
    }

    // Đồng bộ trực tiếp với PayOS nếu giao dịch vẫn đang 'pending' (hữu ích khi test local chưa mở ngrok)
    if (
      payment.status === "pending" &&
      payment.payment_method === "payos" &&
      payment.payos_order_code
    ) {
      try {
        const liveInfo: any = await payos.paymentRequests.get(
          Number(payment.payos_order_code),
        );
        if (liveInfo?.status === "PAID") {
          await this.handlePayosWebhook({
            code: "00",
            desc: "success",
            data: {
              orderCode: Number(payment.payos_order_code),
              amount: Number(liveInfo.amountPaid || payment.amount),
              reference:
                liveInfo.transactions?.[0]?.reference ||
                `SYNC-${payment.payos_order_code}`,
              code: "00",
              desc: "success",
            },
            signature: "SYNC_FALLBACK",
          });
          payment = await this.paymentRepo.findPaymentById(paymentId);
        } else if (
          liveInfo?.status === "CANCELLED" ||
          liveInfo?.status === "EXPIRED"
        ) {
          await this.paymentRepo.updatePayment(payment.id, {
            status: "failed",
            gateway_response: liveInfo,
          });
          payment = await this.paymentRepo.findPaymentById(paymentId);
        }
      } catch {
        // Bỏ qua nếu không gọi được API đồng bộ trực tiếp, giữ nguyên trạng thái từ DB
      }
    }

    return {
      id: payment.id,
      order_id: payment.order_id,
      subscription_id: payment.subscription_id,
      payment_method: payment.payment_method,
      payment_type: payment.payment_type,
      transaction_id: payment.transaction_id,
      payos_order_code: payment.payos_order_code,
      amount: Number(payment.amount),
      status: payment.status,
      qr_code_url: payment.qr_code_url,
      expires_at: payment.expires_at,
      paid_at: payment.paid_at,
      created_at: payment.created_at,
      order: payment.order || null,
      subscription: payment.subscription || null,
    };
  }
}
