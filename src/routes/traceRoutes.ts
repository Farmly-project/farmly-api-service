import { Router } from "express";
import { TraceController } from "../controllers/traceController";

const router = Router();
const traceController = new TraceController();

// Public: Quét mã QR truy xuất nguồn gốc lô hàng (UC10)
router.get("/:batchCode", traceController.traceByBatchCode);

export default router;
