import { z } from "zod";
import { SECURITY_CONFIG } from "../config/constants";

// Regex mật khẩu: Ít nhất 8 ký tự, chứa ít nhất 1 chữ cái và 1 chữ số
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string("Email là bắt buộc")
      .trim()
      .toLowerCase()
      .email("Định dạng email không hợp lệ"),
    password: z
      .string("Mật khẩu là bắt buộc")
      .min(
        SECURITY_CONFIG.PASSWORD_MIN_LENGTH,
        `Mật khẩu phải có ít nhất ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} ký tự`,
      )
      .regex(passwordRegex, "Mật khẩu phải bao gồm cả chữ cái và chữ số"),
    full_name: z
      .string("Họ tên là bắt buộc")
      .trim()
      .min(2, "Họ tên quá ngắn")
      .max(150, "Họ tên tối đa 150 ký tự"),
    phone: z
      .string("Số điện thoại là bắt buộc")
      .trim()
      .regex(phoneRegex, "Số điện thoại Việt Nam không hợp lệ")
      .optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string("Email là bắt buộc")
      .trim()
      .toLowerCase()
      .email("Email không hợp lệ"),
    password: z.string("Mật khẩu là bắt buộc").min(1, "Vui lòng nhập mật khẩu"),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refresh_token: z.string("Refresh token là bắt buộc").min(1),
  }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      old_password: z.string("Mật khẩu cũ là bắt buộc").min(1),
      new_password: z
        .string("Mật khẩu mới là bắt buộc")
        .min(
          SECURITY_CONFIG.PASSWORD_MIN_LENGTH,
          "Mật khẩu mới tối thiểu 8 ký tự",
        )
        .regex(passwordRegex, "Mật khẩu mới phải bao gồm cả chữ và số"),
    })
    .refine((data) => data.old_password !== data.new_password, {
      message: "Mật khẩu mới không được trùng với mật khẩu cũ",
      path: ["new_password"],
    }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    full_name: z.string().trim().min(2).max(150).optional(),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, "Số điện thoại không hợp lệ")
      .optional(),
    avatar_url: z
      .string()
      .url("Đường dẫn ảnh đại diện không hợp lệ")
      .optional(),
  }),
});

export const createAddressSchema = z.object({
  body: z.object({
    recipient_name: z
      .string("Tên người nhận là bắt buộc")
      .trim()
      .min(2)
      .max(150),
    phone: z
      .string("Số điện thoại là bắt buộc")
      .trim()
      .regex(phoneRegex, "SĐT không hợp lệ"),
    address_line: z
      .string("Địa chỉ chi tiết là bắt buộc")
      .trim()
      .min(5)
      .max(255),
    ward: z.string("Phường/Xã là bắt buộc").trim().min(2).max(100),
    province: z.string("Tỉnh/Thành phố là bắt buộc").trim().min(2).max(100),
    is_default: z.boolean().optional().default(false),
  }),
});

export const updateAddressSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID địa chỉ phải là số nguyên"),
  }),
  body: createAddressSchema.shape.body.partial(),
});
