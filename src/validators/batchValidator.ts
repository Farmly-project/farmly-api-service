import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const getBatchesQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    product_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(["growing", "in_stock", "sold_out"]).optional(),
    near_expiry: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .optional(),
  }),
});

export const fefoSuggestQuerySchema = z.object({
  query: z.object({
    product_id: z
      .string("product_id là bắt buộc")
      .regex(/^\d+$/, "product_id phải là số nguyên")
      .transform(Number),
    quantity: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "quantity phải là số dương")
      .transform(Number)
      .optional(),
  }),
});

export const createBatchSchema = z.object({
  body: z.object({
    batch_code: z.string().trim().max(100).optional(),
    product_id: z
      .number("product_id là bắt buộc")
      .int()
      .positive("ID sản phẩm không hợp lệ"),
    sowing_date: z
      .string()
      .regex(dateRegex, "Ngày gieo hạt phải có định dạng YYYY-MM-DD")
      .optional(),
    harvest_date: z
      .string()
      .regex(dateRegex, "Ngày thu hoạch phải có định dạng YYYY-MM-DD")
      .optional(),
    exp_date: z
      .string()
      .regex(dateRegex, "Hạn sử dụng phải có định dạng YYYY-MM-DD")
      .optional(),
    initial_quantity: z
      .number("Số lượng nhập kho là bắt buộc")
      .positive("Số lượng nhập phải lớn hơn 0"),
    status: z.enum(["growing", "in_stock"]).optional().default("growing"),
  }),
});

export const flashSaleBatchSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID lô hàng phải là số nguyên"),
  }),
  body: z.object({
    flash_sale_price: z
      .number("Giá xả hàng là bắt buộc")
      .min(0, "Giá xả hàng không được âm")
      .nullable(),
    flash_sale_ends_at: z
      .string()
      .datetime("Thời điểm kết thúc phải chuẩn ISO 8601")
      .nullable()
      .optional(),
  }),
});

export const createFarmingLogSchema = z.object({
  params: z.object({
    batchId: z.string().regex(/^\d+$/, "ID lô hàng phải là số nguyên"),
  }),
  body: z.object({
    stage: z.enum(
      [
        "sowing",
        "fertilizing",
        "watering",
        "pest_control",
        "harvesting",
        "packaging",
      ],
      "Giai đoạn canh tác (stage) là bắt buộc",
    ),
    title: z
      .string("Tiêu đề nhật ký là bắt buộc")
      .trim()
      .min(2, "Tiêu đề tối thiểu 2 ký tự")
      .max(200, "Tiêu đề tối đa 200 ký tự"),
    description: z.string().trim().optional(),
    logged_at: z.string().optional(),
    exp_date: z
      .string()
      .regex(dateRegex, "Hạn sử dụng phải có định dạng YYYY-MM-DD")
      .optional(),
  }),
});

export const createDisposalSchema = z.object({
  body: z.object({
    batch_id: z.coerce
      .number("batch_id là bắt buộc")
      .int()
      .positive("ID lô hàng không hợp lệ"),
    quantity_disposed: z.coerce
      .number("Số lượng xuất hủy là bắt buộc")
      .positive("Số lượng xuất hủy phải lớn hơn 0"),
    reason: z.enum(
      ["damaged", "rotten", "expired", "quality_failed", "other"],
      "Lý do xuất hủy là bắt buộc",
    ),
    note: z.string().trim().optional(),
  }),
});
