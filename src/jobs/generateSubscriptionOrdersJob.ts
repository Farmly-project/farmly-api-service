import cron from "node-cron";
import { SubscriptionService } from "../services/subscriptionService";

const subscriptionService = new SubscriptionService();

export const startGenerateSubscriptionOrdersJob = () => {
  // Chạy vào 00:00 mỗi ngày (phút 0, giờ 0)
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log(
        "[CRON 00:00] Bắt đầu quét lịch giao gói định kỳ để sinh đơn con...",
      );
      try {
        const result = await subscriptionService.generateOrdersForTomorrow();
        console.log(
          `[CRON 00:00] Hoàn tất sinh ${result.processed_count} đơn con cho ngày ${result.target_date} (${result.duration_ms}ms)`,
        );
      } catch (error) {
        console.error(
          "[CRON 00:00 ERROR] Lỗi sinh đơn con gói định kỳ:",
          error,
        );
      }
    },
    {
      timezone: "Asia/Ho_Chi_Minh",
    },
  );
};
