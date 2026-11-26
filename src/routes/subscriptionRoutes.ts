import { Router, Request, Response, NextFunction } from "express";
import { SubscriptionController } from "../controllers/subscriptionController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import { AppError } from "../utils/appError";
import {
  createSubscriptionSchema,
  generateOrdersCronSchema,
  getSubscriptionsQuerySchema,
  subscriptionIdParamSchema,
} from "../validators/subscriptionValidator";

const router = Router();
const subscriptionController = new SubscriptionController();

/**
 * Middleware cho phép gọi Cron API bằng header x-cron-secret (từ hệ thống lập lịch ngoài)
 * HOẶC bằng JWT của Admin (khi kiểm thử thủ công trên Postman/Dashboard)
 */
const verifyCronOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const cronSecretHeader = req.headers["x-cron-secret"];
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && cronSecretHeader === expectedSecret) {
    return next();
  }

  return verifyJWT(req, res, (err?: any) => {
    if (err) {
      return next(
        new AppError(
          "Thiếu x-cron-secret hợp lệ hoặc quyền Admin để kích hoạt Cronjob",
          401,
        ),
      );
    }
    return requireRole(USER_ROLES.ADMIN)(req, res, next);
  });
};

// 1. Customer: Xem danh sách các gói định kỳ cá nhân
router.get(
  "/my-subscriptions",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER),
  validate(getSubscriptionsQuerySchema),
  subscriptionController.getMySubscriptions,
);

// 2. System Cron / Admin: Sinh đơn con cho lịch giao ngày hôm sau
router.post(
  "/cron/generate-orders",
  verifyCronOrAdmin,
  validate(generateOrdersCronSchema),
  subscriptionController.generateOrdersCron,
);

// 3. Customer: Đăng ký gói mua nông sản định kỳ mới
router.post(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER),
  validate(createSubscriptionSchema),
  subscriptionController.create,
);

// 4. Customer / Sales / Admin: Chi tiết gói và danh sách lịch giao delivery_schedules
router.get(
  "/:id",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER, USER_ROLES.SALES, USER_ROLES.ADMIN),
  validate(subscriptionIdParamSchema),
  subscriptionController.getById,
);

// 5. Customer: Tạm dừng gói định kỳ
router.patch(
  "/:id/pause",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER),
  validate(subscriptionIdParamSchema),
  subscriptionController.pause,
);

// 6. Customer: Hủy gói định kỳ
router.patch(
  "/:id/cancel",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER),
  validate(subscriptionIdParamSchema),
  subscriptionController.cancel,
);

export default router;
