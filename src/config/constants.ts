export const USER_ROLES = {
  CUSTOMER: "customer",
  FARM_STAFF: "farm_staff",
  SALES: "sales",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5, // Sai tối đa 5 lần liên tiếp
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // NFR-S05: Khóa đăng nhập 15 phút
  PASSWORD_MIN_LENGTH: 8, // NFR-S02: Tối thiểu 8 ký tự
};
