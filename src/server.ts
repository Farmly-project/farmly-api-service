import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabaseAdmin } from "./config/supabaseClient";
import { globalErrorHandler } from "./middlewares/errorHandler";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get(
  "/api/health",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabaseAdmin.from("settings").select("*");
      if (error) throw error;

      res.json({
        status: "success",
        message: "Farmly TypeScript Backend & Supabase connected!",
        settings: data,
      });
    } catch (err) {
      next(err);
    }
  },
);

app.use(globalErrorHandler);

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`Server Farmly (TS) đang chạy tại http://localhost:${PORT}`);
});
