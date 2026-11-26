import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/authService";
import { sendSuccess } from "../utils/responseUtil";

const authService = new AuthService();

export class ProfileController {
  // GET /api/v1/profile
  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await authService.getMe(req.user!.id);
      sendSuccess(res, profile, "Lấy thông tin hồ sơ thành công");
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/profile
  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await authService.updateProfile(req.user!.id, req.body);
      sendSuccess(res, updated, "Cập nhật hồ sơ thành công");
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/profile/addresses
  getAddresses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const addresses = await authService.getAddresses(req.user!.id);
      sendSuccess(res, addresses, "Lấy danh sách sổ địa chỉ thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/profile/addresses
  addAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = await authService.addAddress(req.user!.id, req.body);
      sendSuccess(res, address, "Thêm địa chỉ giao hàng mới thành công", 201);
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/profile/addresses/:id
  updateAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const addressId = Number(req.params.id);
      const updated = await authService.updateAddress(
        req.user!.id,
        addressId,
        req.body,
      );
      sendSuccess(res, updated, "Cập nhật địa chỉ thành công");
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/v1/profile/addresses/:id
  deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const addressId = Number(req.params.id);
      await authService.deleteAddress(req.user!.id, addressId);
      sendSuccess(res, null, "Đã xóa địa chỉ khỏi sổ địa chỉ");
    } catch (error) {
      next(error);
    }
  };
}
