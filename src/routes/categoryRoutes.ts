import { Router } from "express";
import { CategoryController } from "../controllers/categoryController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validators/productValidator";

const router = Router();
const categoryController = new CategoryController();

// Public Routes (Guest & Customer)
router.get("/", categoryController.getAll);
router.get("/:id", categoryController.getById);

// Admin Routes (Quản lý danh mục)
router.post(
  "/",
  verifyJWT,
  requireRole(USER_ROLES.ADMIN),
  validate(createCategorySchema),
  categoryController.create,
);

router.put(
  "/:id",
  verifyJWT,
  requireRole(USER_ROLES.ADMIN),
  validate(updateCategorySchema),
  categoryController.update,
);

router.delete(
  "/:id",
  verifyJWT,
  requireRole(USER_ROLES.ADMIN),
  categoryController.remove,
);

export default router;
