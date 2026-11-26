import crypto from "crypto";
import { OrderRepository } from "../repositories/orderRepository";
import { ShippingService } from "./shippingService";
import { ORDER_STATUS, USER_ROLES, UserRole } from "../config/constants";
import {
  AddCartItemDTO,
  CancelOrderDTO,
  CheckoutCartDTO,
  CreateOrderDTO,
  OrderQueryParams,
  UpdateOrderStatusDTO,
} from "../types/orderTypes";
import { AppError } from "../utils/appError";

export interface CartActor {
  userId?: string;
  guestToken?: string;
}

export class OrderService {
  private orderRepo = new OrderRepository();
  private shippingService = new ShippingService();

  private generateOrderNumber(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `ORD-${datePart}-${randomPart}`;
  }

  // ============================================================================
  // 1. NGHIỆP VỤ GIỎ HÀNG (CART) & TỰ ĐỘNG GỘP GIỎ KHI ĐĂNG NHẬP (UC11)
  // ============================================================================
  private async resolveCart(actor: CartActor, autoCreate = true) {
    if (!actor.userId && !actor.guestToken) {
      throw new AppError(
        "Vui lòng đăng nhập hoặc cung cấp header x-guest-token để sử dụng giỏ hàng",
        400,
      );
    }

    // Trường hợp user đã đăng nhập
    if (actor.userId) {
      let userCart = await this.orderRepo.findCartByUserId(actor.userId);
      if (!userCart && autoCreate) {
        userCart = await this.orderRepo.createCart({ user_id: actor.userId });
      }

      // UC11 - A1: Nếu khách vừa đăng nhập và vẫn gửi kèm x-guest-token -> Gộp giỏ tạm vào giỏ tài khoản
      if (userCart && actor.guestToken) {
        const guestCart = await this.orderRepo.findCartByGuestToken(
          actor.guestToken,
        );
        if (guestCart) {
          const guestItems = await this.orderRepo.getCartItems(guestCart.id);
          for (const gItem of guestItems) {
            const existing = await this.orderRepo.findCartItemByProduct(
              userCart.id,
              gItem.product_id,
            );
            const mergedQty = existing
              ? Number(existing.quantity) + Number(gItem.quantity)
              : Number(gItem.quantity);
            await this.orderRepo.upsertCartItem(
              userCart.id,
              gItem.product_id,
              mergedQty,
            );
          }
          await this.orderRepo.deleteCartById(guestCart.id);
        }
      }

      return userCart;
    }

    // Trường hợp Guest vãn lai
    let guestCart = await this.orderRepo.findCartByGuestToken(
      actor.guestToken!,
    );
    if (!guestCart && autoCreate) {
      guestCart = await this.orderRepo.createCart({
        guest_token: actor.guestToken!,
      });
    }
    return guestCart;
  }

  async getCart(actor: CartActor) {
    const cart = await this.resolveCart(actor, true);
    if (!cart) {
      return { cart_id: null, items: [], subtotal: 0, total_items: 0 };
    }

    const rawItems = await this.orderRepo.getCartItems(cart.id);
    if (rawItems.length === 0) {
      return { cart_id: cart.id, items: [], subtotal: 0, total_items: 0 };
    }

    const productIds = rawItems.map((i: any) => i.product_id);
    const productsInfo =
      await this.orderRepo.getProductsWithAvailableStock(productIds);
    const productMap = new Map(productsInfo.map((p) => [p.id, p]));

    let subtotal = 0;
    const enrichedItems = rawItems.map((item: any) => {
      const prod = productMap.get(item.product_id);
      const unitPrice = prod ? prod.effective_price : 0;
      const quantity = Number(item.quantity);
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;

      return {
        id: item.id,
        product_id: item.product_id,
        product_name: prod?.name || "Sản phẩm không khả dụng",
        unit: prod?.unit || "kg",
        primary_image: prod?.primary_image || null,
        unit_price: unitPrice,
        base_price: prod?.base_price || 0,
        quantity,
        line_total: lineTotal,
        available_quantity: prod?.available_quantity || 0,
        is_available: Boolean(
          prod?.is_active && prod.available_quantity >= quantity,
        ),
      };
    });

    return {
      cart_id: cart.id,
      items: enrichedItems,
      subtotal,
      total_items: enrichedItems.length,
    };
  }

