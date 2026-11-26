import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/authService";
import { sendSuccess } from "../utils/responseUtil";

const authService = new AuthService();

export class AuthController {
  // POST /api/v1/auth/register
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body);
      sendSuccess(res, result, "Đăng ký tài khoản thành công", 201);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/auth/login
  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body);
      sendSuccess(res, result, "Đăng nhập thành công");
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/auth/me
  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await authService.getMe(req.user!.id);
      sendSuccess(res, profile, "Lấy thông tin tài khoản thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/auth/refresh-token
  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await authService.refreshToken(req.body.refresh_token);
      sendSuccess(res, tokens, "Làm mới phiên đăng nhập thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/auth/logout
  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.logout(req.accessToken!);
      sendSuccess(res, null, "Đăng xuất thành công");
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/auth/change-password
  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.changePassword(req.user!.id, req.user!.email, req.body);
      sendSuccess(res, null, "Đổi mật khẩu thành công");
    } catch (error) {
      next(error);
    }
  };
}
