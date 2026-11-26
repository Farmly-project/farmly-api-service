import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError";

export const globalErrorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message =
    err instanceof AppError
      ? err.message
      : "Đã xảy ra lỗi hệ thống nội bộ (Internal Server Error)";

  if (process.env.NODE_ENV !== "production") {
    console.error("[ERROR]:", err);
  }

  res.status(statusCode).json({
    status: "error",
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
