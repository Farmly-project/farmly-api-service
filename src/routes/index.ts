import { Router, Request, Response } from "express";
import authRoutes from "./authRoutes";
import profileRoutes from "./profileRoutes";
import categoryRoutes from "./categoryRoutes";
import productRoutes from "./productRoutes";

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

export default router;