  async addItemToCart(actor: CartActor, payload: AddCartItemDTO) {
    const cart = await this.resolveCart(actor, true);

    const [product] = await this.orderRepo.getProductsWithAvailableStock([
      payload.product_id,
    ]);
    if (!product || !product.is_active) {
      throw new AppError(
        "Sản phẩm không tồn tại hoặc đã ngừng kinh doanh",
        404,
      );
    }

    const existingItem = await this.orderRepo.findCartItemByProduct(
      cart.id,
      payload.product_id,
    );
    const newQuantity = existingItem
      ? Number(existingItem.quantity) + payload.quantity
      : payload.quantity;

    if (newQuantity > product.available_quantity) {
      throw new AppError(
        `Sản phẩm "${product.name}" chỉ còn ${product.available_quantity} ${product.unit} khả dụng trong kho`,
        400,
      );
    }

    await this.orderRepo.upsertCartItem(
      cart.id,
      payload.product_id,
      newQuantity,
    );
    return await this.getCart(actor);
  }

  async updateCartItem(actor: CartActor, itemId: number, quantity: number) {
    const cart = await this.resolveCart(actor, false);
    if (!cart) {
      throw new AppError("Không tìm thấy giỏ hàng", 404);
    }

    const item = await this.orderRepo.findCartItemById(itemId);
    if (!item || item.cart_id !== cart.id) {
      throw new AppError(
        "Không tìm thấy sản phẩm này trong giỏ hàng của bạn",
        404,
      );
    }

    const [product] = await this.orderRepo.getProductsWithAvailableStock([
      item.product_id,
    ]);
    if (!product || !product.is_active) {
      throw new AppError("Sản phẩm đã ngừng kinh doanh", 400);
    }

    if (quantity > product.available_quantity) {
      throw new AppError(
        `Sản phẩm "${product.name}" chỉ còn ${product.available_quantity} ${product.unit} khả dụng`,
        400,
      );
    }

    await this.orderRepo.updateCartItemQuantity(itemId, quantity);
    return await this.getCart(actor);
  }

  async removeCartItem(actor: CartActor, itemId: number) {
    const cart = await this.resolveCart(actor, false);
    if (!cart) {
      throw new AppError("Không tìm thấy giỏ hàng", 404);
    }

    const item = await this.orderRepo.findCartItemById(itemId);
    if (!item || item.cart_id !== cart.id) {
      throw new AppError(
        "Không tìm thấy sản phẩm này trong giỏ hàng của bạn",
        404,
      );
    }

    await this.orderRepo.deleteCartItem(itemId);
    return await this.getCart(actor);
  }

  // ============================================================================
  // 2. ĐẶT HÀNG LẺ & CHECKOUT GIỎ HÀNG (UC06)
  // ============================================================================
  async checkoutCart(userId: string, payload: CheckoutCartDTO) {
    const cart = await this.orderRepo.findCartByUserId(userId);
    if (!cart) {
      throw new AppError("Giỏ hàng của bạn đang trống", 400);
    }

    const cartItems = await this.orderRepo.getCartItems(cart.id);
    if (cartItems.length === 0) {
      throw new AppError(
        "Giỏ hàng của bạn đang trống, không thể đặt hàng",
        400,
      );
    }

    const order = await this.createOrder(userId, {
      ...payload,
      items: cartItems.map((i: any) => ({
        product_id: i.product_id,
        quantity: Number(i.quantity),
      })),
    });

    // UC06 Bước 7: Xóa các sản phẩm đã đặt khỏi giỏ hàng
    await this.orderRepo.clearCartItems(cart.id);

    return order;
  }

