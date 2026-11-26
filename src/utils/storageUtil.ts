import { supabaseAdmin } from "../config/supabaseClient";
import { AppError } from "./appError";
import path from "path";
import crypto from "crypto";

export const uploadToSupabaseStorage = async (
  file: Express.Multer.File,
  bucket: string,
  folder: string,
): Promise<string> => {
  const ext = path.extname(file.originalname);
  const fileName = `${folder}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new AppError(
      `Lỗi tải tệp lên hệ thống lưu trữ: ${error.message}`,
      500,
    );
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
};
