import { z } from "zod";

export const createCategorySchema = z.object({
  body: z.object({
    name: z
      .string("Tên danh mục là bắt buộc")
      .trim()
      .min(2, "Tên danh mục tối thiểu 2 ký tự")
      .max(100, "Tên danh mục tối đa 100 ký tự"),
    slug: z.string().trim().max(120).optional(),
    description: z.string().trim().optional(),
    image_url: z
      .string()
      .url("URL ảnh không hợp lệ")
      .optional()
      .or(z.literal("")),
    allow_subscription: z.boolean().optional().default(true),
    is_active: z.boolean().optional().default(true),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID danh mục phải là số nguyên"),
  }),
  body: createCategorySchema.shape.body.partial(),
});

export const createProductSchema = z.object({
  body: z.object({
    category_id: z.number().int().positive().nullable().optional(),
    name: z
      .string("Tên sản phẩm là bắt buộc")
      .trim()
      .min(2, "Tên sản phẩm tối thiểu 2 ký tự")
      .max(200, "Tên sản phẩm tối đa 200 ký tự"),
    slug: z.string().trim().max(220).optional(),
    unit: z.string().trim().min(1).max(50).optional().default("kg"),
    base_price: z
      .number("Giá bán cơ bản là bắt buộc")
      .min(0, "Giá bán không được âm"),
    short_description: z.string().trim().optional(),
    description: z.string().trim().optional(),
    preservation_days: z
      .number()
      .int()
      .positive("Số ngày bảo quản phải > 0")
      .optional()
      .default(5),
    is_active: z.boolean().optional().default(true),
    images: z
      .array(
        z.object({
          image_url: z.string().url("URL hình ảnh không hợp lệ"),
          is_primary: z.boolean().optional().default(false),
          display_order: z.number().int().min(0).optional().default(0),
        }),
      )
      .optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID sản phẩm phải là số nguyên"),
  }),
  body: createProductSchema.shape.body.partial(),
});

export const getProductsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z
      .string()
      .trim()
      .max(100, "Từ khóa tìm kiếm tối đa 100 ký tự")
      .optional(),
    category_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    min_price: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .transform(Number)
      .optional(),
    max_price: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .transform(Number)
      .optional(),
    allow_subscription: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .optional(),
    sort_by: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  }),
});

export const uploadCertificationSchema = z.object({
  params: z.object({
    productId: z.string().regex(/^\d+$/, "ID sản phẩm phải là số nguyên"),
  }),
  body: z.object({
    cert_name: z
      .string("Tên chứng nhận là bắt buộc (VD: VietGAP, USDA Organic)")
      .trim()
      .min(2)
      .max(150),
    cert_number: z.string().trim().max(100).optional(),
    issued_by: z.string().trim().max(200).optional(),
    issue_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày cấp phải có định dạng YYYY-MM-DD")
      .optional(),
    expiry_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày hết hạn phải có định dạng YYYY-MM-DD")
      .optional(),
  }),
});
