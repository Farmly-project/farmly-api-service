import { z } from "zod";

export const createPaymentSchema = z.object({
  body: z
    .object({
      order_id: z
        .number()
        .int()
        .positive("order_id phải là số nguyên dương")
        .optional(),
      subscription_id: z
        .number()
        .int()
        .positive("subscription_id phải là số nguyên dương")
        .optional(),
      return_url: z.string().url("return_url không hợp lệ").optional(),
      cancel_url: z.string().url("cancel_url không hợp lệ").optional(),
    })
    .refine(
      (data) =>
        (data.order_id !== undefined && data.subscription_id === undefined) ||
        (data.order_id === undefined && data.subscription_id !== undefined),
      {
        message:
          "Chỉ được truyền một trong hai trường: order_id hoặc subscription_id (chk_payment_target)",
      },
    ),
});

export const paymentIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID giao dịch thanh toán phải là số nguyên"),
  }),
});

export const payosReturnQuerySchema = z.object({
  query: z.object({
    code: z.string().optional(),
    id: z.string().optional(),
    cancel: z.string().optional(),
    status: z.string().optional(),
    orderCode: z.string().regex(/^\d+$/, "orderCode không hợp lệ").optional(),
    format: z.enum(["json", "redirect"]).optional(),
  }),
});
