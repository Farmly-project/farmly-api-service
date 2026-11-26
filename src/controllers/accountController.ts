import { Request, Response, NextFunction } from "express";
import { DashboardService } from "../services/dashboardService";
import { sendSuccess } from "../utils/responseUtil";

const dashboardService = new DashboardService();

export class AccountController {
  // GET /api/v1/accounts
  getAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await dashboardService.getStaffAccounts(req.query as any);
      sendSuccess(res, result, "Lấy danh sách tài khoản nhân viên thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/accounts
  createAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = await dashboardService.createStaffAccount(
        req.user!.id,
        req.body,
      );
      sendSuccess(
        res,
        created,
        "Khởi tạo tài khoản nhân viên mới thành công",
        201,
      );
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/accounts/:id/status
  updateAccountStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const updated = await dashboardService.updateStaffAccountStatus(
        req.user!.id,
        String(req.params.id),
        req.body,
      );
      const msg = req.body.is_active
        ? "Mở khóa tài khoản nhân viên thành công"
        : "Đã khóa tài khoản nhân viên";
      sendSuccess(res, updated, msg);
    } catch (error) {
      next(error);
    }
  };
}
