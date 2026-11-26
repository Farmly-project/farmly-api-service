import { supabaseAdmin } from "../config/supabaseClient";
import { OrderQueryParams } from "../types/orderTypes";
import { AppError } from "../utils/appError";

export class OrderRepository {
  // ============================================================================
  // 1. THAM SỐ HỆ THỐNG & KIỂM TRA TỒN KHẢ DỤNG SẢN PHẨM
  // ============================================================================
  async getSettingsMap(keys: string[]): Promise<Record<string, string>> {
    const { data, error } = await supabaseAdmin
      .from("settings")
      .select("key, value")
      .in("key", keys);

    if (error) return {};
    return (data || []).reduce((acc: Record<string, string>, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  async getProductsWithAvailableStock(productIds: number[]) {
    const todayStr = new Date().toISOString().split("T")[0];

    const { data, error } = await supabaseAdmin
      .from("products")
      .select(
        `
        id, name, unit, base_price, is_active, deleted_at,
        images:product_images(image_url, is_primary, deleted_at),
        batches(id, current_quantity, exp_date, status, flash_sale_price, flash_sale_ends_at)
      `,
      )
      .in("id", productIds);

    if (error) {
      throw new AppError(
        "Lỗi truy vấn thông tin sản phẩm: " + error.message,
        500,
      );
    }

    return (data || []).map((p: any) => {
      const validBatches = (p.batches || [])
        .filter(
          (b: any) =>
            b.status === "in_stock" &&
            Number(b.current_quantity) > 0 &&
            b.exp_date > todayStr,
        )
        .sort((a: any, b: any) => a.exp_date.localeCompare(b.exp_date));

      const availableQuantity = validBatches.reduce(
        (sum: number, b: any) => sum + Number(b.current_quantity),
        0,
      );

      // Xác định đơn giá hiệu lực (nếu lô FEFO đầu tiên đang Flash Sale thì áp dụng giá xả hàng)
      const firstBatch = validBatches[0];
      const isFlashSaleActive =
        firstBatch?.flash_sale_price !== null &&
        firstBatch?.flash_sale_price !== undefined &&
        (!firstBatch.flash_sale_ends_at ||
          new Date(firstBatch.flash_sale_ends_at) > new Date());

      const effectivePrice = isFlashSaleActive
        ? Number(firstBatch.flash_sale_price)
        : Number(p.base_price);

      const activeImages = (p.images || []).filter(
        (img: any) => !img.deleted_at,
      );
      const primaryImage =
        activeImages.find((img: any) => img.is_primary)?.image_url ||
        activeImages[0]?.image_url ||
        null;

      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        base_price: Number(p.base_price),
        effective_price: effectivePrice,
        is_active: p.is_active && !p.deleted_at,
        available_quantity: availableQuantity,
        primary_image: primaryImage,
      };
    });
  }

  // ============================================================================
  // 2. GIỎ HÀNG (CARTS & CART_ITEMS)
  // ============================================================================
  async findCartByUserId(userId: string) {
    const { data } = await supabaseAdmin
      .from("carts")
      .select("*")
      .eq("user_id", userId)
      .single();
    return data || null;
  }

  async findCartByGuestToken(guestToken: string) {
    const { data } = await supabaseAdmin
      .from("carts")
      .select("*")
      .eq("guest_token", guestToken)
      .single();
    return data || null;
  }

  async createCart(owner: { user_id?: string; guest_token?: string }) {
    const { data, error } = await supabaseAdmin
      .from("carts")
      .insert(owner)
      .select("*")
      .single();

    if (error) {
      throw new AppError("Không thể khởi tạo giỏ hàng: " + error.message, 400);
    }
    return data;
  }

  async deleteCartById(cartId: number) {
    await supabaseAdmin.from("carts").delete().eq("id", cartId);
  }

  async getCartItems(cartId: number) {
    const { data, error } = await supabaseAdmin
      .from("cart_items")
      .select("id, cart_id, product_id, quantity, created_at")
      .eq("cart_id", cartId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new AppError("Lỗi tải chi tiết giỏ hàng: " + error.message, 500);
    }
    return data || [];
  }

  async findCartItemById(itemId: number) {
    const { data } = await supabaseAdmin
      .from("cart_items")
      .select("id, cart_id, product_id, quantity")
      .eq("id", itemId)
      .single();
    return data || null;
  }

  async findCartItemByProduct(cartId: number, productId: number) {
    const { data } = await supabaseAdmin
      .from("cart_items")
      .select("id, cart_id, product_id, quantity")
      .eq("cart_id", cartId)
      .eq("product_id", productId)
      .single();
    return data || null;
  }

  async upsertCartItem(cartId: number, productId: number, quantity: number) {
    const { data, error } = await supabaseAdmin
      .from("cart_items")
      .upsert(
        { cart_id: cartId, product_id: productId, quantity },
        { onConflict: "cart_id,product_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw new AppError("Cập nhật giỏ hàng thất bại: " + error.message, 400);
    }
    return data;
  }

  async updateCartItemQuantity(itemId: number, quantity: number) {
    const { data, error } = await supabaseAdmin
      .from("cart_items")
      .update({ quantity })
      .eq("id", itemId)
      .select("*")
      .single();

    if (error) {
      throw new AppError(
        "Cập nhật số lượng sản phẩm thất bại: " + error.message,
        400,
      );
    }
    return data;
  }

  async deleteCartItem(itemId: number) {
    const { error } = await supabaseAdmin
      .from("cart_items")
      .delete()
      .eq("id", itemId);
    if (error) {
      throw new AppError(
        "Xóa sản phẩm khỏi giỏ hàng thất bại: " + error.message,
        400,
      );
    }
  }

  async clearCartItems(cartId: number) {
    await supabaseAdmin.from("cart_items").delete().eq("cart_id", cartId);
  }

  // ============================================================================
  // 3. ĐƠN HÀNG (ORDERS, ORDER_ITEMS, ORDER_DETAILS & RPC allocate_fefo)
  // ============================================================================
  async findAddressById(addressId: number, userId: string) {
    const { data } = await supabaseAdmin
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();
    return data || null;
  }

  async createOrderWithItemsAndPayment(
    orderPayload: Record<string, any>,
    itemsPayload: Array<{
      product_id: number;
      product_name: string;
      unit_price: number;
      quantity: number;
    }>,
    paymentMethod: "payos" | "cod",
  ) {
    // 1. Tạo bản ghi orders
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert(orderPayload)
      .select("*")
      .single();

    if (orderError || !order) {
      throw new AppError(
        "Tạo đơn hàng thất bại: " + (orderError?.message || ""),
        400,
      );
    }

    // 2. Chèn các dòng order_items (chốt tên và đơn giá tại thời điểm đặt)
    const rows = itemsPayload.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      unit_price: item.unit_price,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(rows);
    if (itemsError) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new AppError(
        "Lỗi lưu chi tiết sản phẩm đơn hàng: " + itemsError.message,
        400,
      );
    }

    // 3. Khởi tạo bản ghi giao dịch thanh toán tương ứng trong bảng payments (3NF)
    const { error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        order_id: order.id,
        payment_method: paymentMethod,
        payment_type: "order_payment",
        amount: order.total_amount,
        status: "pending",
      });

    if (paymentError) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new AppError(
        "Lỗi khởi tạo thông tin thanh toán: " + paymentError.message,
        400,
      );
    }

    return await this.findOrderById(order.id);
  }

