import { Router } from "express";
import { ProfileController } from "../controllers/profileController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import {
  createAddressSchema,
  updateAddressSchema,
  updateProfileSchema,
} from "../validators/authValidator";

const router = Router();
const profileController = new ProfileController();

// Toàn bộ route /profile yêu cầu đăng nhập với vai trò CUSTOMER
router.use(verifyJWT, requireRole(USER_ROLES.CUSTOMER));

router.get("/", profileController.getProfile);
router.patch(
  "/",
  validate(updateProfileSchema),
  profileController.updateProfile,
);

router.get("/addresses", profileController.getAddresses);
router.post(
  "/addresses",
  validate(createAddressSchema),
  profileController.addAddress,
);
router.patch(
  "/addresses/:id",
  validate(updateAddressSchema),
  profileController.updateAddress,
);
router.delete("/addresses/:id", profileController.deleteAddress);

export default router;
