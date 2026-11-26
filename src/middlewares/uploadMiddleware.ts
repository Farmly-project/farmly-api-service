import multer from "multer";
import { Request } from "express";
import { AppError } from "../utils/appError";
import { COMPLAINT_CONFIG } from "../config/constants";

const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_MIMES = ["video/mp4", "video/quicktime"];
const ALLOWED_ALL_MIMES = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES];

const storage = multer.memoryStorage();

// 1. File chứng nhận chất lượng (JPG/PNG/WEBP/PDF <= 5MB)
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
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("file");

// 2. Ảnh minh chứng xuất hủy (JPG/PNG/WEBP <= 5MB)
const imageOnlyFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Chỉ chấp nhận hình ảnh định dạng JPG, PNG hoặc WEBP (<= 5MB)",
        400,
      ),
    );
  }
};

export const uploadSingleImage = multer({
  storage,
  fileFilter: imageOnlyFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("file");

// 3. Ảnh/Video nhật ký canh tác & khiếu nại (JPG/PNG/WEBP/MP4/MOV <= 50MB)
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

export const uploadSingleMedia = multer({
  storage,
  fileFilter: mediaFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
}).single("file");

export const uploadMediaFiles = multer({
  storage,
  fileFilter: mediaFileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 5 },
}).array("files", 5);

const complaintFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  // Kiểm tra MIME type thực tế tại Backend (UC03 - E2 & NFR-S08)
  if (!ALLOWED_ALL_MIMES.includes(file.mimetype)) {
    return cb(
      new AppError(
        `Định dạng tệp "${file.originalname}" không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP, MP4, MOV`,
        400,
      ),
    );
  }
  cb(null, true);
};

export const uploadComplaintEvidence = multer({
  storage,
  fileFilter: complaintFileFilter,
  limits: {
    files: COMPLAINT_CONFIG.MAX_FILES,
    fileSize: COMPLAINT_CONFIG.MAX_VIDEO_SIZE_KB * 1024, // Giới hạn trần 50MB; ảnh > 5MB sẽ kiểm tra chi tiết ở Service
  },
}).array("media", COMPLAINT_CONFIG.MAX_FILES);
