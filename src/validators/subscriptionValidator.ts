import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createSubscriptionSchema = z.object({
  body: z
    .object({
      package_name: z.string().trim().min(2).max(150).optional(),
      items: z
        .array(
          z.object({
            product_id: z
              .number("product_id là bắt buộc")
              .int()
              .positive("ID sản phẩm không hợp lệ"),
            quantity: z
              .number("Số lượng mỗi lần giao là bắt buộc")
              .positive("Số lượng phải lớn hơn 0")
              .max(100, "Số lượng tối đa mỗi sản phẩm trong gói là 100"),
          }),
        )
        .min(1, "Gói định kỳ phải có ít nhất 1 sản phẩm"),
      delivery_days: z
        .array(
          z
            .number()
            .int()
            .min(0, "Thứ trong tuần từ 0 (Chủ Nhật) đến 6 (Thứ 7)")
            .max(6, "Thứ trong tuần từ 0 (Chủ Nhật) đến 6 (Thứ 7)"),
        )
        .min(1, "Vui lòng chọn ít nhất 1 ngày giao trong tuần (UC02 - E3)")
        .max(7, "Tối đa 7 ngày trong tuần"),
      start_date: z
        .string("Ngày bắt đầu (start_date) là bắt buộc")
        .regex(dateRegex, "Ngày bắt đầu phải có định dạng YYYY-MM-DD"),
      end_date: z
        .string()
        .regex(dateRegex, "Ngày kết thúc phải có định dạng YYYY-MM-DD")
        .optional(),
      duration_weeks: z
        .number()
        .int()
        .min(1, "Thời hạn gói tối thiểu 1 tuần")
        .max(52, "Thời hạn gói tối đa 52 tuần")
        .optional()
        .default(4),
      address_id: z.number().int().positive().optional(),
      shipping_address: z.string().trim().min(5).max(500).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      distance_km: z.number().min(0).max(100).optional(),
    })
    .refine(
      (data) =>
        data.address_id !== undefined || Boolean(data.shipping_address?.trim()),
      {
        message:
          "Vui lòng chọn address_id từ sổ địa chỉ hoặc nhập shipping_address",
        path: ["shipping_address"],
      },
    ),
});

export const getSubscriptionsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z
      .enum(["pending_payment", "active", "paused", "completed", "cancelled"])
      .optional(),
  }),
});

export const subscriptionIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID gói định kỳ phải là số nguyên"),
  }),
});

export const generateOrdersCronSchema = z.object({
  body: z
    .object({
      target_date: z
        .string()
        .regex(dateRegex, "target_date phải có định dạng YYYY-MM-DD")
        .optional(),
    })
    .optional(),
});
