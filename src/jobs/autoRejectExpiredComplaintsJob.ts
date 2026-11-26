import cron from "node-cron";
import { ComplaintService } from "../services/complaintService";

const complaintService = new ComplaintService();

export const startAutoRejectExpiredComplaintsJob = () => {
  // Quét mỗi giờ một lần (phút 0) để đóng các khiếu nại quá hạn 24h (UC32)
  cron.schedule(
    "0 * * * *",
    async () => {
      try {
        const result = await complaintService.processExpiredPendingComplaints();
        if (result.processed_count > 0) {
          console.log(
            `[CRON COMPLAINTS] Đã tự động đóng ${result.processed_count} khiếu nại quá hạn 24h:`,
            result.complaint_ids,
          );
        }
      } catch (error) {
        console.error(
          "[CRON COMPLAINTS ERROR] Lỗi quét khiếu nại quá hạn:",
          error,
        );
      }
    },
    {
      timezone: "Asia/Ho_Chi_Minh",
    },
  );
};
