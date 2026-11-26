import { OrderStatus, PaymentMethod } from "../config/constants";

export interface AddCartItemDTO {
  product_id: number;
  quantity: number;
}

export interface UpdateCartItemDTO {
  quantity: number;
}

export interface CalculateShippingDTO {
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  province?: string;
}

export interface OrderItemInputDTO {
  product_id: number;
  quantity: number;
}

export interface CheckoutCartDTO {
  address_id?: number;
  customer_name?: string;
  customer_phone?: string;
  shipping_address?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  payment_method: PaymentMethod;
  customer_note?: string;
  expected_delivery_date?: string;
}

export interface CreateOrderDTO extends CheckoutCartDTO {
  items: OrderItemInputDTO[];
}

export interface OrderQueryParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  search?: string;
  date?: string;
}

export interface UpdateOrderStatusDTO {
  status: Exclude<OrderStatus, "pending">;
  cancel_reason?: string;
}

export interface CancelOrderDTO {
  cancel_reason?: string;
}
