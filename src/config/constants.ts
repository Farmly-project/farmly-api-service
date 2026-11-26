export const USER_ROLES = {
  CUSTOMER: "customer",
  FARM_STAFF: "farm_staff",
  SALES: "sales",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ORDER_TYPES = {
  RETAIL: "retail",
  SUBSCRIPTION: "subscription",
  REPLACEMENT: "replacement",
} as const;

export type OrderType = (typeof ORDER_TYPES)[keyof typeof ORDER_TYPES];

export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  SHIPPING: "shipping",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const SUBSCRIPTION_STATUS = {
  PENDING_PAYMENT: "pending_payment",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export const SCHEDULE_STATUS = {
  PENDING: "pending",
  GENERATED: "generated",
  SKIPPED: "skipped",
  CANCELLED: "cancelled",
} as const;

export type ScheduleStatus =
  (typeof SCHEDULE_STATUS)[keyof typeof SCHEDULE_STATUS];

export const PAYMENT_METHODS = {
  PAYOS: "payos",
  COD: "cod",
} as const;

export type PaymentMethod =
  (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
  PASSWORD_MIN_LENGTH: 8,
};
export const COMPLAINT_REASONS = {
  DAMAGED: "damaged",
  WRONG_ITEM: "wrong_item",
  MISSING_QUANTITY: "missing_quantity",
  EXPIRED_OR_SPOILED: "expired_or_spoiled",
  LATE_DELIVERY: "late_delivery",
  OTHER: "other",
} as const;

export type ComplaintReason =
  (typeof COMPLAINT_REASONS)[keyof typeof COMPLAINT_REASONS];

export const COMPLAINT_RESOLUTIONS = {
  REFUND: "refund",
  REPLACEMENT: "replacement",
} as const;

export type ComplaintResolution =
  (typeof COMPLAINT_RESOLUTIONS)[keyof typeof COMPLAINT_RESOLUTIONS];

export const COMPLAINT_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  RESOLVED: "resolved",
} as const;

export type ComplaintStatus =
  (typeof COMPLAINT_STATUS)[keyof typeof COMPLAINT_STATUS];

export const COMPLAINT_CONFIG = {
  WINDOW_HOURS: 24, // Chỉ cho phép khiếu nại trong vòng 24 giờ sau khi nhận hàng (UC03 - BR1)
  MAX_FILES: 5, // Tối đa 5 tệp minh chứng mỗi lần gửi (UC03 Bước 4)
  MAX_IMAGE_SIZE_KB: 5120, // Ảnh tối đa 5 MB (chk_complaint_media)
  MAX_VIDEO_SIZE_KB: 51200, // Video tối đa 50 MB (chk_complaint_media)
};
