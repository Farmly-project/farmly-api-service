import { Router } from "express";
import { DisposalController } from "../controllers/disposalController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { uploadSingleImage } from "../middlewares/uploadMiddleware";
import { USER_ROLES } from "../config/constants";
import { createDisposalSchema } from "../validators/batchValidator";

const router = Router();
const disposalController = new DisposalController();

// Farm Staff: Tạo phiếu xuất hủy hàng hỏng/dập nát kèm ảnh minh chứng
router.post(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.FARM_STAFF),
  uploadSingleImage,
  validate(createDisposalSchema),
  disposalController.create,
);

export default router;
