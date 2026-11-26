import { Router } from "express";
import { AccountController } from "../controllers/accountController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import {
  createStaffAccountSchema,
  getAccountsQuerySchema,
  updateAccountStatusSchema,
} from "../validators/dashboardValidator";

const router = Router();
const accountController = new AccountController();

router.use(verifyJWT, requireRole(USER_ROLES.ADMIN));

// 1. Danh sách tài khoản nhân viên farm_staff, sales (STT 68)
router.get(
  "/",
  validate(getAccountsQuerySchema),
  accountController.getAccounts,
);

// 2. Khởi tạo tài khoản nhân viên mới (STT 69)
router.post(
  "/",
  validate(createStaffAccountSchema),
  accountController.createAccount,
);

// 3. Khóa / Mở khóa tài khoản nhân viên (STT 70)
router.patch(
  "/:id/status",
  validate(updateAccountStatusSchema),
  accountController.updateAccountStatus,
);

export default router;
