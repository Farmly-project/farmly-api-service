import { z } from "zod";

const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const addCartItemSchema = z.object({
  body: z.object({
    product_id: z
      .number("product_id là bắt buộc")
      .int()
      .positive("ID sản phẩm không hợp lệ"),
    quantity: z
      .number("Số lượng là bắt buộc")
      .positive("Số lượng phải lớn hơn 0")
      .max(500, "Số lượng tối đa mỗi lần thêm là 500"),
  }),
});

export const updateCartItemSchema = z.object({
  params: z.object({
    itemId: z.string().regex(/^\d+$/, "ID mục giỏ hàng phải là số nguyên"),
  }),
  body: z.object({
    quantity: z
      .number("Số lượng là bắt buộc")
      .positive("Số lượng phải lớn hơn 0")
      .max(500, "Số lượng tối đa là 500"),
  }),
});

export const calculateShippingSchema = z.object({
  body: z
    .object({
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      distance_km: z.number().min(0).max(100).optional(),
      province: z.string().trim().optional(),
    })
    .refine(
      (data) =>
        data.distance_km !== undefined ||
        (data.latitude !== undefined && data.longitude !== undefined),
      {
        message:
          "Vui lòng cung cấp tọa độ (latitude, longitude) hoặc khoảng cách (distance_km)",
      },
    ),
});

const baseCheckoutFields = z.object({
  address_id: z.number().int().positive().optional(),
  customer_name: z.string().trim().min(2).max(150).optional(),
  customer_phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Số điện thoại không hợp lệ")
    .optional(),
  shipping_address: z.string().trim().min(5).max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  distance_km: z.number().min(0).max(100).optional(),
  payment_method: z.enum(
    ["payos", "cod"],
    "Phương thức thanh toán (payos hoặc cod) là bắt buộc",
  ),
  customer_note: z.string().trim().max(500).optional(),
  expected_delivery_date: z
    .string()
    .regex(dateRegex, "Ngày giao dự kiến phải có định dạng YYYY-MM-DD")
    .optional(),
});

export const checkoutCartSchema = z.object({
  body: baseCheckoutFields.refine(
    (data) =>
      data.address_id !== undefined ||
      (Boolean(data.customer_name) &&
        Boolean(data.customer_phone) &&
        Boolean(data.shipping_address)),
    {
      message:
        "Vui lòng chọn address_id từ sổ địa chỉ hoặc nhập đầy đủ customer_name, customer_phone, shipping_address",
    },
  ),
});

export const createOrderSchema = z.object({
  body: baseCheckoutFields
    .extend({
      items: z
        .array(
          z.object({
            product_id: z.number().int().positive(),
            quantity: z.number().positive(),
          }),
        )
        .min(1, "Đơn hàng phải có ít nhất 1 sản phẩm"),
    })
    .refine(
      (data) =>
        data.address_id !== undefined ||
        (Boolean(data.customer_name) &&
          Boolean(data.customer_phone) &&
          Boolean(data.shipping_address)),
      {
        message:
          "Vui lòng chọn address_id từ sổ địa chỉ hoặc nhập đầy đủ customer_name, customer_phone, shipping_address",
      },
    ),
});

export const getOrdersQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z
      .enum([
        "pending",
        "confirmed",
        "preparing",
        "shipping",
        "delivered",
        "cancelled",
      ])
      .optional(),
    search: z.string().trim().max(100).optional(),
    date: z
      .string()
      .regex(dateRegex, "Ngày lọc phải có định dạng YYYY-MM-DD")
      .optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID đơn hàng phải là số nguyên"),
  }),
  body: z
    .object({
      status: z.enum(
        ["confirmed", "preparing", "shipping", "delivered", "cancelled"],
        "Trạng thái mới là bắt buộc",
      ),
      cancel_reason: z.string().trim().max(500).optional(),
    })
    .refine(
      (data) =>
        data.status !== "cancelled" || Boolean(data.cancel_reason?.trim()),
      {
        message:
          "Vui lòng nhập lý do hủy đơn (cancel_reason) khi chuyển sang trạng thái cancelled",
        path: ["cancel_reason"],
      },
    ),
});

export const cancelOrderSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID đơn hàng phải là số nguyên"),
  }),
  body: z.object({
    cancel_reason: z.string().trim().max(500).optional(),
  }),
});
