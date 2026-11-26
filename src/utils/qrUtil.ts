import QRCode from "qrcode";
import { AppError } from "./appError";

export interface GeneratedQrResult {
  trace_link: string;
  qr_image_base64: string;
}

export const generateBatchQrCode = async (
  batchCode: string,
): Promise<GeneratedQrResult> => {
  try {
    const clientUrl = (
      process.env.CLIENT_URL || "http://localhost:5173"
    ).replace(/\/$/, "");
    const traceLink = `${clientUrl}/trace/${encodeURIComponent(batchCode)}`;

    const qrImageBase64 = await QRCode.toDataURL(traceLink, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 400,
      margin: 2,
      color: {
        dark: "#14532d", // Xanh lá đậm đặc trưng thương hiệu Farmly
        light: "#ffffff",
      },
    });

    return {
      trace_link: traceLink,
      qr_image_base64: qrImageBase64,
    };
  } catch (error: any) {
    throw new AppError(`Lỗi sinh hình ảnh mã QR: ${error.message}`, 500);
  }
};
