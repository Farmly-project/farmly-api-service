import cron from "node-cron";
import { DashboardService } from "../services/dashboardService";

const dashboardService = new DashboardService();

export const startNearExpiryAlertJob = () => {
  // Chạy lúc 06:00 sáng mỗi ngày theo giờ Việt Nam (UC05 Bước 6 & UC19)
  cron.schedule(
    "0 6 * * *",
    async () => {
      console.log(
        "[CRON 06:00] Bắt đầu quét lô nông sản sắp hết hạn sử dụng...",
      );
      try {
        const result = await dashboardService.scanNearExpiryBatches();
        console.log(
          `[CRON 06:00] Hoàn tất quét ngày ${result.scanned_date} (ngưỡng ${result.warning_days} ngày): ${result.near_expiry_count} lô sắp hết hạn, ${result.expired_count} lô đã quá hạn.`,
        );
      } catch (error) {
        console.error("[CRON 06:00 ERROR] Lỗi quét lô sắp hết hạn:", error);
      }
    },
    {
      timezone: "Asia/Ho_Chi_Minh",
    },
  );
};
