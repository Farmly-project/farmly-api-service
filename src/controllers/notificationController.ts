import { Request, Response, NextFunction } from "express";
import { DashboardService } from "../services/dashboardService";
import { sendSuccess } from "../utils/responseUtil";

const dashboardService = new DashboardService();

export class NotificationController {
  // GET /api/v1/notifications
  getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await dashboardService.getMyNotifications(
        req.user!.id,
        req.query as any,
      );
      sendSuccess(res, result, "Lấy danh sách thông báo thành công");
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/notifications/:id/read
  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await dashboardService.markNotificationRead(
        Number(req.params.id),
        req.user!.id,
      );
      sendSuccess(res, updated, "Đã đánh dấu thông báo đã đọc");
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/notifications/read-all
  markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await dashboardService.markAllNotificationsRead(
        req.user!.id,
      );
      sendSuccess(res, result, "Đã đánh dấu tất cả thông báo là đã đọc");
    } catch (error) {
      next(error);
    }
  };
}
