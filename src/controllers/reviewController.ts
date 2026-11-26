import { Request, Response, NextFunction } from "express";
import { ComplaintService } from "../services/complaintService";
import { sendSuccess } from "../utils/responseUtil";

const complaintService = new ComplaintService();

export class ReviewController {
  // POST /api/v1/reviews
  createReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const review = await complaintService.createProductReview(
        req.user!.id,
        req.body,
      );
      sendSuccess(res, review, "Đánh giá sản phẩm thành công", 201);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/products/:productId/reviews
  getProductReviews = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await complaintService.getPublicProductReviews(
        Number(req.params.productId),
        req.query as any,
      );
      sendSuccess(res, result, "Lấy danh sách đánh giá sản phẩm thành công");
    } catch (error) {
      next(error);
    }
  };
}
