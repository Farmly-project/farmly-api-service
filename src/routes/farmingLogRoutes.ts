import { Router } from "express";
import { FarmingLogController } from "../controllers/farmingLogController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { uploadSingleMedia } from "../middlewares/uploadMiddleware";
import { USER_ROLES } from "../config/constants";
import { createFarmingLogSchema } from "../validators/batchValidator";

// mergeParams: true để nhận :batchId từ batchRoutes
const router = Router({ mergeParams: true });
const farmingLogController = new FarmingLogController();

// Public: Xem dòng thời gian canh tác của lô hàng
router.get("/", farmingLogController.getTimeline);

// Farm Staff: Thêm nhật ký canh tác kèm ảnh/video
router.post(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.FARM_STAFF),
  uploadSingleMedia,
  validate(createFarmingLogSchema),
  farmingLogController.createLog,
);

export default router;