  async createOrder(userId: string, payload: CreateOrderDTO) {
    // 1. Giải quyết thông tin người nhận & địa chỉ giao hàng
    let customerName = payload.customer_name;
    let customerPhone = payload.customer_phone;
    let shippingAddress = payload.shipping_address;

    if (payload.address_id) {
      const addr = await this.orderRepo.findAddressById(
        payload.address_id,
        userId,
      );
      if (!addr) {
        throw new AppError(
          "Không tìm thấy địa chỉ giao hàng đã chọn trong sổ địa chỉ",
          404,
        );
      }
      customerName = customerName || addr.recipient_name;
      customerPhone = customerPhone || addr.phone;
      shippingAddress =
        shippingAddress ||
        `${addr.address_line}, ${addr.ward}, ${addr.province}`;
    }

    // 2. Truy vấn giá thực tế từ Database & kiểm tra tồn kho khả dụng (UC06 - E2 & Bảo mật giá)
    const productIds = payload.items.map((i) => i.product_id);
    const dbProducts =
      await this.orderRepo.getProductsWithAvailableStock(productIds);
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let itemsSubtotal = 0;
    const finalizedItems: Array<{
      product_id: number;
      product_name: string;
      unit_price: number;
      quantity: number;
    }> = [];

    for (const reqItem of payload.items) {
      const prod = productMap.get(reqItem.product_id);
      if (!prod || !prod.is_active) {
        throw new AppError(
          `Sản phẩm ID ${reqItem.product_id} không tồn tại hoặc đã ngừng bán`,
          400,
        );
      }

      if (prod.available_quantity < reqItem.quantity) {
        throw new AppError(
          `Sản phẩm "${prod.name}" chỉ còn ${prod.available_quantity} ${prod.unit} khả dụng (yêu cầu ${reqItem.quantity} ${prod.unit})`,
          400,
        );
      }

      itemsSubtotal += prod.effective_price * reqItem.quantity;
      finalizedItems.push({
        product_id: prod.id,
        product_name: prod.name,
        unit_price: prod.effective_price,
        quantity: reqItem.quantity,
      });
    }

    // 3. Tính phí vận chuyển động theo khoảng cách
    let distanceKm = 0;
    let shippingFee = 0;

    if (
      payload.distance_km !== undefined ||
      (payload.latitude !== undefined && payload.longitude !== undefined)
    ) {
      const shipResult = await this.shippingService.calculateShippingFee({
        latitude: payload.latitude,
        longitude: payload.longitude,
        distance_km: payload.distance_km,
      });
      distanceKm = shipResult.distance_km;
      shippingFee = shipResult.shipping_fee;
    } else {
      // Phí ship tiêu chuẩn nội thành mặc định nếu chưa truyền tọa độ
      shippingFee = 20000;
      distanceKm = 4;
    }

    const totalAmount = itemsSubtotal + shippingFee;
    const orderNumber = this.generateOrderNumber();

    // 4. Tạo đơn hàng ở trạng thái 'pending' (UC06 BR1: Đặt hàng chưa trừ kho)
    const createdOrder = await this.orderRepo.createOrderWithItemsAndPayment(
      {
        order_number: orderNumber,
        customer_id: userId,
        order_type: "retail",
        status: ORDER_STATUS.PENDING,
        customer_name: customerName,
        customer_phone: customerPhone,
        shipping_address: shippingAddress,
        distance_km: distanceKm,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        customer_note: payload.customer_note || null,
        expected_delivery_date: payload.expected_delivery_date || null,
      },
      finalizedItems,
      payload.payment_method,
    );

    // 5. Gửi thông báo đặt hàng thành công cho khách hàng
    await this.orderRepo.createNotification(
      userId,
      "ORDER_CREATED",
      "Đặt hàng thành công",
      `Đơn hàng ${orderNumber} trị giá ${totalAmount.toLocaleString("vi-VN")}đ đã được tiếp nhận và đang chờ xác nhận.`,
      "info",
    );

    return createdOrder;
  }

