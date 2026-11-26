import { Response } from "express";

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = "Thành công",
  statusCode = 200,
) => {
  return res.status(statusCode).json({
    status: "success",
    message,
    data,
  });
};
