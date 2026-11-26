import { Request, Response, NextFunction } from "express";
import { BatchService } from "../services/batchService";
import { FefoService } from "../services/fefoService";
import { sendSuccess } from "../utils/responseUtil";

const batchService = new BatchService();
const fefoService = new FefoService();

export class BatchController {
  // GET /api/v1/batches
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await batchService.getBatches(req.query as any);
      sendSuccess(res, result, "Lấy danh sách lô hàng thành công");
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/batches/fefo/suggest
  suggestFefo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = Number(req.query.product_id);
      const quantity = req.query.quantity
        ? Number(req.query.quantity)
        : undefined;
      const result = await fefoService.suggestBatchesForProduct(
        productId,
        quantity,
      );
      sendSuccess(
        res,
        result,
        "Gợi ý xuất kho theo nguyên tắc FEFO thành công",
      );
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/batches/:id
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const batch = await batchService.getBatchDetail(Number(req.params.id));
      sendSuccess(res, batch, "Lấy chi tiết lô hàng thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/batches
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const batch = await batchService.createBatch(req.user!.id, req.body);
      sendSuccess(res, batch, "Khởi tạo lô hàng mới thành công", 201);
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/batches/:id/flash-sale
  setFlashSale = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await batchService.configureFlashSale(
        req.user!.id,
        Number(req.params.id),
        req.body,
      );
      sendSuccess(
        res,
        updated,
        "Cập nhật cấu hình xả hàng (Flash Sale) thành công",
      );
    } catch (error) {
      next(error);
    }
  };
}
