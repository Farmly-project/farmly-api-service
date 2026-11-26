export type BatchStatus = "growing" | "in_stock" | "sold_out";

export type FarmingStage =
  | "sowing"
  | "fertilizing"
  | "watering"
  | "pest_control"
  | "harvesting"
  | "packaging";

export type DisposalReason =
  | "damaged"
  | "rotten"
  | "expired"
  | "quality_failed"
  | "other";

export interface CreateBatchDTO {
  batch_code?: string;
  product_id: number;
  sowing_date?: string;
  harvest_date?: string;
  exp_date?: string;
  initial_quantity: number;
  status?: "growing" | "in_stock";
}

export interface BatchQueryParams {
  page?: number;
  limit?: number;
  product_id?: number;
  status?: BatchStatus;
  near_expiry?: boolean;
}

export interface FefoSuggestQuery {
  product_id: number;
  quantity?: number;
}

export interface FlashSaleBatchDTO {
  flash_sale_price: number | null;
  flash_sale_ends_at?: string | null;
}

export interface CreateFarmingLogDTO {
  stage: FarmingStage;
  title: string;
  description?: string;
  logged_at?: string;
  exp_date?: string; // Dùng nếu stage = 'harvesting' để chốt hạn dùng cho lô đang trồng
}

export interface CreateDisposalDTO {
  batch_id: number;
  quantity_disposed: number;
  reason: DisposalReason;
  note?: string;
}
