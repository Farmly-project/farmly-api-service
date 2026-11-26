import { UserRole } from "../config/constants";

export interface AuthUserPayload {
  id: string;
  email: string;
  role: UserRole;
}

export interface RegisterDTO {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface ChangePasswordDTO {
  old_password: string;
  new_password: string;
}

export interface UpdateProfileDTO {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
}

export interface AddressDTO {
  recipient_name: string;
  phone: string;
  address_line: string;
  ward: string;
  province: string;
  is_default?: boolean;
}
