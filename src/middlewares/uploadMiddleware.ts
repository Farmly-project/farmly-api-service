import multer from "multer";
import { Request } from "express";
import { AppError } from "../utils/appError";

const storage = multer.memoryStorage();

// Bộ lọc cho file chứng nhận chất lượng (Ảnh JPG/PNG/WEBP hoặc PDF <= 5MB)
const certFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Chỉ chấp nhận định dạng JPG, PNG, WEBP hoặc PDF (400 Bad Request)",
        400,
      ),
    );
  }
};

export const uploadCertificationFile = multer({
  storage,
  fileFilter: certFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB (NFR-P04)
  },
}).single("file");

// Bộ lọc dùng chung cho ảnh/video khiếu nại hoặc nhật ký (tối đa 5 file, <= 50MB)
const mediaFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/quicktime",
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Định dạng tệp không hợp lệ (chỉ nhận JPG, PNG, WEBP, MP4, MOV)",
        400,
      ),
    );
  }
};

export const uploadMediaFiles = multer({
  storage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 5,
  },
}).array("files", 5);
