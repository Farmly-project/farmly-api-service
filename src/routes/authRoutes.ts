import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { verifyJWT } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from "../validators/authValidator";

const router = Router();
const authController = new AuthController();

// Public routes (Guest)
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post(
  "/refresh-token",
  validate(refreshTokenSchema),
  authController.refreshToken,
);

// Authenticated routes (Tất cả user đã đăng nhập)
router.get("/me", verifyJWT, authController.getMe);
router.post("/logout", verifyJWT, authController.logout);
router.patch(
  "/change-password",
  verifyJWT,
  validate(changePasswordSchema),
  authController.changePassword,
);

export default router;
