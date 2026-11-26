import { DashboardRepository } from "../repositories/dashboardRepository";
import {
  CreateStaffAccountDTO,
  DateRangeQueryParams,
  ExportExcelQueryParams,
  NotificationQueryParams,
  StaffAccountQueryParams,
  UpdateAccountStatusDTO,
  UpdateSettingsDTO,
} from "../types/dashboardTypes";
import { AppError } from "../utils/appError";
import { buildFarmlyExcelReportBuffer } from "../utils/excelUtil";

export class DashboardService {
  private dashboardRepo = new DashboardRepository();

  private getVietnamDateString(offsetDays = 0): string {
    const vnNow = new Date(
      Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000,
    );
    return vnNow.toISOString().split("T")[0];
  }

  private resolveDateRange(params: DateRangeQueryParams) {
    const endDate = params.end_date || this.getVietnamDateString(0);
    const startDate = params.start_date || this.getVietnamDateString(-29); // Mặc định 30 ngày gần nhất

    return {
      startDate,
      endDate,
      startIso: `${startDate}T00:00:00.000+07:00`,
      endIso: `${endDate}T23:59:59.999+07:00`,
    };
  }

  // ============================================================================
  // 1. THỐNG KÊ CHỈ SỐ TỔNG QUAN (GET /api/v1/dashboard/summary - STT 63, UC08)
  // ============================================================================
  async getDashboardSummary(params: DateRangeQueryParams) {
    const { startDate, endDate, startIso, endIso } =
      this.resolveDateRange(params);

    const [
      orders,
      paidSubPayments,
      refundedPayments,
      activeSubscriptions,
      batches,
    ] = await Promise.all([
      this.dashboardRepo.fetchOrdersInRange(startIso, endIso),
      this.dashboardRepo.fetchPaidSubscriptionsInRange(startIso, endIso),
      this.dashboardRepo.fetchRefundedPaymentsInRange(startIso, endIso),
      this.dashboardRepo.countActiveSubscriptions(),
      this.dashboardRepo.fetchBatchesAndDisposals(startDate, endDate, params),
    ]);

    // Đếm đơn theo trạng thái
    const orderStatusBreakdown: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      shipping: 0,
      delivered: 0,
      cancelled: 0,
    };

    let deliveredRetailRevenue = 0;
    const productStatsMap = new Map<
      number,
      {
        product_id: number;
        product_name: string;
        total_quantity_sold: number;
        total_revenue: number;
      }
    >();

    for (const order of orders as any[]) {
      orderStatusBreakdown[order.status] =
        (orderStatusBreakdown[order.status] || 0) + 1;

      if (order.status === "delivered") {
        // UC08 - BR1: Doanh thu chỉ tính đơn Đã giao
        deliveredRetailRevenue += Number(order.total_amount || 0);

        for (const item of order.items || []) {
          const prev = productStatsMap.get(item.product_id) || {
            product_id: item.product_id,
            product_name: item.product_name,
            total_quantity_sold: 0,
            total_revenue: 0,
          };
          const qty = Number(item.quantity || 0);
          prev.total_quantity_sold = Number(
            (prev.total_quantity_sold + qty).toFixed(2),
          );
          prev.total_revenue += Math.round(Number(item.unit_price || 0) * qty);
          productStatsMap.set(item.product_id, prev);
        }
      }
    }

