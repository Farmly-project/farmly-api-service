import { Router } from "express";
import { DashboardController } from "../controllers/dashboardController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import { updateSettingsSchema } from "../validators/dashboardValidator";

const router = Router();
const dashboardController = new DashboardController();

router.use(verifyJWT, requireRole(USER_ROLES.ADMIN));

// Xem cấu hình tham số hệ thống hiện tại
router.get("/", dashboardController.getSettings);

// Cập nhật cấu hình tham số hệ thống (ngưỡng cảnh báo hết hạn, phí ship/km, tọa độ farm) (STT 71)
router.put(
  "/",
  validate(updateSettingsSchema),
  dashboardController.updateSettings,
);

export default router;
