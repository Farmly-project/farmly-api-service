import { Request, Response, NextFunction } from "express";
import { FarmingLogService } from "../services/farmingLogService";
import { sendSuccess } from "../utils/responseUtil";

const farmingLogService = new FarmingLogService();

export class TraceController {
  // GET /api/v1/trace/:batchCode
  traceByBatchCode = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const batchCode = String(req.params.batchCode);
      const data = await farmingLogService.traceBatchPublic(batchCode);
      sendSuccess(res, data, "Truy xuất nguồn gốc lô hàng thành công");
    } catch (error) {
      next(error);
    }
  };
}
