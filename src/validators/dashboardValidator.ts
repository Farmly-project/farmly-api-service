import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const validateDateWindow = (
  data: { start_date?: string; end_date?: string },
  ctx: z.RefinementCtx,
) => {
  if (data.start_date && data.end_date) {
    if (data.start_date > data.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Ngày bắt đầu (start_date) không được sau ngày kết thúc (end_date) (UC08 - E1)",
        path: ["start_date"],
      });
      return;
    }

    const startMs = new Date(`${data.start_date}T00:00:00.000Z`).getTime();
    const endMs = new Date(`${data.end_date}T00:00:00.000Z`).getTime();
    const diffDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24));

    if (diffDays > 366) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Khoảng thời gian thống kê tối đa 12 tháng (366 ngày) (UC08 - E1)",
        path: ["end_date"],
      });
    }
  }
};

export const dashboardDateRangeSchema = z.object({
  query: z
    .object({
      start_date: z
        .string()
        .regex(dateRegex, "start_date phải có định dạng YYYY-MM-DD")
        .optional(),
      end_date: z
        .string()
        .regex(dateRegex, "end_date phải có định dạng YYYY-MM-DD")
        .optional(),
      category_id: z.string().regex(/^\d+$/).transform(Number).optional(),
      product_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    })
    .superRefine(validateDateWindow),
});

export const exportExcelQuerySchema = z.object({
  query: z
    .object({
      start_date: z
        .string()
        .regex(dateRegex, "start_date phải có định dạng YYYY-MM-DD")
        .optional(),
      end_date: z
        .string()
        .regex(dateRegex, "end_date phải có định dạng YYYY-MM-DD")
        .optional(),
      category_id: z.string().regex(/^\d+$/).transform(Number).optional(),
      product_id: z.string().regex(/^\d+$/).transform(Number).optional(),
      report_type: z
        .enum(["all", "revenue", "disposal"])
        .optional()
        .default("all"),
    })
    .superRefine(validateDateWindow),
});

export const notificationsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    unread_only: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .optional(),
  }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID thông báo phải là số nguyên"),
  }),
});

export const getAccountsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    role: z.enum(["farm_staff", "sales"]).optional(),
    status: z.enum(["active", "locked"]).optional(),
    search: z.string().trim().max(100).optional(),
  }),
});

export const createStaffAccountSchema = z.object({
  body: z.object({
    email: z.string("Email là bắt buộc").email("Email không đúng định dạng"),
    password: z
      .string("Mật khẩu là bắt buộc")
      .min(8, "Mật khẩu tối thiểu 8 ký tự (NFR-S02)")
      .regex(
        /^(?=.*[A-Za-z])(?=.*\d).+$/,
        "Mật khẩu phải chứa cả chữ cái và chữ số (NFR-S02)",
      ),
    full_name: z
      .string("Họ tên nhân viên là bắt buộc")
      .trim()
      .min(2, "Họ tên tối thiểu 2 ký tự")
      .max(150),
    phone: z
      .string()
      .trim()
      .regex(/^(0|\+84)[0-9]{9,10}$/, "Số điện thoại Việt Nam không hợp lệ")
      .optional(),
    role: z.enum(["farm_staff", "sales"], {
      message: "Vai trò nhân viên phải là farm_staff hoặc sales",
    }),
  }),
});

export const updateAccountStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID tài khoản nhân viên phải là UUID hợp lệ"),
  }),
  body: z.object({
    is_active: z.boolean("is_active (true/false) là bắt buộc"),
    reason: z.string().trim().max(300).optional(),
  }),
});

export const updateSettingsSchema = z.object({
  body: z
    .object({
      expiry_warning_days: z
        .number()
        .int("Số ngày cảnh báo hết hạn phải là số nguyên")
        .min(1, "Ngưỡng cảnh báo tối thiểu 1 ngày")
        .max(30, "Ngưỡng cảnh báo tối đa 30 ngày")
        .optional(),
      shipping_fee_per_km: z
        .number()
        .min(0, "Đơn giá phí ship/km không được âm")
        .max(500000)
        .optional(),
      farm_latitude: z.number().min(-90).max(90).optional(),
      farm_longitude: z.number().min(-180).max(180).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Vui lòng cung cấp ít nhất 1 tham số cấu hình cần cập nhật",
    }),
});