  async findOrdersByCustomer(customerId: string, params: OrderQueryParams) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 && params.limit <= 50
        ? params.limit
        : 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from("orders")
      .select(
        `
        *,
        items:order_items(id, product_id, product_name, unit_price, quantity),
        payments(id, payment_method, status, amount, paid_at)
      `,
        { count: "exact" },
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (params.status) {
      query = query.eq("status", params.status);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error)
      throw new AppError("Lỗi tải lịch sử đơn hàng: " + error.message, 500);

    return {
      items: data || [],
      pagination: {
        page,
        limit,
        total_items: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async findAllOrders(params: OrderQueryParams) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 && params.limit <= 50
        ? params.limit
        : 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Sử dụng Index idx_orders_status_created (status, created_at DESC)
    let query = supabaseAdmin
      .from("orders")
      .select(
        `
        *,
        items:order_items(id, product_id, product_name, unit_price, quantity),
        payments(id, payment_method, status, amount, paid_at)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.search) {
      query = query.or(
        `order_number.ilike.%${params.search}%,customer_name.ilike.%${params.search}%,customer_phone.ilike.%${params.search}%`,
      );
    }

    if (params.date) {
      query = query
        .gte("created_at", `${params.date}T00:00:00.000Z`)
        .lte("created_at", `${params.date}T23:59:59.999Z`);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error)
      throw new AppError("Lỗi tải danh sách đơn hàng: " + error.message, 500);

    return {
      items: data || [],
      pagination: {
        page,
        limit,
        total_items: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async findOrderById(id: number) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        *,
        items:order_items(
          id, product_id, product_name, unit_price, quantity,
          batch_allocations:order_details(
            id, batch_id, quantity, created_at,
            batch:batches(id, batch_code, harvest_date, exp_date, qr_code)
          )
        ),
        payments(id, payment_method, payment_type, transaction_id, amount, status, paid_at)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data;
  }

  // Kích hoạt hàm PostgreSQL RPC allocate_fefo(p_order_id) trong 1 Transaction duy nhất
  async executeAllocateFefoRpc(orderId: number) {
    const { error } = await supabaseAdmin.rpc("allocate_fefo", {
      p_order_id: orderId,
    });

    if (error) {
      throw new AppError(
        error.message || "Không đủ tồn kho khả dụng để xác nhận đơn hàng",
        409,
      );
    }
  }

  async updateOrder(id: number, payload: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(
        "Cập nhật đơn hàng thất bại: " + (error?.message || ""),
        400,
      );
    }
    return data;
  }

  // Hoàn trả tồn kho về lại các lô nếu Sales hủy đơn đã confirmed (đã trừ FEFO)
  async restoreBatchQuantitiesFromOrder(
    orderDetails: Array<{ batch_id: number; quantity: number }>,
  ) {
    for (const detail of orderDetails) {
      const { data: batch } = await supabaseAdmin
        .from("batches")
        .select("id, current_quantity, status")
        .eq("id", detail.batch_id)
        .single();

      if (batch) {
        const restoredQty =
          Number(batch.current_quantity) + Number(detail.quantity);
        await supabaseAdmin
          .from("batches")
          .update({
            current_quantity: restoredQty,
            status: restoredQty > 0 ? "in_stock" : batch.status,
          })
          .eq("id", batch.id);
      }
    }
  }

  async markCodPaymentAsPaid(orderId: number) {
    await supabaseAdmin
      .from("payments")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .eq("payment_method", "cod")
      .eq("status", "pending");
  }

  async createNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    level: "info" | "warning" | "danger" = "info",
  ) {
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type,
      title,
      body,
      level,
    });
  }

  async writeActivityLog(
    userId: string,
    action: string,
    entityType: string,
    entityId: string | number,
    oldData: any,
    newData: any,
  ) {
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      old_data: oldData,
      new_data: newData,
    });
  }
}
