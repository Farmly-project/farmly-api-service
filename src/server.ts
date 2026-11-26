import dotenv from "dotenv";
dotenv.config();

import app from "./app";

// Kiểm tra các biến môi trường cốt lõi trước khi khởi chạy server
const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error(
    `[FATAL ERROR] Thiếu biến môi trường bắt buộc trong file .env: ${missingEnvVars.join(", ")}`,
  );
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
  console.log("======================================================");
  console.log(
    ` Farmly Backend API đang chạy ở chế độ: ${process.env.NODE_ENV || "development"}`,
  );
  console.log(` Server lắng nghe tại: http://localhost:${PORT}/api/v1`);
  console.log("======================================================");

  // Khởi chạy các Cronjobs định kỳ (00:00 sinh đơn gói, 06:00 cảnh báo cận hạn...)
  // initCronJobs();
});

// Bắt các lỗi Promise không được catch (Unhandled Rejection)
process.on("unhandledRejection", (err: Error) => {
  console.error(
    "[UNHANDLED REJECTION] Đang tắt server an toàn...",
    err.name,
    err.message,
  );
  server.close(() => {
    process.exit(1);
  });
});

// Bắt các ngoại lệ không được xử lý (Uncaught Exception)
process.on("uncaughtException", (err: Error) => {
  console.error(
    "[UNCAUGHT EXCEPTION] Đang tắt server ngay lập tức...",
    err.name,
    err.message,
  );
  process.exit(1);
});

// Xử lý tín hiệu dừng từ hệ điều hành / Docker / Render (SIGTERM)
process.on("SIGTERM", () => {
  console.log("[SIGTERM] Nhận tín hiệu dừng, đang đóng các kết nối HTTP...");
  server.close(() => {
    console.log("Server đã dừng hoàn toàn.");
  });
});
