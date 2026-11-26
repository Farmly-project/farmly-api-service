import { Request, Response, NextFunction } from "express";
import { DashboardService } from "../services/dashboardService";
import { sendSuccess } from "../utils/responseUtil";

const dashboardService = new DashboardService();

export class DashboardController {
  // GET /api/v1/dashboard/summary
  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await dashboardService.getDashboardSummary(req.query as any);
      sendSuccess(res, data, "Lấy thống kê tổng quan thành công");
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/dashboard/revenue-by-day
  getRevenueByDay = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await dashboardService.getRevenueByDay(req.query as any);
      sendSuccess(res, data, "Lấy biểu đồ doanh thu theo ngày thành công");
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/dashboard/disposal-report
  getDisposalReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await dashboardService.getDisposalReport(req.query as any);
      sendSuccess(res, data, "Lấy báo cáo tỷ lệ xuất hủy theo lô thành công");
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/dashboard/export-excel
  exportExcel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { buffer, filename } = await dashboardService.exportDashboardExcel(
        req.query as any,
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      );
      res.setHeader("Content-Length", buffer.length);

      return res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/settings
  getSettings = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await dashboardService.getSystemSettings();
      sendSuccess(res, settings, "Lấy cấu hình tham số hệ thống thành công");
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v1/settings
  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await dashboardService.updateSystemSettings(
        req.user!.id,
        req.body,
      );
      sendSuccess(
        res,
        updated,
        "Cập nhật cấu hình tham số hệ thống thành công",
      );
    } catch (error) {
      next(error);
    }
  };
}
