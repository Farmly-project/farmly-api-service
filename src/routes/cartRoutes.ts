import { Router } from "express";
import { CartController } from "../controllers/cartController";
import {
  optionalVerifyJWT,
  verifyJWT,
  requireRole,
} from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import {
  addCartItemSchema,
  checkoutCartSchema,
  updateCartItemSchema,
} from "../validators/orderValidator";

const router = Router();
const cartController = new CartController();

// Public / Customer (Hỗ trợ cả Bearer Token lẫn header x-guest-token)
router.get("/", optionalVerifyJWT, cartController.getCart);
router.post(
  "/items",
  optionalVerifyJWT,
  validate(addCartItemSchema),
  cartController.addItem,
);
router.put(
  "/items/:itemId",
  optionalVerifyJWT,
  validate(updateCartItemSchema),
  cartController.updateItem,
);
router.delete("/items/:itemId", optionalVerifyJWT, cartController.removeItem);

// Customer Only (Chuyển đổi giỏ hàng thành đơn hàng - UC06)
router.post(
  "/checkout",
  verifyJWT,
  requireRole(USER_ROLES.CUSTOMER),
  validate(checkoutCartSchema),
  cartController.checkout,
);

export default router;
