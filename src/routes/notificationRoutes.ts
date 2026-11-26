import { Router } from "express";
import { NotificationController } from "../controllers/notificationController";
import { verifyJWT } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import {
  notificationIdParamSchema,
  notificationsQuerySchema,
} from "../validators/dashboardValidator";

const router = Router();
const notificationController = new NotificationController();

router.use(verifyJWT);

// 1. Lấy danh sách thông báo cá nhân (STT 67)
router.get(
  "/",
  validate(notificationsQuerySchema),
  notificationController.getNotifications,
);

// 2. Đánh dấu tất cả thông báo đã đọc (khai báo TRƯỚC /:id/read)
router.patch("/read-all", notificationController.markAllAsRead);

// 3. Đánh dấu một thông báo đã đọc
router.patch(
  "/:id/read",
  validate(notificationIdParamSchema),
  notificationController.markAsRead,
);

export default router;
