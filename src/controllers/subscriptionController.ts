import { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../services/subscriptionService";
import { sendSuccess } from "../utils/responseUtil";

const subscriptionService = new SubscriptionService();

export class SubscriptionController {
  // POST /api/v1/subscriptions
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await subscriptionService.createSubscription(
        req.user!.id,
        req.body,
      );
      sendSuccess(
        res,
        result,
        "Đăng ký gói mua nông sản định kỳ thành công",
        201,
      );
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/subscriptions/my-subscriptions
  getMySubscriptions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await subscriptionService.getMySubscriptions(
        req.user!.id,
        req.query as any,
      );
      sendSuccess(res, result, "Lấy danh sách gói định kỳ cá nhân thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/subscriptions/cron/generate-orders
  generateOrdersCron = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const targetDate = req.body?.target_date;
      const result =
        await subscriptionService.generateOrdersForTomorrow(targetDate);
      sendSuccess(
        res,
        result,
        `Đã hoàn tất tác vụ sinh đơn con gói định kỳ cho ngày ${result.target_date}`,
      );
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/subscriptions/:id
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await subscriptionService.getSubscriptionDetail(
        Number(req.params.id),
        {
          id: req.user!.id,
          role: req.user!.role,
        },
      );
      sendSuccess(res, sub, "Lấy chi tiết gói định kỳ thành công");
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/subscriptions/:id/pause
  pause = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await subscriptionService.pauseSubscription(
        req.user!.id,
        Number(req.params.id),
      );
      sendSuccess(res, updated, "Tạm dừng gói định kỳ thành công");
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/subscriptions/:id/cancel
  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await subscriptionService.cancelSubscription(
        req.user!.id,
        Number(req.params.id),
      );
      sendSuccess(res, updated, "Hủy gói định kỳ thành công");
    } catch (error) {
      next(error);
    }
  };
}