    const subscriptionRevenue = paidSubPayments.reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0,
    );
    const refundedAmount = refundedPayments.reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0,
    );

    const grossRevenue = deliveredRetailRevenue + subscriptionRevenue;
    const netRevenue = Math.max(0, grossRevenue - refundedAmount);

    // Tính tỷ lệ hao hụt theo UC08 - BR2
    let totalImportedQty = 0;
    let totalDisposedQty = 0;
    for (const b of batches as any[]) {
      totalImportedQty += Number(b.initial_quantity || 0);
      totalDisposedQty += Number(b.disposed_quantity || 0);
    }

    const overallDisposalRate =
      totalImportedQty > 0
        ? Number(((totalDisposedQty / totalImportedQty) * 100).toFixed(2))
        : 0;

    const topProducts = Array.from(productStatsMap.values())
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10);

    return {
      period: { start_date: startDate, end_date: endDate },
      revenue: {
        delivered_retail_revenue: deliveredRetailRevenue,
        subscription_revenue: subscriptionRevenue,
        gross_revenue: grossRevenue,
        refunded_amount: refundedAmount,
        net_revenue: netRevenue,
      },
      orders: {
        total_orders: orders.length,
        by_status: orderStatusBreakdown,
        active_subscriptions: activeSubscriptions,
      },
      inventory_loss: {
        total_batches: batches.length,
        total_imported_qty: Number(totalImportedQty.toFixed(2)),
        total_disposed_qty: Number(totalDisposedQty.toFixed(2)),
        overall_disposal_rate: overallDisposalRate,
      },
      top_products: topProducts,
    };
  }

  // ============================================================================
  // 2. BIỂU ĐỒ DOANH THU THỰC TẾ THEO NGÀY (GET /api/v1/dashboard/revenue-by-day - STT 64)
  // ============================================================================
  async getRevenueByDay(params: DateRangeQueryParams) {
    const { startDate, endDate, startIso, endIso } =
      this.resolveDateRange(params);

    const [orders, paidSubPayments, refundedPayments] = await Promise.all([
      this.dashboardRepo.fetchOrdersInRange(startIso, endIso),
      this.dashboardRepo.fetchPaidSubscriptionsInRange(startIso, endIso),
      this.dashboardRepo.fetchRefundedPaymentsInRange(startIso, endIso),
    ]);

    // Khởi tạo đủ các ngày trong khoảng [startDate, endDate] để biểu đồ không bị khuyết ngày
    const dayMap = new Map<
      string,
      {
        date: string;
        delivered_orders_count: number;
        retail_revenue: number;
        subscription_revenue: number;
        refunded_amount: number;
        net_revenue: number;
      }
    >();

    const cursor = new Date(`${startDate}T00:00:00.000Z`);
    const endObj = new Date(`${endDate}T00:00:00.000Z`);
    while (cursor.getTime() <= endObj.getTime()) {
      const dateStr = cursor.toISOString().split("T")[0];
      dayMap.set(dateStr, {
        date: dateStr,
        delivered_orders_count: 0,
        retail_revenue: 0,
        subscription_revenue: 0,
        refunded_amount: 0,
        net_revenue: 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const toVnDate = (isoStr: string) => {
      const vn = new Date(new Date(isoStr).getTime() + 7 * 60 * 60 * 1000);
      return vn.toISOString().split("T")[0];
    };

    for (const order of orders as any[]) {
      if (order.status === "delivered") {
        const d = toVnDate(order.delivered_at || order.created_at);
        const bucket = dayMap.get(d);
        if (bucket) {
          bucket.delivered_orders_count += 1;
          bucket.retail_revenue += Number(order.total_amount || 0);
        }
      }
    }

    for (const pay of paidSubPayments as any[]) {
      const d = toVnDate(pay.paid_at || pay.created_at);
      const bucket = dayMap.get(d);
      if (bucket) {
        bucket.subscription_revenue += Number(pay.amount || 0);
      }
    }

    for (const ref of refundedPayments as any[]) {
      const d = toVnDate(ref.paid_at || ref.created_at);
      const bucket = dayMap.get(d);
      if (bucket) {
        bucket.refunded_amount += Number(ref.amount || 0);
      }
    }

    const series = Array.from(dayMap.values()).map((item) => ({
      ...item,
      net_revenue: Math.max(
        0,
        item.retail_revenue + item.subscription_revenue - item.refunded_amount,
      ),
    }));

    return {
      period: { start_date: startDate, end_date: endDate },
      series,
    };
  }

  // ============================================================================
  // 3. BÁO CÁO TỶ LỆ XUẤT HỦY / HAO HỤT THEO LÔ (GET /api/v1/dashboard/disposal-report - STT 65)
  // ============================================================================
  async getDisposalReport(params: DateRangeQueryParams) {
    const { startDate, endDate } = this.resolveDateRange(params);
    const batches = await this.dashboardRepo.fetchBatchesAndDisposals(
      startDate,
      endDate,
      params,
    );

    let totalImported = 0;
    let totalDisposed = 0;

    const batchItems = (batches as any[]).map((b) => {
      const initialQty = Number(b.initial_quantity || 0);
      const disposedQty = Number(b.disposed_quantity || 0);
      const currentQty = Number(b.current_quantity || 0);
      const soldQty = Math.max(
        0,
        Number((initialQty - currentQty - disposedQty).toFixed(2)),
      );
      const disposalRate =
        initialQty > 0
          ? Number(((disposedQty / initialQty) * 100).toFixed(2))
          : 0;

      totalImported += initialQty;
      totalDisposed += disposedQty;

      return {
        batch_id: b.id,
        batch_code: b.batch_code,
        product_id: b.product_id,
        product_name: b.product?.name || `Sản phẩm #${b.product_id}`,
        unit: b.product?.unit || "kg",
        harvest_date: b.harvest_date,
        exp_date: b.exp_date,
        status: b.status,
        initial_quantity: initialQty,
        sold_quantity: soldQty,
        current_quantity: currentQty,
        disposed_quantity: disposedQty,
        disposal_rate: disposalRate,
        disposal_records: b.disposals || [],
      };
    });

    const overallRate =
      totalImported > 0
        ? Number(((totalDisposed / totalImported) * 100).toFixed(2))
        : 0;

    return {
      period: { start_date: startDate, end_date: endDate },
      summary: {
        total_batches: batchItems.length,
        total_imported_quantity: Number(totalImported.toFixed(2)),
        total_disposed_quantity: Number(totalDisposed.toFixed(2)),
        overall_disposal_rate: overallRate,
      },
      batches: batchItems,
    };
  }

  // ============================================================================
  // 4. XUẤT FILE BÁO CÁO EXCEL (.XLSX) (GET /api/v1/dashboard/export-excel - STT 66)
  // ============================================================================
  async exportDashboardExcel(params: ExportExcelQueryParams) {
    const [summaryData, revenueData, disposalData] = await Promise.all([
      this.getDashboardSummary(params),
      this.getRevenueByDay(params),
      this.getDisposalReport(params),
    ]);

    // UC08 - E2: Chặn xuất file rỗng nếu hoàn toàn không có dữ liệu trong kỳ
    if (
      summaryData.orders.total_orders === 0 &&
      summaryData.inventory_loss.total_batches === 0 &&
      summaryData.revenue.gross_revenue === 0
    ) {
      throw new AppError(
        "Chưa có dữ liệu trong khoảng thời gian này để xuất Excel",
        400,
      );
    }

    const buffer = await buildFarmlyExcelReportBuffer({
      period: summaryData.period,
      summary: {
        gross_revenue: summaryData.revenue.gross_revenue,
        refunded_amount: summaryData.revenue.refunded_amount,
        net_revenue: summaryData.revenue.net_revenue,
        total_orders: summaryData.orders.total_orders,
        delivered_orders: summaryData.orders.by_status.delivered || 0,
        cancelled_orders: summaryData.orders.by_status.cancelled || 0,
        active_subscriptions: summaryData.orders.active_subscriptions,
        total_imported_qty: summaryData.inventory_loss.total_imported_qty,
        total_disposed_qty: summaryData.inventory_loss.total_disposed_qty,
        overall_disposal_rate: summaryData.inventory_loss.overall_disposal_rate,
      },
      revenueByDay: revenueData.series,
      disposalReport: disposalData.batches.map((b) => ({
        batch_code: b.batch_code,
        product_name: b.product_name,
        unit: b.unit,
        harvest_date: b.harvest_date,
        exp_date: b.exp_date,
        initial_quantity: b.initial_quantity,
        current_quantity: b.current_quantity,
        disposed_quantity: b.disposed_quantity,
        disposal_rate: b.disposal_rate,
        status: b.status,
      })),
      topProducts: summaryData.top_products,
    });

    const filename = `Farmly_BaoCao_${summaryData.period.start_date}_den_${summaryData.period.end_date}.xlsx`;
    return { buffer, filename };
  }

  // ============================================================================
  // 5. THÔNG BÁO HỆ THỐNG (GET /api/v1/notifications - STT 67)
  // ============================================================================
  async getMyNotifications(userId: string, params: NotificationQueryParams) {
    return await this.dashboardRepo.findUserNotifications(userId, params);
  }

  async markNotificationRead(notificationId: number, userId: string) {
    return await this.dashboardRepo.markNotificationAsRead(
      notificationId,
      userId,
    );
  }

  async markAllNotificationsRead(userId: string) {
    const updatedCount =
      await this.dashboardRepo.markAllNotificationsAsRead(userId);
    return { marked_count: updatedCount };
  }

  // ============================================================================
  // 6. QUẢN TRỊ TÀI KHOẢN NHÂN SỰ (ACCOUNTS - STT 68, 69, 70, UC27)
  // ============================================================================
  async getStaffAccounts(params: StaffAccountQueryParams) {
    return await this.dashboardRepo.findStaffAccounts(params);
  }

  async createStaffAccount(adminId: string, payload: CreateStaffAccountDTO) {
    const createdAccount = await this.dashboardRepo.createStaffAccount(payload);

    await this.dashboardRepo.writeActivityLog(
      adminId,
      "CREATE_STAFF_ACCOUNT",
      "profiles",
      createdAccount.id,
      null,
      {
        email: createdAccount.email,
        full_name: createdAccount.full_name,
        role: createdAccount.role,
      },
    );

    return createdAccount;
  }

  async updateStaffAccountStatus(
    adminId: string,
    targetUserId: string,
    payload: UpdateAccountStatusDTO,
  ) {
    if (adminId === targetUserId) {
      throw new AppError("Không thể tự khóa tài khoản của chính bạn", 400);
    }

    const targetProfile =
      await this.dashboardRepo.findProfileById(targetUserId);
    if (!targetProfile) {
      throw new AppError("Không tìm thấy tài khoản nhân viên", 404);
    }

    if (targetProfile.role !== "farm_staff" && targetProfile.role !== "sales") {
      throw new AppError(
        "Chỉ được thao tác khóa/mở khóa đối với tài khoản nhân viên (farm_staff, sales)",
        403,
      );
    }

    const updatedAccount = await this.dashboardRepo.updateStaffLockStatus(
      targetUserId,
      payload.is_active,
    );

    await this.dashboardRepo.writeActivityLog(
      adminId,
      payload.is_active ? "UNLOCK_STAFF_ACCOUNT" : "LOCK_STAFF_ACCOUNT",
      "profiles",
      targetUserId,
      { is_active: targetProfile.deleted_at === null },
      { is_active: payload.is_active, reason: payload.reason || null },
    );

    return updatedAccount;
  }

  // ============================================================================
  // 7. CẤU HÌNH THAM SỐ HỆ THỐNG (SETTINGS - STT 71, UC24)
  // ============================================================================
  async getSystemSettings() {
    const raw = await this.dashboardRepo.getAllSettings();
    return {
      expiry_warning_days: Number(raw.expiry_warning_days ?? 2),
      shipping_fee_per_km: Number(raw.shipping_fee_per_km ?? 5000),
      farm_latitude: Number(raw.farm_latitude ?? 10.7769),
      farm_longitude: Number(raw.farm_longitude ?? 106.7009),
      raw,
    };
  }

  async updateSystemSettings(adminId: string, payload: UpdateSettingsDTO) {
    const oldSettings = await this.dashboardRepo.getAllSettings();
    const updates: Array<{ key: string; value: string }> = [];

    if (payload.expiry_warning_days !== undefined) {
      updates.push({
        key: "expiry_warning_days",
        value: String(payload.expiry_warning_days),
      });
    }
    if (payload.shipping_fee_per_km !== undefined) {
      updates.push({
        key: "shipping_fee_per_km",
        value: String(payload.shipping_fee_per_km),
      });
    }
    if (payload.farm_latitude !== undefined) {
      updates.push({
        key: "farm_latitude",
        value: String(payload.farm_latitude),
      });
    }
    if (payload.farm_longitude !== undefined) {
      updates.push({
        key: "farm_longitude",
        value: String(payload.farm_longitude),
      });
    }

    const newSettings = await this.dashboardRepo.upsertSettings(updates);

    await this.dashboardRepo.writeActivityLog(
      adminId,
      "UPDATE_SYSTEM_SETTINGS",
      "settings",
      "global",
      oldSettings,
      newSettings,
    );

    return {
      expiry_warning_days: Number(newSettings.expiry_warning_days ?? 2),
      shipping_fee_per_km: Number(newSettings.shipping_fee_per_km ?? 5000),
      farm_latitude: Number(newSettings.farm_latitude ?? 10.7769),
      farm_longitude: Number(newSettings.farm_longitude ?? 106.7009),
      raw: newSettings,
    };
  }

  // ============================================================================
  // 8. CRONJOB 06:00 QUÉT LÔ SẮP HẾT HẠN & ĐẨY CẢNH BÁO ĐỎ (UC05 & UC19)
  // ============================================================================
  async scanNearExpiryBatches() {
    const settings = await this.dashboardRepo.getAllSettings();
    const warningDays = Math.max(1, Number(settings.expiry_warning_days ?? 2));

    const todayVn = this.getVietnamDateString(0);
    const thresholdVn = this.getVietnamDateString(warningDays);

    const candidateBatches: any[] =
      await this.dashboardRepo.findBatchesExpiringOnOrBefore(thresholdVn);

    if (candidateBatches.length === 0) {
      return {
        scanned_date: todayVn,
        warning_days: warningDays,
        near_expiry_count: 0,
        expired_count: 0,
      };
    }

    const todayStartIso = `${todayVn}T00:00:00.000+07:00`;
    const existingTodayAlerts =
      await this.dashboardRepo.findTodayNotificationBodiesByTypes(
        ["BATCH_NEAR_EXPIRY", "BATCH_EXPIRED_DISPOSAL_REQUIRED"],
        todayStartIso,
      );

    const salesAndAdminIds = await this.dashboardRepo.findStaffIdsByRoles([
      "sales",
      "admin",
    ]);
    const farmStaffIds = await this.dashboardRepo.findStaffIdsByRoles([
      "farm_staff",
    ]);

    let nearExpiryAlerted = 0;
    let expiredAlerted = 0;

    for (const batch of candidateBatches) {
      const productName =
        batch.product?.name || `Sản phẩm #${batch.product_id}`;
      const unit = batch.product?.unit || "kg";

      // Trường hợp A2 (UC05): Lô đã quá hạn (exp_date < todayVn) nhưng vẫn còn tồn -> Nhắc Farm Staff xuất hủy
      if (batch.exp_date < todayVn) {
        for (const staffId of farmStaffIds) {
          const alreadySent = existingTodayAlerts.some(
            (n: any) =>
              n.user_id === staffId &&
              n.type === "BATCH_EXPIRED_DISPOSAL_REQUIRED" &&
              n.body.includes(batch.batch_code),
          );

          if (!alreadySent) {
            await this.dashboardRepo.createNotification(
              staffId,
              "BATCH_EXPIRED_DISPOSAL_REQUIRED",
              `Lô ${batch.batch_code} đã hết hạn sử dụng`,
              `Lô ${batch.batch_code} (${productName}) đã hết hạn ngày ${batch.exp_date} nhưng vẫn còn tồn ${batch.current_quantity} ${unit}. Vui lòng kiểm tra và lập phiếu xuất hủy (UC05).`,
              "danger",
            );
          }
        }
        expiredAlerted += 1;
        continue;
      }

      // Trường hợp chính (UC05 Bước 6-7 & UC19): Lô còn <= warningDays ngày -> Đẩy cảnh báo đỏ cho Sales xả hàng
      const expMs = new Date(`${batch.exp_date}T00:00:00.000Z`).getTime();
      const todayMs = new Date(`${todayVn}T00:00:00.000Z`).getTime();
      const daysLeft = Math.max(
        0,
        Math.round((expMs - todayMs) / (1000 * 60 * 60 * 24)),
      );

      for (const staffId of salesAndAdminIds) {
        // UC05 - A3: Không gửi lại thông báo trùng trong cùng ngày
        const alreadySent = existingTodayAlerts.some(
          (n: any) =>
            n.user_id === staffId &&
            n.type === "BATCH_NEAR_EXPIRY" &&
            n.body.includes(batch.batch_code),
        );

        if (!alreadySent) {
          await this.dashboardRepo.createNotification(
            staffId,
            "BATCH_NEAR_EXPIRY",
            `Cảnh báo xả hàng: Lô ${batch.batch_code} sắp hết hạn`,
            `Lô ${batch.batch_code} - ${productName} còn tồn ${batch.current_quantity} ${unit}, sẽ hết hạn vào ${batch.exp_date} (còn ${daysLeft} ngày). Đề xuất bật Flash Sale xả kho (UC19).`,
            "danger",
          );
        }
      }
      nearExpiryAlerted += 1;
    }

    return {
      scanned_date: todayVn,
      warning_days: warningDays,
      near_expiry_count: nearExpiryAlerted,
      expired_count: expiredAlerted,
    };
  }
}
