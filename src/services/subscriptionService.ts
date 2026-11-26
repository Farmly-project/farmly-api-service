import crypto from "crypto";
import {
  ORDER_STATUS,
  ORDER_TYPES,
  SUBSCRIPTION_STATUS,
  USER_ROLES,
  UserRole,
} from "../config/constants";
import { SubscriptionRepository } from "../repositories/subscriptionRepository";
import { ShippingService } from "./shippingService";
import {
  CreateSubscriptionDTO,
  SubscriptionQueryParams,
} from "../types/subscriptionTypes";
import { AppError } from "../utils/appError";

export class SubscriptionService {
  private subRepo = new SubscriptionRepository();
  private shippingService = new ShippingService();

  // Lấy ngày hiện tại theo múi giờ Việt Nam (UTC+7) định dạng YYYY-MM-DD
  private getVietnamDateString(offsetDays = 0): string {
    const vnNow = new Date(
      Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000,
    );
    return vnNow.toISOString().split("T")[0];
  }

  private generateSubOrderNumber(): string {
    const datePart = this.getVietnamDateString(0).replace(/-/g, "");
    const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `SUB-${datePart}-${randomPart}`;
  }

  /**
   * Tính danh sách toàn bộ ngày giao hàng trong khoảng [startDate, endDate]
   * khớp với các thứ trong tuần khách chọn (deliveryDays: 0=CN .. 6=T7)
   */
  private computeDeliveryDates(
    startDateStr: string,
    endDateStr: string,
    deliveryDays: number[],
  ): string[] {
    const uniqueDays = new Set(deliveryDays);
    const dates: string[] = [];

    const current = new Date(`${startDateStr}T00:00:00.000Z`);
    const end = new Date(`${endDateStr}T00:00:00.000Z`);

    while (current.getTime() <= end.getTime()) {
      if (uniqueDays.has(current.getUTCDay())) {
        dates.push(current.toISOString().split("T")[0]);
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }

  // ============================================================================
  // 1. ĐĂNG KÝ GÓI NÔNG SẢN ĐỊNH KỲ (POST /api/v1/subscriptions - UC02)
  // ============================================================================
  async createSubscription(customerId: string, payload: CreateSubscriptionDTO) {
    const todayVn = this.getVietnamDateString(0);

    // UC02 - E3: Chặn nếu ngày bắt đầu ở quá khứ
    if (payload.start_date < todayVn) {
      throw new AppError(
        `Ngày bắt đầu gói (${payload.start_date}) không được ở quá khứ (hôm nay là ${todayVn})`,
        400,
      );
    }

    // Xác định ngày kết thúc gói (mặc định 4 tuần = 28 ngày nếu khách không truyền end_date)
    let endDateStr = payload.end_date;
    if (!endDateStr) {
      const weeks = payload.duration_weeks || 4;
      const startObj = new Date(`${payload.start_date}T00:00:00.000Z`);
      startObj.setUTCDate(startObj.getUTCDate() + weeks * 7 - 1);
      endDateStr = startObj.toISOString().split("T")[0];
    }

    if (endDateStr < payload.start_date) {
      throw new AppError(
        "Ngày kết thúc gói không được trước ngày bắt đầu",
        400,
      );
    }

    // Tính danh sách các ngày giao dự kiến trong chu kỳ gói
    const deliveryDates = this.computeDeliveryDates(
      payload.start_date,
      endDateStr,
      payload.delivery_days,
    );

    if (deliveryDates.length === 0) {
      throw new AppError(
        "Không tìm thấy ngày giao nào phù hợp với các thứ đã chọn trong khoảng thời gian này",
        400,
      );
    }

    // Giải quyết địa chỉ giao hàng
    let shippingAddress = payload.shipping_address;
    if (payload.address_id) {
      const addr = await this.subRepo.findAddressById(
        payload.address_id,
        customerId,
      );
      if (!addr) {
        throw new AppError(
          "Không tìm thấy địa chỉ đã chọn trong sổ địa chỉ",
          404,
        );
      }
      shippingAddress = `${addr.recipient_name} - ${addr.phone} | ${addr.address_line}, ${addr.ward}, ${addr.province}`;
    }

    // Kiểm tra sản phẩm tồn tại, đang bán và thuộc danh mục cho phép đặt định kỳ (allow_subscription = true)
    const uniqueProductIds = [
      ...new Set(payload.items.map((i) => i.product_id)),
    ];
    const dbProducts =
      await this.subRepo.getEligibleProductsForSubscription(uniqueProductIds);
    const productMap = new Map(dbProducts.map((p: any) => [p.id, p]));

    let itemsCostPerDelivery = 0;
    const finalizedItems: Array<{
      product_id: number;
      quantity: number;
      unit_price: number;
    }> = [];

    for (const reqItem of payload.items) {
      const prod: any = productMap.get(reqItem.product_id);
      if (!prod || !prod.is_active || prod.deleted_at) {
        throw new AppError(
          `Sản phẩm ID ${reqItem.product_id} không tồn tại hoặc đã ngừng kinh doanh`,
          400,
        );
      }

      if (!prod.category || !prod.category.allow_subscription) {
        throw new AppError(
          `Sản phẩm "${prod.name}" thuộc danh mục không hỗ trợ giao hàng định kỳ`,
          400,
        );
      }

      // UC02 - BR2: Chốt giá bán cơ bản tại thời điểm mua gói
      const lockedUnitPrice = Number(prod.base_price);
      itemsCostPerDelivery += lockedUnitPrice * reqItem.quantity;

      finalizedItems.push({
        product_id: prod.id,
        quantity: reqItem.quantity,
        unit_price: lockedUnitPrice,
      });
    }

    // Tính phí vận chuyển cho mỗi chuyến giao
    let shippingFeePerDelivery = 20000;
    if (
      payload.distance_km !== undefined ||
      (payload.latitude !== undefined && payload.longitude !== undefined)
    ) {
      const shipResult = await this.shippingService.calculateShippingFee({
        latitude: payload.latitude,
        longitude: payload.longitude,
        distance_km: payload.distance_km,
      });
      shippingFeePerDelivery = shipResult.shipping_fee;
    }

    const totalDeliveryCount = deliveryDates.length;
    const costPerDelivery = itemsCostPerDelivery + shippingFeePerDelivery;
    const totalAmount = costPerDelivery * totalDeliveryCount;

    const packageName =
      payload.package_name ||
      `Gói nông sản định kỳ (${totalDeliveryCount} lần giao: ${payload.start_date} → ${endDateStr})`;

    const createdSubscription = await this.subRepo.createSubscriptionBundle(
      {
        customer_id: customerId,
        package_name: packageName,
        status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
        start_date: payload.start_date,
        end_date: endDateStr,
        shipping_address: shippingAddress,
        total_amount: totalAmount,
      },
      finalizedItems,
      deliveryDates,
    );

    await this.subRepo.createNotification(
      customerId,
      "SUBSCRIPTION_CREATED",
      "Khởi tạo gói định kỳ thành công",
      `Gói "${packageName}" gồm ${totalDeliveryCount} kỳ giao (tổng ${totalAmount.toLocaleString(
        "vi-VN",
      )}đ) đã được tạo. Vui lòng hoàn tất thanh toán qua VietQR để kích hoạt gói.`,
      "info",
    );

    return {
      ...createdSubscription,
      pricing_breakdown: {
        items_cost_per_delivery: itemsCostPerDelivery,
        shipping_fee_per_delivery: shippingFeePerDelivery,
        cost_per_delivery: costPerDelivery,
        total_deliveries: totalDeliveryCount,
        total_amount: totalAmount,
      },
    };
  }

  // ============================================================================
  // 2. XEM DANH SÁCH & CHI TIẾT GÓI ĐỊNH KỲ
  // ============================================================================
  async getMySubscriptions(
    customerId: string,
    params: SubscriptionQueryParams,
  ) {
    return await this.subRepo.findSubscriptionsByCustomer(customerId, params);
  }

  async getSubscriptionDetail(
    subscriptionId: number,
    requester: { id: string; role: UserRole },
  ) {
    const sub = await this.subRepo.findSubscriptionById(subscriptionId);
    if (!sub) {
      throw new AppError("Không tìm thấy gói mua hàng định kỳ", 404);
    }

    if (
      requester.role === USER_ROLES.CUSTOMER &&
      sub.customer_id !== requester.id
    ) {
      throw new AppError(
        "Bạn không có quyền xem gói định kỳ này (Forbidden)",
        403,
      );
    }

    return sub;
  }

  // ============================================================================
  // 3. TẠM DỪNG & HỦY GÓI ĐỊNH KỲ
  // ============================================================================
  async pauseSubscription(customerId: string, subscriptionId: number) {
    const sub = await this.subRepo.findSubscriptionById(subscriptionId);
    if (!sub) {
      throw new AppError("Không tìm thấy gói mua hàng định kỳ", 404);
    }

    if (sub.customer_id !== customerId) {
      throw new AppError(
        "Bạn không có quyền thao tác trên gói định kỳ này (Forbidden)",
        403,
      );
    }

    if (sub.status !== SUBSCRIPTION_STATUS.ACTIVE) {
      throw new AppError(
        `Chỉ có thể tạm dừng gói đang hoạt động (trạng thái hiện tại: "${sub.status}")`,
        400,
      );
    }

    await this.subRepo.updateSubscriptionStatus(
      subscriptionId,
      SUBSCRIPTION_STATUS.PAUSED,
    );

    await this.subRepo.writeActivityLog(
      customerId,
      "PAUSE_SUBSCRIPTION",
      "subscriptions",
      subscriptionId,
      { status: SUBSCRIPTION_STATUS.ACTIVE },
      { status: SUBSCRIPTION_STATUS.PAUSED },
    );

    await this.subRepo.createNotification(
      customerId,
      "SUBSCRIPTION_PAUSED",
      "Đã tạm dừng gói định kỳ",
      `Gói "${sub.package_name}" đã được tạm dừng. Hệ thống sẽ ngừng sinh đơn tự động cho đến khi kích hoạt lại.`,
      "info",
    );

    return await this.subRepo.findSubscriptionById(subscriptionId);
  }

  async cancelSubscription(customerId: string, subscriptionId: number) {
    const sub = await this.subRepo.findSubscriptionById(subscriptionId);
    if (!sub) {
      throw new AppError("Không tìm thấy gói mua hàng định kỳ", 404);
    }

    if (sub.customer_id !== customerId) {
      throw new AppError(
        "Bạn không có quyền hủy gói định kỳ này (Forbidden)",
        403,
      );
    }

    if (
      sub.status === SUBSCRIPTION_STATUS.CANCELLED ||
      sub.status === SUBSCRIPTION_STATUS.COMPLETED
    ) {
      throw new AppError(
        `Gói định kỳ đã ở trạng thái "${sub.status}", không thể hủy thêm`,
        400,
      );
    }

    const totalSchedules = (sub.schedules || []).length;
    const cancelledSchedulesCount =
      await this.subRepo.cancelAllPendingSchedules(subscriptionId);

    // Tính giá trị các kỳ chưa giao để Sales đối soát hoàn tiền nếu gói đã thanh toán trước
    const isPaid = (sub.payments || []).some((p: any) => p.status === "paid");
    const estimatedRefundAmount =
      isPaid && totalSchedules > 0
        ? Math.round(
            (Number(sub.total_amount) / totalSchedules) *
              cancelledSchedulesCount,
          )
        : 0;

    await this.subRepo.updateSubscriptionStatus(
      subscriptionId,
      SUBSCRIPTION_STATUS.CANCELLED,
    );

    await this.subRepo.writeActivityLog(
      customerId,
      "CANCEL_SUBSCRIPTION",
      "subscriptions",
      subscriptionId,
      { status: sub.status },
      {
        status: SUBSCRIPTION_STATUS.CANCELLED,
        cancelled_schedules_count: cancelledSchedulesCount,
        estimated_refund_amount: estimatedRefundAmount,
      },
    );

    await this.subRepo.createNotification(
      customerId,
      "SUBSCRIPTION_CANCELLED",
      "Đã hủy gói định kỳ",
      estimatedRefundAmount > 0
        ? `Gói "${sub.package_name}" đã được hủy (${cancelledSchedulesCount} kỳ chưa giao). Bộ phận CSKH sẽ hoàn lại ${estimatedRefundAmount.toLocaleString(
            "vi-VN",
          )}đ cho phần chưa sử dụng.`
        : `Gói "${sub.package_name}" đã được hủy thành công.`,
      "warning",
    );

    const updatedSub = await this.subRepo.findSubscriptionById(subscriptionId);
    return {
      ...updatedSub,
      cancellation_summary: {
        cancelled_schedules_count: cancelledSchedulesCount,
        is_prepaid: isPaid,
        estimated_refund_amount: estimatedRefundAmount,
      },
    };
  }

  // ============================================================================
  // 4. CRONJOB (00:00 HÀNG NGÀY) TỰ ĐỘNG SINH ĐƠN CON CHO NGÀY MAI (UC31 & UC02)
  // ============================================================================
  async generateOrdersForTomorrow(targetDateOverride?: string) {
    const startedAt = Date.now();
    // Mặc định sinh đơn con cho lịch giao của ngày hôm sau (UC02 Bước 6)
    const targetDate = targetDateOverride || this.getVietnamDateString(1);

    const pendingSchedules =
      await this.subRepo.findPendingSchedulesForDate(targetDate);

    if (pendingSchedules.length === 0) {
      return {
        target_date: targetDate,
        processed_count: 0,
        generated_orders: [],
        low_stock_alerts: [],
        duration_ms: Date.now() - startedAt,
      };
    }

    // Thu thập toàn bộ product_id để kiểm tra tồn kho khả dụng (exp_date > targetDate)
    const allProductIds = [
      ...new Set(
        pendingSchedules.flatMap((s: any) =>
          (s.subscription?.items || []).map((i: any) => i.product_id),
        ),
      ),
    ];

    const availableStockMap = await this.subRepo.getAvailableStockMap(
      allProductIds,
      targetDate,
    );
    const salesAndAdminIds = await this.subRepo.findSalesAndAdminIds();

    const generatedOrders: Array<{
      schedule_id: number;
      subscription_id: number;
      order_id: number;
      order_number: string;
      has_stock_shortage: boolean;
    }> = [];

    const lowStockAlerts: Array<{
      subscription_id: number;
      order_number: string;
      shortages: Array<{
        product_id: number;
        product_name: string;
        required: number;
        available: number;
      }>;
    }> = [];

    for (const schedule of pendingSchedules as any[]) {
      const sub = schedule.subscription;
      const customer = sub.customer || {};
      const subItems = sub.items || [];

      if (subItems.length === 0) continue;

      // Kiểm tra tồn kho còn hạn đủ cho đơn con (UC02 Bước 7 & E2)
      const shortages: Array<{
        product_id: number;
        product_name: string;
        required: number;
        available: number;
      }> = [];

      const orderItemsPayload = subItems.map((item: any) => {
        const requiredQty = Number(item.quantity);
        const currentStock = availableStockMap.get(item.product_id) || 0;
        const productName =
          item.product?.name || `Sản phẩm #${item.product_id}`;

        if (currentStock < requiredQty) {
          shortages.push({
            product_id: item.product_id,
            product_name: productName,
            required: requiredQty,
            available: currentStock,
          });
        } else {
          // Trừ tạm trong bộ nhớ để các lịch giao tiếp theo trong cùng đợt chạy biết tồn còn lại
          availableStockMap.set(
            item.product_id,
            Number((currentStock - requiredQty).toFixed(2)),
          );
        }

        return {
          product_id: item.product_id,
          product_name: productName,
          unit_price: Number(item.unit_price),
          quantity: requiredQty,
        };
      });

      const hasShortage = shortages.length > 0;
      const orderNumber = this.generateSubOrderNumber();

      const shortageNote = hasShortage
        ? `[CẢNH BÁO THIẾU HÀNG GÓI ĐỊNH KỲ - UC18] Thiếu: ${shortages
            .map(
              (s) =>
                `${s.product_name} (cần ${s.required}, còn ${s.available})`,
            )
            .join("; ")}`
        : null;

      // UC02 Bước 6: Sinh đơn con ở trạng thái 'pending' (Chờ xác nhận), số tiền cần thu 0đ
      const createdOrder = await this.subRepo.createChildOrderForSchedule(
        schedule.id,
        sub.id,
        {
          order_number: orderNumber,
          customer_id: sub.customer_id,
          subscription_id: sub.id,
          order_type: ORDER_TYPES.SUBSCRIPTION,
          status: ORDER_STATUS.PENDING,
          customer_name: customer.full_name || "Khách hàng định kỳ",
          customer_phone: customer.phone || "Chưa cập nhật",
          shipping_address: sub.shipping_address,
          distance_km: 0,
          shipping_fee: 0,
          total_amount: 0, // Đã thanh toán trước toàn bộ gói
          customer_note: shortageNote,
          expected_delivery_date: targetDate,
        },
        orderItemsPayload,
      );

      generatedOrders.push({
        schedule_id: schedule.id,
        subscription_id: sub.id,
        order_id: createdOrder.id,
        order_number: createdOrder.order_number,
        has_stock_shortage: hasShortage,
      });

      // Nếu thiếu hàng (UC02 - E2): Đẩy cảnh báo đỏ cho Sales xử lý đổi món/hoàn tiền (UC18)
      if (hasShortage) {
        lowStockAlerts.push({
          subscription_id: sub.id,
          order_number: createdOrder.order_number,
          shortages,
        });

        for (const staffId of salesAndAdminIds) {
          await this.subRepo.createNotification(
            staffId,
            "SUBSCRIPTION_STOCK_SHORTAGE",
            `Thiếu hàng đơn định kỳ ${createdOrder.order_number}`,
            `Đơn gói định kỳ #${sub.id} giao ngày ${targetDate} không đủ tồn kho: ${shortages
              .map(
                (s) =>
                  `${s.product_name} (cần ${s.required}, còn ${s.available})`,
              )
              .join(", ")}. Vui lòng liên hệ khách đổi sản phẩm (UC18).`,
            "danger",
          );
        }
      }

      // UC02 Bước 8: Thông báo cho khách hàng lịch giao ngày mai
      const itemSummary = orderItemsPayload
        .map((i: any) => `${i.product_name} (${i.quantity})`)
        .join(", ");

      await this.subRepo.createNotification(
        sub.customer_id,
        "SUBSCRIPTION_DELIVERY_REMINDER",
        `Lịch giao gói định kỳ ngày ${targetDate}`,
        `Đơn hàng định kỳ ${createdOrder.order_number} gồm: ${itemSummary} sẽ được giao vào ngày ${targetDate} (Số tiền thu hộ: 0đ).`,
        "info",
      );
    }

    await this.subRepo.writeActivityLog(
      null,
      "CRON_GENERATE_SUBSCRIPTION_ORDERS",
      "delivery_schedules",
      targetDate,
      null,
      {
        target_date: targetDate,
        generated_count: generatedOrders.length,
        shortage_count: lowStockAlerts.length,
      },
    );

    return {
      target_date: targetDate,
      processed_count: generatedOrders.length,
      generated_orders: generatedOrders,
      low_stock_alerts: lowStockAlerts,
      duration_ms: Date.now() - startedAt,
    };
  }
}
