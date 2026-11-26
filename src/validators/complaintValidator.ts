import { z } from "zod";

export const createComplaintSchema = z.object({
  params: z.object({
    orderItemId: z
      .string()
      .regex(/^\d+$/, "orderItemId phải là số nguyên dương"),
  }),
  body: z.object({
    // multipart/form-data truyền các trường dưới dạng string nên dùng z.coerce.number()
    quantity_affected: z.coerce
      .number("Số lượng nông sản bị lỗi là bắt buộc")
      .positive("Số lượng bị lỗi phải lớn hơn 0"),
    reason: z.enum(
      [
        "damaged",
        "wrong_item",
        "missing_quantity",
        "expired_or_spoiled",
        "late_delivery",
        "other",
      ],
      "Lý do khiếu nại không hợp lệ",
    ),
    description: z
      .string()
      .trim()
      .max(1000, "Mô tả tối đa 1000 ký tự")
      .optional(),
    requested_resolution: z.enum(
      ["refund", "replacement"],
      "Vui lòng chọn hướng xử lý mong muốn (refund hoặc replacement)",
    ),
  }),
});

export const getComplaintsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(["pending", "approved", "rejected", "resolved"]).optional(),
  }),
});

export const complaintIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID khiếu nại phải là số nguyên"),
  }),
});

export const handleComplaintSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID khiếu nại phải là số nguyên"),
  }),
  body: z
    .object({
      action: z.enum(
        ["approve", "reject"],
        "action phải là approve hoặc reject",
      ),
      resolution: z.enum(["refund", "replacement"]).optional(),
      refund_amount: z.number().min(0, "Số tiền hoàn không được âm").optional(),
      sales_note: z.string().trim().max(1000).optional(),
      auto_confirm_replacement: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.action === "approve" && !data.resolution) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Khi duyệt chấp nhận khiếu nại bắt buộc chọn resolution (refund hoặc replacement)",
          path: ["resolution"],
        });
      }
      if (
        data.action === "reject" &&
        (!data.sales_note || data.sales_note.trim().length === 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Khi từ chối khiếu nại bắt buộc nhập lý do vào sales_note (chk_complaint_reject_note)",
          path: ["sales_note"],
        });
      }
    }),
});

export const createReviewSchema = z.object({
  body: z.object({
    order_item_id: z
      .number("order_item_id là bắt buộc")
      .int()
      .positive("order_item_id phải là số nguyên dương"),
    rating: z
      .number("Điểm đánh giá (rating) là bắt buộc")
      .int("Điểm đánh giá phải là số nguyên")
      .min(1, "Điểm đánh giá tối thiểu 1 sao")
      .max(5, "Điểm đánh giá tối đa 5 sao"),
    comment: z
      .string()
      .trim()
      .max(1000, "Nhận xét tối đa 1000 ký tự")
      .optional(),
  }),
});

export const getProductReviewsSchema = z.object({
  params: z.object({
    productId: z.string().regex(/^\d+$/, "productId phải là số nguyên dương"),
  }),
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    rating: z
      .string()
      .regex(/^[1-5]$/, "rating lọc từ 1 đến 5")
      .transform(Number)
      .optional(),
  }),
});
