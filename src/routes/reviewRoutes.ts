import { Router } from "express";
import { ReviewController } from "../controllers/reviewController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import { createReviewSchema } from "../validators/complaintValidator";

const router = Router();
const reviewController = new ReviewController();

// Customer: Đánh giá 1-5 sao kèm nhận xét cho sản phẩm đã mua ở đơn delivered (STT 61)
router.post(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER),
  validate(createReviewSchema),
  reviewController.createReview,
);

export default router;
