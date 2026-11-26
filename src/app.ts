import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import apiRoutes from "./routes";
import { AppError } from "./utils/appError";
import { globalErrorHandler } from "./middlewares/errorHandler";

const app: Application = express();

// 1. Bảo mật HTTP Headers & CORS
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-guest-token"],
  }),
);

// 2. Ghi log HTTP Request
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// 3. Body Parsers (Giới hạn JSON body 10MB, upload file lớn xử lý riêng qua Multer)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 4. Health Check Endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    service: "Farmly API Service",
    timestamp: new Date().toISOString(),
  });
});

// 5. Định tuyến RESTful API chính (/api/v1)
app.use("/api/v1", apiRoutes);

// 6. Bắt lỗi 404 cho các route không tồn tại
app.use((req, res, next) => {
  next(new AppError(`Không tìm thấy đường dẫn ${req.originalUrl}`, 404));
});

// 7. Bộ bắt lỗi tập trung (Global Error Handler)
app.use(globalErrorHandler);

export default app;
