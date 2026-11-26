import { Request, Response, NextFunction } from "express";
import { DisposalService } from "../services/disposalService";
import { sendSuccess } from "../utils/responseUtil";

const disposalService = new DisposalService();

export class DisposalController {
  // POST /api/v1/inventory-disposals
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await disposalService.createDisposal(
        req.user!.id,
        req.body,
        req.file,
      );
      sendSuccess(
        res,
        result,
        "Tạo phiếu xuất hủy và cập nhật tồn kho thành công",
        201,
      );
    } catch (error) {
      next(error);
    }
  };
}
