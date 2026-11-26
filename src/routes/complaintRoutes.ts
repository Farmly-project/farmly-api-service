import { Router } from "express";
import { ComplaintController } from "../controllers/complaintController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import {
  complaintIdParamSchema,
  getComplaintsQuerySchema,
  handleComplaintSchema,
} from "../validators/complaintValidator";

const router = Router();
const complaintController = new ComplaintController();

// 1. Sales / Admin: Danh sách hàng đợi khiếu nại chưa xử lý (STT 58)
router.get(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.SALES, USER_ROLES.ADMIN),
  validate(getComplaintsQuerySchema),
  complaintController.getComplaints,
);

// 2. Customer / Sales / Admin: Xem chi tiết khiếu nại & ảnh/video minh chứng (STT 59)
router.get(
  "/:id",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER, USER_ROLES.SALES, USER_ROLES.ADMIN),
  validate(complaintIdParamSchema),
  complaintController.getComplaintById,
);

// 3. Sales / Admin: Duyệt khiếu nại -> Hoàn tiền qua PayOS hoặc Tạo đơn giao bù 0đ (STT 60)
router.patch(
  "/:id/handle",
  verifyJWT,
  requireRole(USER_ROLES.SALES, USER_ROLES.ADMIN),
  validate(handleComplaintSchema),
  complaintController.handleComplaint,
);

export default router;
