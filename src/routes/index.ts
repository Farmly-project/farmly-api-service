import { Router, Request, Response } from "express";
import authRoutes from "./authRoutes";
import profileRoutes from "./profileRoutes";
import categoryRoutes from "./categoryRoutes";
import productRoutes from "./productRoutes";
import batchRoutes from "./batchRoutes";
import traceRoutes from "./traceRoutes";
import disposalRoutes from "./disposalRoutes";
import cartRoutes from "./cartRoutes";
import orderRoutes from "./orderRoutes";
import paymentRoutes from "./paymentRoutes";
import subscriptionRoutes from "./subscriptionRoutes";
import reviewRoutes from "./reviewRoutes";
import complaintRoutes from "./complaintRoutes";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Chào mừng đến với Farmly API v1",
  });
});

// Phân hệ 1
router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);

// Phân hệ 2
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);

// Phân hệ 3
router.use("/batches", batchRoutes);
router.use("/trace", traceRoutes);
router.use("/inventory-disposals", disposalRoutes);

// Phân hệ 4
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);

// Phân hệ 5
router.use("/payments", paymentRoutes);

// Phân hệ 6
router.use("/subscriptions", subscriptionRoutes);

// Phân hệ 7
router.use("/complaints", complaintRoutes);
router.use("/reviews", reviewRoutes);

export default router;