  // ============================================================================
  // 3. XEM DANH SÁCH & CHI TIẾT ĐƠN HÀNG (UC13 & SALES)
  // ============================================================================
  async getMyOrders(customerId: string, params: OrderQueryParams) {
    return await this.orderRepo.findOrdersByCustomer(customerId, params);
  }

  async getAllOrders(params: OrderQueryParams) {
    return await this.orderRepo.findAllOrders(params);
  }

  async getOrderDetail(
    orderId: number,
    requester: { id: string; role: UserRole },
  ) {
    const order = await this.orderRepo.findOrderById(orderId);
    if (!order) {
      throw new AppError("Không tìm thấy đơn hàng", 404);
    }

    // Customer chỉ được xem đơn của chính mình
    if (
      requester.role === USER_ROLES.CUSTOMER &&
      order.customer_id !== requester.id
    ) {
      throw new AppError(
        "Bạn không có quyền xem đơn hàng này (Forbidden)",
        403,
      );
    }

    return order;
  }

  // ============================================================================
  // 4. SALES DUYỆT ĐƠN -> KÍCH HOẠT TRỪ KHO FEFO (UC16 -> UC01)
  // ============================================================================
  async confirmOrderWithFefo(salesUserId: string, orderId: number) {
    const order = await this.orderRepo.findOrderById(orderId);
    if (!order) {
      throw new AppError("Không tìm thấy đơn hàng", 404);
    }

    // UC01 - E3: Chặn nếu đơn đã được xử lý trước đó (chống 2 Sales bấm cùng lúc)
    if (order.status !== ORDER_STATUS.PENDING) {
      throw new AppError(
        `Đơn hàng đang ở trạng thái "${order.status}", không thể xác nhận lại`,
        409,
      );
    }

    // Gọi PostgreSQL RPC allocate_fefo(orderId):
    // Khóa lô FOR UPDATE -> trừ tồn theo exp_date ASC -> ghi order_details -> rollback nếu thiếu hàng
    await this.orderRepo.executeAllocateFefoRpc(orderId);

    // Cập nhật trạng thái đơn sang 'confirmed' và lưu người duyệt
    await this.orderRepo.updateOrder(orderId, {
      status: ORDER_STATUS.CONFIRMED,
      confirmed_by: salesUserId,
    });

    const confirmedOrder = await this.orderRepo.findOrderById(orderId);

    // Ghi log kiểm toán thao tác đơn & kho (NFR-S09)
    await this.orderRepo.writeActivityLog(
      salesUserId,
      "CONFIRM_ORDER_FEFO",
      "orders",
      orderId,
      { status: ORDER_STATUS.PENDING },
      { status: ORDER_STATUS.CONFIRMED, confirmed_by: salesUserId },
    );

    // Gửi thông báo cho khách hàng (UC01 Bước 7)
    await this.orderRepo.createNotification(
      order.customer_id,
      "ORDER_CONFIRMED",
      "Đơn hàng đã được xác nhận",
      `Đơn hàng ${order.order_number} đã được xác nhận và đang chuẩn bị đóng gói từ nông trại.`,
      "info",
    );

    return confirmedOrder;
  }

