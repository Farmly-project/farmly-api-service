import { Router } from "express";
import { BatchController } from "../controllers/batchController";
import { FarmingLogController } from "../controllers/farmingLogController";
import farmingLogRoutes from "./farmingLogRoutes";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import {
  createBatchSchema,
  fefoSuggestQuerySchema,
  flashSaleBatchSchema,
  getBatchesQuerySchema,
} from "../validators/batchValidator";

const router = Router();
const batchController = new BatchController();
const farmingLogController = new FarmingLogController();

// LƯU Ý EXPRESS: Khai báo /fefo/suggest TRƯỚC /:id để tránh bị nhầm "fefo" là :id
router.get(
  "/fefo/suggest",
  verifyJWT,
  requireRole(USER_ROLES.SALES, USER_ROLES.ADMIN),
  validate(fefoSuggestQuerySchema),
  batchController.suggestFefo,
);

// Danh sách & chi tiết lô hàng (Farm Staff / Admin)
router.get(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.FARM_STAFF, USER_ROLES.ADMIN),
  validate(getBatchesQuerySchema),
  batchController.getAll,
);

router.get(
  "/:id",
  verifyJWT,
  requireRole(USER_ROLES.FARM_STAFF, USER_ROLES.ADMIN),
  batchController.getById,
);

// Khởi tạo lô hàng mới (Farm Staff)
router.post(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.FARM_STAFF, USER_ROLES.ADMIN),
  validate(createBatchSchema),
  batchController.create,
);

// Cấu hình xả hàng cận hạn Flash Sale (Sales)
router.patch(
  "/:id/flash-sale",
  verifyJWT,
  requireRole(USER_ROLES.SALES, USER_ROLES.ADMIN),
  validate(flashSaleBatchSchema),
  batchController.setFlashSale,
);

// Sinh mã QR cho lô đã thu hoạch (Farm Staff)
router.post(
  "/:batchId/qr-code",
  verifyJWT,
  requireRole(USER_ROLES.FARM_STAFF, USER_ROLES.ADMIN),
  farmingLogController.generateQr,
);

// Gắn sub-route nhật ký canh tác: /api/v1/batches/:batchId/farming-logs
router.use("/:batchId/farming-logs", farmingLogRoutes);

export default router;
