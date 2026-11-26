import { Router } from "express";
import { PaymentController } from "../controllers/paymentController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import {
  createPaymentSchema,
  paymentIdParamSchema,
  payosReturnQuerySchema,
} from "../validators/paymentValidator";

const router = Router();
const paymentController = new PaymentController();

// 1. System / PayOS Gateway: Tiếp nhận Webhook IPN callback (Public, xác thực qua HMAC signature)
router.post("/webhook/payos", paymentController.payosWebhook);

// 2. Public: Return URL chuyển hướng trình duyệt sau khi thanh toán trên PayOS
router.get(
  "/return/payos",
  validate(payosReturnQuerySchema),
  paymentController.payosReturn,
);

// 3. Customer: Tạo yêu cầu thanh toán VietQR / PayOS cho đơn hàng hoặc gói định kỳ
router.post(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER),
  validate(createPaymentSchema),
  paymentController.createPayment,
);

// 4. Customer / Sales / Admin: Kiểm tra trạng thái giao dịch thanh toán
router.get(
  "/:id/status",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER, USER_ROLES.SALES, USER_ROLES.ADMIN),
  validate(paymentIdParamSchema),
  paymentController.getPaymentStatus,
);

export default router;
