import { Request, Response, NextFunction } from "express";
import { OrderService, CartActor } from "../services/orderService";
import { sendSuccess } from "../utils/responseUtil";

const orderService = new OrderService();

export class CartController {
  private extractActor(req: Request): CartActor {
    const guestTokenHeader = req.headers["x-guest-token"];
    const guestToken = Array.isArray(guestTokenHeader)
      ? guestTokenHeader[0]
      : guestTokenHeader;

    return {
      userId: req.user?.id,
      guestToken: guestToken?.trim() || undefined,
    };
  }

  // GET /api/v1/cart
  getCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cart = await orderService.getCart(this.extractActor(req));
      sendSuccess(res, cart, "Lấy thông tin giỏ hàng thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/cart/items
  addItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cart = await orderService.addItemToCart(
        this.extractActor(req),
        req.body,
      );
      sendSuccess(res, cart, "Đã thêm nông sản vào giỏ hàng", 201);
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v1/cart/items/:itemId
  updateItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId = Number(req.params.itemId);
      const cart = await orderService.updateCartItem(
        this.extractActor(req),
        itemId,
        req.body.quantity,
      );
      sendSuccess(res, cart, "Cập nhật số lượng giỏ hàng thành công");
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/v1/cart/items/:itemId
  removeItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId = Number(req.params.itemId);
      const cart = await orderService.removeCartItem(
        this.extractActor(req),
        itemId,
      );
      sendSuccess(res, cart, "Đã xóa sản phẩm khỏi giỏ hàng");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/cart/checkout
  checkout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.checkoutCart(req.user!.id, req.body);
      sendSuccess(res, order, "Đặt hàng từ giỏ hàng thành công", 201);
    } catch (error) {
      next(error);
    }
  };
}
