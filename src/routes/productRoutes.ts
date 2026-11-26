import { Router } from "express";
import { ProductController } from "../controllers/productController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { uploadCertificationFile } from "../middlewares/uploadMiddleware";
import { USER_ROLES } from "../config/constants";
import {
  createProductSchema,
  getProductsQuerySchema,
  updateProductSchema,
  uploadCertificationSchema,
} from "../validators/productValidator";
import { ReviewController } from "../controllers/reviewController";
import { getProductReviewsSchema } from "../validators/complaintValidator";
const router = Router();
const productController = new ProductController();
const reviewController = new ReviewController();
// Public Routes (UC07: Xem & tìm kiếm sản phẩm)
router.get("/", validate(getProductsQuerySchema), productController.getAll);
router.get("/:id", productController.getById);

// Admin Routes (UC25: Quản lý sản phẩm & chứng nhận kiểm định)
router.post(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.ADMIN),
  validate(createProductSchema),
  productController.create,
);

router.put(
  "/:id",
  verifyJWT,
  requireRole(USER_ROLES.ADMIN),
  validate(updateProductSchema),
  productController.update,
);

router.delete(
  "/:id",
  verifyJWT,
  requireRole(USER_ROLES.ADMIN),
  productController.remove,
);

// Upload file scan chứng nhận VietGAP/USDA (Lưu ý: uploadCertificationFile chạy trước validate để Multer parse req.body từ multipart/form-data)
router.post(
  "/:productId/certifications",
  verifyJWT,
  requireRole(USER_ROLES.ADMIN),
  uploadCertificationFile,
  validate(uploadCertificationSchema),
  productController.uploadCertification,
);
router.get(
  "/:productId/reviews",
  validate(getProductReviewsSchema),
  reviewController.getProductReviews,
);
export default router;
