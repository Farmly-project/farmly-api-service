import crypto from "crypto";
import { BatchRepository } from "../repositories/batchRepository";
import { ProductRepository } from "../repositories/productRepository";
import {
  BatchQueryParams,
  CreateBatchDTO,
  FlashSaleBatchDTO,
} from "../types/batchTypes";
import { AppError } from "../utils/appError";

export class BatchService {
  private batchRepo = new BatchRepository();
  private productRepo = new ProductRepository();

  private generateBatchCode(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomPart = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `BATCH-${datePart}-${randomPart}`;
  }

  async getBatches(params: BatchQueryParams) {
    return await this.batchRepo.findAllBatches(params);
  }

  async getBatchDetail(id: number) {
    const batch = await this.batchRepo.findBatchById(id);
    if (!batch) {
      throw new AppError("Không tìm thấy lô hàng", 404);
    }
    return batch;
  }

  async createBatch(userId: string, payload: CreateBatchDTO) {
    const product = await this.productRepo.findProductById(payload.product_id);
    if (!product) {
      throw new AppError("Sản phẩm không tồn tại", 404);
    }

    const status = payload.status || "growing";
    const batchCode = payload.batch_code || this.generateBatchCode();

    let harvestDate: string | null = null;
    let expDate: string | null = null;

    if (status === "growing") {
      // Đáp ứng ràng buộc chk_batch_harvest_state: lô đang trồng chưa có harvest_date và qr_code
      if (payload.harvest_date || payload.exp_date) {
        throw new AppError(
          "Lô ở trạng thái đang canh tác (growing) không được nhập ngày thu hoạch hoặc hạn dùng",
          400,
        );
      }
    } else if (status === "in_stock") {
      // Nhập lô đã thu hoạch vào kho
      harvestDate =
        payload.harvest_date || new Date().toISOString().split("T")[0];

      if (payload.exp_date) {
        expDate = payload.exp_date;
      } else {
        // Tự động tính hạn dùng = harvest_date + preservation_days của sản phẩm
        const hDate = new Date(harvestDate);
        hDate.setDate(hDate.getDate() + Number(product.preservation_days || 5));
        expDate = hDate.toISOString().split("T")[0];
      }

      if (expDate < harvestDate) {
        throw new AppError(
          "Hạn sử dụng không được trước ngày thu hoạch (UC04 - E5)",
          400,
        );
      }
    }

    if (
      payload.sowing_date &&
      harvestDate &&
      payload.sowing_date > harvestDate
    ) {
      throw new AppError("Ngày gieo hạt không được sau ngày thu hoạch", 400);
    }

    const newBatch = await this.batchRepo.createBatch({
      batch_code: batchCode,
      product_id: payload.product_id,
      sowing_date: payload.sowing_date || null,
      harvest_date: harvestDate,
      exp_date: expDate,
      initial_quantity: payload.initial_quantity,
      current_quantity: payload.initial_quantity,
      disposed_quantity: 0,
      status,
    });

    await this.batchRepo.writeActivityLog(
      userId,
      "CREATE_BATCH",
      "batches",
      newBatch.id,
      null,
      newBatch,
    );

    return newBatch;
  }

  async configureFlashSale(
    userId: string,
    batchId: number,
    payload: FlashSaleBatchDTO,
  ) {
    const batch = await this.batchRepo.findBatchById(batchId);
    if (!batch) {
      throw new AppError("Không tìm thấy lô hàng", 404);
    }

    if (batch.status !== "in_stock" || Number(batch.current_quantity) <= 0) {
      throw new AppError(
        "Chỉ có thể cấu hình xả hàng cho lô đang còn tồn kho",
        400,
      );
    }

    if (
      payload.flash_sale_price !== null &&
      batch.product &&
      payload.flash_sale_price >= Number(batch.product.base_price)
    ) {
      throw new AppError(
        `Giá xả hàng (${payload.flash_sale_price}đ) phải thấp hơn giá niêm yết (${batch.product.base_price}đ)`,
        400,
      );
    }

    const updated = await this.batchRepo.updateBatch(batchId, {
      flash_sale_price: payload.flash_sale_price,
      flash_sale_ends_at:
        payload.flash_sale_price === null
          ? null
          : payload.flash_sale_ends_at || null,
    });

    await this.batchRepo.writeActivityLog(
      userId,
      "UPDATE_FLASH_SALE",
      "batches",
      batchId,
      {
        flash_sale_price: batch.flash_sale_price,
        flash_sale_ends_at: batch.flash_sale_ends_at,
      },
      {
        flash_sale_price: updated.flash_sale_price,
        flash_sale_ends_at: updated.flash_sale_ends_at,
      },
    );

    return updated;
  }
}
