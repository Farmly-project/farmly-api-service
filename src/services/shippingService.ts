import { OrderRepository } from "../repositories/orderRepository";
import { CalculateShippingDTO } from "../types/orderTypes";
import { AppError } from "../utils/appError";
import { calculateHaversineKm } from "../utils/distanceUtil";

export class ShippingService {
  private orderRepo = new OrderRepository();
  private readonly MAX_DELIVERY_RADIUS_KM = 50; // Bán kính giao nông sản tươi tối đa 50km
  private readonly MIN_SHIPPING_FEE = 15000; // Phí tối thiểu 15.000đ cho đơn nội thành gần

  async calculateShippingFee(payload: CalculateShippingDTO) {
    const settings = await this.orderRepo.getSettingsMap([
      "farm_latitude",
      "farm_longitude",
      "shipping_fee_per_km",
    ]);

    const farmLat = Number(settings.farm_latitude || "10.7769");
    const farmLng = Number(settings.farm_longitude || "106.7009");
    const feePerKm = Number(settings.shipping_fee_per_km || "5000");

    let distanceKm = 0;

    if (payload.distance_km !== undefined) {
      distanceKm = Number(payload.distance_km.toFixed(2));
    } else if (
      payload.latitude !== undefined &&
      payload.longitude !== undefined
    ) {
      // Nhân hệ số đường bộ 1.25 so với đường chim bay Haversine
      const straightKm = calculateHaversineKm(
        farmLat,
        farmLng,
        payload.latitude,
        payload.longitude,
      );
      distanceKm = Number((straightKm * 1.25).toFixed(2));
    } else {
      throw new AppError("Thiếu tọa độ giao hàng hoặc khoảng cách km", 400);
    }

    // UC06 - E3: Chặn nếu ngoài bán kính giao hàng hỏa tốc nông sản tươi
    if (distanceKm > this.MAX_DELIVERY_RADIUS_KM) {
      throw new AppError(
        `Chưa hỗ trợ giao nông sản tươi đến khu vực cách nông trại ${distanceKm} km (tối đa ${this.MAX_DELIVERY_RADIUS_KM} km)`,
        400,
      );
    }

    const rawFee = Math.round((distanceKm * feePerKm) / 1000) * 1000;
    const shippingFee =
      distanceKm === 0 ? 0 : Math.max(this.MIN_SHIPPING_FEE, rawFee);

    return {
      farm_coordinates: { latitude: farmLat, longitude: farmLng },
      distance_km: distanceKm,
      rate_per_km: feePerKm,
      shipping_fee: shippingFee,
    };
  }
}
