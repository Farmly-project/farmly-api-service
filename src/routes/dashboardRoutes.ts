import { Router } from "express";
import { DashboardController } from "../controllers/dashboardController";
import { verifyJWT, requireRole } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { USER_ROLES } from "../config/constants";
import {
  dashboardDateRangeSchema,
  exportExcelQuerySchema,
} from "../validators/dashboardValidator";

const router = Router();
const dashboardController = new DashboardController();

// Tất cả API báo cáo thống kê đều yêu cầu quyền ADMIN (UC08 - E3)
router.use(verifyJWT, requireRole(USER_ROLES.ADMIN));

// 1. Thống kê chỉ số tổng quan (STT 63)
router.get(
  "/summary",
  validate(dashboardDateRangeSchema),
  dashboardController.getSummary,
);

// 2. Biểu đồ doanh thu thực tế theo ngày (STT 64)
router.get(
  "/revenue-by-day",
  validate(dashboardDateRangeSchema),
  dashboardController.getRevenueByDay,
);

// 3. Báo cáo tỷ lệ xuất hủy / hao hụt theo từng Lô hàng (STT 65)
router.get(
  "/disposal-report",
  validate(dashboardDateRangeSchema),
  dashboardController.getDisposalReport,
);

// 4. Xuất dữ liệu báo cáo thống kê ra file Excel .xlsx (STT 66)
router.get(
  "/export-excel",
  validate(exportExcelQuerySchema),
  dashboardController.exportExcel,
);

export default router;
