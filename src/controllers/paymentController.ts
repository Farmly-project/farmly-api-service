import { Request, Response, NextFunction } from "express";
import { PaymentService } from "../services/paymentService";
import { sendSuccess } from "../utils/responseUtil";

const paymentService = new PaymentService();

export class PaymentController {
  // POST /api/v1/payments
  createPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.createPayosPayment(
        req.user!.id,
        req.body,
      );
      sendSuccess(
        res,
        result,
        "Tạo yêu cầu thanh toán VietQR PayOS thành công",
        201,
      );
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/payments/webhook/payos
  payosWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.handlePayosWebhook(req.body);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/payments/return/payos
  payosReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.handlePayosReturn(req.query as any);

      // Nếu gọi từ Postman/API client (format=json hoặc không nhận HTML) -> Trả JSON
      if (req.query.format === "json" || !req.accepts("html")) {
        return sendSuccess(
          res,
          result,
          "Xử lý kết quả trả về từ PayOS thành công",
        );
      }

      // Mặc định chuyển hướng trình duyệt về trang kết quả thanh toán trên Frontend
      return res.redirect(302, result.redirect_url);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/payments/:id/status
  getPaymentStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const statusData = await paymentService.getPaymentStatus(
        Number(req.params.id),
        {
          id: req.user!.id,
          role: req.user!.role,
        },
      );
      sendSuccess(
        res,
        statusData,
        "Lấy trạng thái giao dịch thanh toán thành công",
      );
    } catch (error) {
      next(error);
    }
  };
}
