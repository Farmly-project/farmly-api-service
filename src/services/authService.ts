import { supabaseAnon, supabaseAdmin } from "../config/supabaseClient";
import { ProfileRepository } from "../repositories/profileRepository";
import { SECURITY_CONFIG, USER_ROLES } from "../config/constants";
import {
  AddressDTO,
  ChangePasswordDTO,
  LoginDTO,
  RegisterDTO,
  UpdateProfileDTO,
} from "../types/authTypes";
import { AppError } from "../utils/appError";

interface LoginAttemptRecord {
  count: number;
  lockedUntil: number | null;
}

export class AuthService {
  private profileRepo = new ProfileRepository();
  // Lưu trạng thái đếm số lần đăng nhập sai theo email (Production có thể thay bằng Redis)
  private static loginAttempts = new Map<string, LoginAttemptRecord>();

  private checkBruteForceLock(email: string) {
    const record = AuthService.loginAttempts.get(email);
    if (!record || !record.lockedUntil) return;

    const now = Date.now();
    if (now < record.lockedUntil) {
      const unlockTime = new Date(record.lockedUntil).toLocaleTimeString(
        "vi-VN",
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        },
      );
      throw new AppError(
        `Tài khoản tạm khóa do nhập sai mật khẩu quá ${SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS} lần. Vui lòng thử lại sau ${unlockTime}`,
        429,
      );
    } else {
      // Đã hết 15 phút khóa -> Reset bộ đếm
      AuthService.loginAttempts.delete(email);
    }
  }

  private recordFailedAttempt(email: string) {
    const current = AuthService.loginAttempts.get(email) || {
      count: 0,
      lockedUntil: null,
    };
    const newCount = current.count + 1;

    if (newCount >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MS;
      AuthService.loginAttempts.set(email, { count: newCount, lockedUntil });
      const unlockTime = new Date(lockedUntil).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      throw new AppError(
        `Bạn đã nhập sai mật khẩu ${SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS} lần liên tiếp. Tài khoản bị khóa trong 15 phút (mở lại lúc ${unlockTime})`,
        429,
      );
    }

    AuthService.loginAttempts.set(email, {
      count: newCount,
      lockedUntil: null,
    });
  }

  private resetFailedAttempts(email: string) {
    AuthService.loginAttempts.delete(email);
  }

  // 1. Đăng ký tài khoản Khách hàng mới (UC12)
  async register(payload: RegisterDTO) {
    const existingProfile = await this.profileRepo.findByEmail(payload.email);
    if (existingProfile) {
      throw new AppError("Email này đã được sử dụng trong hệ thống", 409);
    }

    // Supabase Auth tự động băm mật khẩu bằng bcrypt (NFR-S01)
    // Trigger on_auth_user_created trong PostgreSQL sẽ tự động insert vào bảng profiles
    const { data, error } = await supabaseAnon.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.full_name,
          role: USER_ROLES.CUSTOMER,
        },
      },
    });

    if (error || !data.user) {
      throw new AppError(error?.message || "Đăng ký tài khoản thất bại", 400);
    }

    // Cập nhật số điện thoại vào profile nếu có
    if (payload.phone) {
      await this.profileRepo.updateProfile(data.user.id, {
        phone: payload.phone,
      });
    }

    const profile = await this.profileRepo.findById(data.user.id);

    return {
      user: profile,
      session: data.session
        ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_in: data.session.expires_in,
          }
        : null,
    };
  }

  // 2. Đăng nhập hệ thống (UC09)
  async login(payload: LoginDTO) {
    const normalizedEmail = payload.email.toLowerCase().trim();

    // Bước 1: Kiểm tra tài khoản có đang bị khóa 15 phút do brute-force không (NFR-S05)
    this.checkBruteForceLock(normalizedEmail);

    // Bước 2: Kiểm tra trạng thái tài khoản có bị Admin vô hiệu hóa không (UC09 - E4)
    const profileCheck = await this.profileRepo.findByEmail(normalizedEmail);
    if (profileCheck && profileCheck.deleted_at) {
      throw new AppError(
        "Tài khoản đã bị khóa, vui lòng liên hệ quản trị viên",
        403,
      );
    }

    // Bước 3: Xác thực qua Supabase Auth
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email: normalizedEmail,
      password: payload.password,
    });

    if (error || !data.user || !data.session) {
      // Tăng biến đếm sai mật khẩu (nếu email tồn tại trong hệ thống)
      if (profileCheck) {
        this.recordFailedAttempt(normalizedEmail);
      }
      // UC09 - BR3: Không tiết lộ chi tiết sai email hay sai mật khẩu
      throw new AppError("Email hoặc mật khẩu không đúng", 401);
    }

    // Đăng nhập thành công -> Xóa lịch sử nhập sai
    this.resetFailedAttempts(normalizedEmail);

    const profile = await this.profileRepo.findById(data.user.id);

    // Ghi log đăng nhập vào bảng activity_logs
    await supabaseAdmin.from("activity_logs").insert({
      user_id: data.user.id,
      action: "LOGIN",
      entity_type: "profiles",
      entity_id: data.user.id,
      new_data: { email: normalizedEmail, role: profile?.role },
    });

    return {
      user: profile,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    };
  }

  // 3. Lấy thông tin tài khoản hiện tại
  async getMe(userId: string) {
    const profile = await this.profileRepo.findById(userId);
    if (!profile || profile.deleted_at) {
      throw new AppError("Không tìm thấy thông tin tài khoản", 404);
    }
    return profile;
  }

  // 4. Cấp lại Access Token từ Refresh Token
  async refreshToken(refreshToken: string) {
    const { data, error } = await supabaseAnon.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new AppError("Refresh token không hợp lệ hoặc đã hết hạn", 401);
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    };
  }

  // 5. Đăng xuất & hủy phiên làm việc
  async logout(accessToken: string) {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken);
    if (error) {
      throw new AppError("Đăng xuất thất bại", 400);
    }
    return true;
  }

  // 6. Đổi mật khẩu cá nhân (UC28)
  async changePassword(
    userId: string,
    email: string,
    payload: ChangePasswordDTO,
  ) {
    // Xác minh mật khẩu cũ trước khi cho phép đổi
    const { error: verifyError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password: payload.old_password,
    });

    if (verifyError) {
      throw new AppError("Mật khẩu hiện tại không chính xác", 400);
    }

    // Cập nhật mật khẩu mới qua Admin API
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: payload.new_password,
      });

    if (updateError) {
      throw new AppError(
        "Không thể cập nhật mật khẩu mới: " + updateError.message,
        400,
      );
    }

    return true;
  }

  // 7-12. Nghiệp vụ Hồ sơ & Sổ địa chỉ
  async updateProfile(userId: string, payload: UpdateProfileDTO) {
    return await this.profileRepo.updateProfile(userId, payload);
  }

  async getAddresses(userId: string) {
    return await this.profileRepo.getAddressesByUserId(userId);
  }

  async addAddress(userId: string, payload: AddressDTO) {
    return await this.profileRepo.createAddress(userId, payload);
  }

  async updateAddress(
    userId: string,
    addressId: number,
    payload: Partial<AddressDTO>,
  ) {
    return await this.profileRepo.updateAddress(userId, addressId, payload);
  }

  async deleteAddress(userId: string, addressId: number) {
    return await this.profileRepo.softDeleteAddress(userId, addressId);
  }
}