  // ============================================================================
  // 5. CẬP NHẬT TRẠNG THÁI GIAO HÀNG & HỦY ĐƠN
  // ============================================================================
  async updateOrderStatus(
    actorUserId: string,
    orderId: number,
    payload: UpdateOrderStatusDTO,
  ) {
    const order = await this.orderRepo.findOrderById(orderId);
    if (!order) {
      throw new AppError("Không tìm thấy đơn hàng", 404);
    }

    if (
      order.status === ORDER_STATUS.DELIVERED ||
      order.status === ORDER_STATUS.CANCELLED
    ) {
      throw new AppError(
        `Đơn hàng đã ở trạng thái cuối (${order.status}), không thể thay đổi`,
        400,
      );
    }

    if (payload.status === ORDER_STATUS.CONFIRMED) {
      throw new AppError(
        "Vui lòng sử dụng API POST /orders/:id/confirm để duyệt đơn và trừ kho FEFO",
        400,
      );
    }

    // Kiểm tra thứ tự chuyển trạng thái hợp lệ
    const validTransitions: Record<string, string[]> = {
      pending: ["cancelled"],
      confirmed: ["preparing", "shipping", "cancelled"],
      preparing: ["shipping", "cancelled"],
      shipping: ["delivered", "cancelled"],
    };

    if (!validTransitions[order.status]?.includes(payload.status)) {
      throw new AppError(
        `Không thể chuyển trạng thái đơn từ "${order.status}" sang "${payload.status}"`,
        400,
      );
    }

    const updates: Record<string, any> = { status: payload.status };

    if (payload.status === ORDER_STATUS.DELIVERED) {
      // Mốc thời gian quan trọng để tính hạn 24h gửi khiếu nại (UC03)
      updates.delivered_at = new Date().toISOString();
      await this.orderRepo.markCodPaymentAsPaid(orderId);
    }

    if (payload.status === ORDER_STATUS.CANCELLED) {
      updates.cancel_reason = payload.cancel_reason;
      // Nếu đơn đã qua bước confirm (đã trừ kho FEFO) -> Hoàn trả tồn kho về lại từng lô
      const allDetails = (order.items || []).flatMap(
        (item: any) => item.batch_allocations || [],
      );
      if (allDetails.length > 0) {
        await this.orderRepo.restoreBatchQuantitiesFromOrder(allDetails);
      }
    }

    await this.orderRepo.updateOrder(orderId, updates);
    const updatedOrder = await this.orderRepo.findOrderById(orderId);

    await this.orderRepo.writeActivityLog(
      actorUserId,
      "UPDATE_ORDER_STATUS",
      "orders",
      orderId,
      { status: order.status },
      updates,
    );

    if (payload.status === ORDER_STATUS.DELIVERED) {
      await this.orderRepo.createNotification(
        order.customer_id,
        "ORDER_DELIVERED",
        "Giao hàng thành công",
        `Đơn hàng ${order.order_number} đã giao thành công. Bạn có thể đánh giá sản phẩm hoặc gửi phản hồi chất lượng trong 24 giờ.`,
        "info",
      );
    }

    return updatedOrder;
  }

  async cancelOrder(
    requester: { id: string; role: UserRole },
    orderId: number,
    payload: CancelOrderDTO,
  ) {
    const order = await this.orderRepo.findOrderById(orderId);
    if (!order) {
      throw new AppError("Không tìm thấy đơn hàng", 404);
    }

    // Customer chỉ được hủy đơn của chính mình và chỉ khi đơn chưa xác nhận (pending)
    if (requester.role === USER_ROLES.CUSTOMER) {
      if (order.customer_id !== requester.id) {
        throw new AppError(
          "Bạn không có quyền hủy đơn hàng này (Forbidden)",
          403,
        );
      }
      if (order.status !== ORDER_STATUS.PENDING) {
        throw new AppError(
          "Đơn hàng đã được xác nhận đóng gói, vui lòng liên hệ CSKH để được hỗ trợ",
          400,
        );
      }
    } else if (order.status !== ORDER_STATUS.PENDING) {
      throw new AppError(
        `Chỉ có thể hủy nhanh đơn ở trạng thái pending (hiện tại: ${order.status})`,
        400,
      );
    }

    const reason =
      payload.cancel_reason ||
      (requester.role === USER_ROLES.CUSTOMER
        ? "Khách hàng chủ động hủy đơn"
        : "Nhân viên hủy đơn");

    await this.orderRepo.updateOrder(orderId, {
      status: ORDER_STATUS.CANCELLED,
      cancel_reason: reason,
    });

    await this.orderRepo.writeActivityLog(
      requester.id,
      "CANCEL_ORDER",
      "orders",
      orderId,
      { status: order.status },
      { status: ORDER_STATUS.CANCELLED, cancel_reason: reason },
    );

    return await this.orderRepo.findOrderById(orderId);
  }
}
