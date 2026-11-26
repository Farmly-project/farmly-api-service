import {
  ComplaintReason,
  ComplaintResolution,
  ComplaintStatus,
} from "../config/constants";

export type MediaType = "image" | "video";

export interface UploadedEvidenceFile {
  media_type: MediaType;
  url: string;
  size_kb: number;
}

export interface CreateComplaintDTO {
  quantity_affected: number;
  reason: ComplaintReason;
  description?: string;
  requested_resolution: ComplaintResolution;
}

export interface ComplaintQueryParams {
  page?: number;
  limit?: number;
  status?: ComplaintStatus;
}

export interface HandleComplaintDTO {
  action: "approve" | "reject";
  resolution?: ComplaintResolution; // Bắt buộc khi action = 'approve' ('refund' | 'replacement')
  refund_amount?: number; // Tùy chọn khi resolution = 'refund' (mặc định = đơn giá * số lượng lỗi)
  sales_note?: string; // Bắt buộc khi action = 'reject' (chk_complaint_reject_note)
  auto_confirm_replacement?: boolean; // Tùy chọn trừ kho FEFO ngay khi tạo đơn giao bù 0đ
}

export interface CreateReviewDTO {
  order_item_id: number;
  rating: number;
  comment?: string;
}

export interface ProductReviewQueryParams {
  page?: number;
  limit?: number;
  rating?: number;
}
