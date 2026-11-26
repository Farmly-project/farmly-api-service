import { UserRole } from "../config/constants";

export interface DateRangeQueryParams {
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  category_id?: number;
  product_id?: number;
}

export interface ExportExcelQueryParams extends DateRangeQueryParams {
  report_type?: "all" | "revenue" | "disposal";
}

export interface NotificationQueryParams {
  page?: number;
  limit?: number;
  unread_only?: boolean;
}

export interface StaffAccountQueryParams {
  page?: number;
  limit?: number;
  role?: "farm_staff" | "sales";
  status?: "active" | "locked";
  search?: string;
}

export interface CreateStaffAccountDTO {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: Extract<UserRole, "farm_staff" | "sales">;
}

export interface UpdateAccountStatusDTO {
  is_active: boolean;
  reason?: string;
}

export interface UpdateSettingsDTO {
  expiry_warning_days?: number;
  shipping_fee_per_km?: number;
  farm_latitude?: number;
  farm_longitude?: number;
}
