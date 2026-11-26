import { Request, Response, NextFunction } from "express";
import { OrderService } from "../services/orderService";
import { ShippingService } from "../services/shippingService";
import { sendSuccess } from "../utils/responseUtil";

const orderService = new OrderService();
const shippingService = new ShippingService();

export class OrderController {
  // POST /api/v1/orders/calculate-shipping
  calculateShipping = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await shippingService.calculateShippingFee(req.body);
      sendSuccess(res, result, "Tính phí vận chuyển thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/orders
  createOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.createOrder(req.user!.id, req.body);
      sendSuccess(res, order, "Tạo đơn hàng lẻ thành công", 201);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/orders/my-orders
  getMyOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await orderService.getMyOrders(
        req.user!.id,
        req.query as any,
      );
      sendSuccess(res, result, "Lấy lịch sử đơn hàng cá nhân thành công");
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/orders
  getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await orderService.getAllOrders(req.query as any);
      sendSuccess(res, result, "Lấy danh sách đơn hàng thành công");
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/orders/:id
  getOrderById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.getOrderDetail(Number(req.params.id), {
        id: req.user!.id,
        role: req.user!.role,
      });
      sendSuccess(res, order, "Lấy chi tiết đơn hàng thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/orders/:id/confirm
  confirmOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.confirmOrderWithFefo(
        req.user!.id,
        Number(req.params.id),
      );
      sendSuccess(res, order, "Duyệt đơn và xuất kho theo lô FEFO thành công");
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/orders/:id/status
  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.updateOrderStatus(
        req.user!.id,
        Number(req.params.id),
        req.body,
      );
      sendSuccess(res, order, "Cập nhật trạng thái giao hàng thành công");
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/orders/:id/cancel
  cancelOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.cancelOrder(
        { id: req.user!.id, role: req.user!.role },
        Number(req.params.id),
        req.body,
      );
      sendSuccess(res, order, "Đã hủy đơn hàng thành công");
    } catch (error) {
      next(error);
    }
  };
}
