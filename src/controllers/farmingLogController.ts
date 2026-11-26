import { Request, Response, NextFunction } from "express";
import { FarmingLogService } from "../services/farmingLogService";
import { sendSuccess } from "../utils/responseUtil";

const farmingLogService = new FarmingLogService();

export class FarmingLogController {
  // GET /api/v1/batches/:batchId/farming-logs
  getTimeline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const batchId = Number(req.params.batchId);
      const timeline = await farmingLogService.getBatchTimeline(batchId);
      sendSuccess(res, timeline, "Lấy dòng thời gian canh tác thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/batches/:batchId/farming-logs
  createLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const batchId = Number(req.params.batchId);
      const log = await farmingLogService.addFarmingLog(
        req.user!.id,
        batchId,
        req.body,
        req.file,
      );
      sendSuccess(res, log, "Ghi nhận nhật ký canh tác thành công", 201);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/batches/:batchId/qr-code
  generateQr = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const batchId = Number(req.params.batchId);
      const qrData = await farmingLogService.generateQrForBatch(
        req.user!.id,
        batchId,
      );
      sendSuccess(
        res,
        qrData,
        "Sinh mã QR truy xuất nguồn gốc thành công",
        201,
      );
    } catch (error) {
      next(error);
    }
  };
}
