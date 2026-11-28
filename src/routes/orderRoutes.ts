import { Router } from "express";
import { OrderController } from "../controllers/orderController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import {
  calculateShippingSchema,
  cancelOrderSchema,
  createOrderSchema,
  getOrdersQuerySchema,
  updateOrderStatusSchema,
} from "../validators/orderValidator";
import { ComplaintController } from "../controllers/complaintController";
import { uploadComplaintEvidence } from "../middlewares/uploadMiddleware";
import { createComplaintSchema } from "../validators/complaintValidator";
const router = Router();
const orderController = new OrderController();
const complaintController = new ComplaintController();
// Public / Customer: Tính phí ship động theo km từ nông trại
router.post(
  "/calculate-shipping",
  validate(calculateShippingSchema),
  orderController.calculateShipping,
);

// Customer: Xem lịch sử đơn hàng cá nhân
router.get(
  "/my-orders",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER),
  validate(getOrdersQuerySchema),
  orderController.getMyOrders,
);

// Customer: Tạo đơn hàng lẻ trực tiếp
router.post(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER),
  validate(createOrderSchema),
  orderController.createOrder,
);

// Sales / Admin: Danh sách đơn hàng toàn hệ thống (lọc theo trạng thái)
router.get(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.SALES, USER_ROLES.ADMIN),
  validate(getOrdersQuerySchema),
  orderController.getAllOrders,
);

// Customer / Sales / Admin: Xem chi tiết đơn hàng (kèm phân bổ lô order_details)
router.get(
  "/:id",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER, USER_ROLES.SALES, USER_ROLES.ADMIN),
  orderController.getOrderById,
);

// Sales: Duyệt đơn hàng -> Kích hoạt RPC allocate_fefo() trừ kho tự động
router.post(
  "/:id/confirm",
  verifyJWT,
  requireRole(USER_ROLES.SALES, USER_ROLES.ADMIN),
  orderController.confirmOrder,
);

// Sales / Admin: Cập nhật trạng thái giao hàng (preparing -> shipping -> delivered / cancelled)
router.patch(
  "/:id/status",
  verifyJWT,
  requireRole(USER_ROLES.SALES, USER_ROLES.ADMIN),
  validate(updateOrderStatusSchema),
  orderController.updateStatus,
);

// Customer / Sales: Hủy đơn hàng khi chưa xác nhận
router.patch(
  "/:id/cancel",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER, USER_ROLES.SALES, USER_ROLES.ADMIN),
  validate(cancelOrderSchema),
  orderController.cancelOrder,
);

router.post(
  "/:orderItemId/complaints",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER),
  uploadComplaintEvidence,
  validate(createComplaintSchema),
  complaintController.createComplaint,
);

export default router;
