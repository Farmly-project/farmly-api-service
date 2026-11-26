import { ScheduleStatus, SubscriptionStatus } from "../config/constants";

export interface SubscriptionItemInputDTO {
  product_id: number;
  quantity: number;
}

export interface CreateSubscriptionDTO {
  package_name?: string;
  items: SubscriptionItemInputDTO[];
  /**
   * Các thứ giao trong tuần theo chuẩn JS getUTCDay():
   * 0 = Chủ Nhật, 1 = Thứ 2, 2 = Thứ 3, 3 = Thứ 4, 4 = Thứ 5, 5 = Thứ 6, 6 = Thứ 7
   */
  delivery_days: number[];
  start_date: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD (Nếu bỏ trống sẽ tự tính theo duration_weeks, mặc định 4 tuần)
  duration_weeks?: number;
  address_id?: number;
  shipping_address?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
}

export interface SubscriptionQueryParams {
  page?: number;
  limit?: number;
  status?: SubscriptionStatus;
}

export interface GenerateOrdersCronBody {
  target_date?: string; // Tùy chọn YYYY-MM-DD để test thủ công trên Postman; mặc định là ngày mai
}

export interface SubscriptionScheduleItem {
  id: number;
  subscription_id: number;
  delivery_date: string;
  status: ScheduleStatus;
  order_id: number | null;
  created_at: string;
}
