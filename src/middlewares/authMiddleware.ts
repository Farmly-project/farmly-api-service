import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabaseClient";
import { UserRole } from "../config/constants";
import { AppError } from "../utils/appError";

export const verifyJWT = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(
        new AppError("Không tìm thấy mã xác thực (Unauthorized)", 401),
      );
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return next(new AppError("Token không hợp lệ", 401));
    }

    // Xác thực JWT qua Supabase Auth
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return next(
        new AppError("Phiên đăng nhập đã hết hạn hoặc không hợp lệ", 401),
      );
    }

    // Lấy thông tin role và kiểm tra trạng thái khóa mềm (deleted_at) từ bảng profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, deleted_at")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return next(new AppError("Không tìm thấy hồ sơ người dùng", 401));
    }

    if (profile.deleted_at) {
      return next(
        new AppError(
          "Tài khoản đã bị vô hiệu hóa, vui lòng liên hệ quản trị viên",
          403,
        ),
      );
    }

    req.user = {
      id: user.id,
      email: user.email!,
      role: profile.role as UserRole,
    };
    req.accessToken = token;

    next();
  } catch (err) {
    next(new AppError("Lỗi xác thực hệ thống", 401));
  }
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Chưa xác thực người dùng", 401));
    }

    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    if (!normalizedAllowed.includes(req.user.role.toLowerCase())) {
      return next(
        new AppError(
          "Bạn không có quyền truy cập chức năng này (Forbidden)",
          403,
        ),
      );
    }

    next();
  };
};
export const optionalVerifyJWT = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // Không có token -> Tiếp tục với tư cách Guest
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return next();
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (!error && user) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role, deleted_at")
        .eq("id", user.id)
        .single();

      if (profile && !profile.deleted_at) {
        req.user = {
          id: user.id,
          email: user.email!,
          role: profile.role as UserRole,
        };
        req.accessToken = token;
      }
    }

    next();
  } catch {
    next();
  }
};
