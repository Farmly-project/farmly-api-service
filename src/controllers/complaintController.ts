import { Request, Response, NextFunction } from "express";
import { ComplaintService } from "../services/complaintService";
import { sendSuccess } from "../utils/responseUtil";

const complaintService = new ComplaintService();

export class ComplaintController {
  // POST /api/v1/orders/:orderItemId/complaints
  createComplaint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = (req.files as Express.Multer.File[]) || [];
      const result = await complaintService.createComplaint(
        req.user!.id,
        Number(req.params.orderItemId),
        req.body,
        files,
      );
      sendSuccess(res, result, "Gửi yêu cầu khiếu nại thành công", 201);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/complaints
  getComplaints = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await complaintService.getComplaintsQueue(
        req.query as any,
      );
      sendSuccess(res, result, "Lấy danh sách hàng đợi khiếu nại thành công");
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/complaints/:id
  getComplaintById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const complaint = await complaintService.getComplaintDetail(
        Number(req.params.id),
        {
          id: req.user!.id,
          role: req.user!.role,
        },
      );
      sendSuccess(res, complaint, "Lấy chi tiết khiếu nại thành công");
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v1/complaints/:id/handle
  handleComplaint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await complaintService.handleComplaint(
        Number(req.params.id),
        req.user!.id,
        req.body,
      );
      sendSuccess(res, updated, "Xử lý yêu cầu khiếu nại thành công");
    } catch (error) {
      next(error);
    }
  };
}
