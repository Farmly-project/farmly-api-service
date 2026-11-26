import { BatchRepository } from "../repositories/batchRepository";
import { CreateDisposalDTO } from "../types/batchTypes";
import { AppError } from "../utils/appError";
import { uploadToSupabaseStorage } from "../utils/storageUtil";

export class DisposalService {
  private batchRepo = new BatchRepository();

  async createDisposal(
    userId: string,
    payload: CreateDisposalDTO,
    file?: Express.Multer.File,
  ) {
    // 1. Kiểm tra lô hàng tồn tại (UC05 - E1)
    const batch = await this.batchRepo.findBatchById(payload.batch_id);
    if (!batch) {
      throw new AppError(
        `Không tìm thấy lô hàng có ID ${payload.batch_id}`,
        404,
      );
    }

    // 2. Kiểm tra số lượng xuất hủy <= tồn kho hiện tại (UC05 - E2)
    const currentQty = Number(batch.current_quantity);
    if (payload.quantity_disposed > currentQty) {
      throw new AppError(
        `Lô ${batch.batch_code} chỉ còn ${currentQty} đơn vị, không thể xuất hủy ${payload.quantity_disposed}`,
        400,
      );
    }

    // 3. Bắt buộc đính kèm ảnh minh chứng hàng hỏng/dập nát (cột image_url NOT NULL)
    if (!file) {
      throw new AppError(
        "Vui lòng đính kèm hình ảnh minh chứng nông sản hỏng/xuất hủy",
        400,
      );
    }

    const imageUrl = await uploadToSupabaseStorage(
      file,
      process.env.SUPABASE_STORAGE_BUCKET || "farmly-media",
      `disposals/batch-${payload.batch_id}`,
    );

    // 4. Tạo phiếu xuất hủy -> Trigger PostgreSQL tự động trừ current_quantity & tăng disposed_quantity
    const disposal = await this.batchRepo.createDisposal({
      ...payload,
      image_url: imageUrl,
      disposed_by: userId,
    });

    const updatedBatch = await this.batchRepo.findBatchById(payload.batch_id);

    // 5. Ghi nhật ký thao tác kho (NFR-S09)
    await this.batchRepo.writeActivityLog(
      userId,
      "INVENTORY_DISPOSAL",
      "batches",
      payload.batch_id,
      {
        current_quantity: batch.current_quantity,
        disposed_quantity: batch.disposed_quantity,
        status: batch.status,
      },
      {
        current_quantity: updatedBatch?.current_quantity,
        disposed_quantity: updatedBatch?.disposed_quantity,
        status: updatedBatch?.status,
        disposal_id: disposal.id,
        reason: payload.reason,
      },
    );

    return {
      disposal,
      batch_summary: {
        id: updatedBatch?.id,
        batch_code: updatedBatch?.batch_code,
        current_quantity: updatedBatch?.current_quantity,
        disposed_quantity: updatedBatch?.disposed_quantity,
        status: updatedBatch?.status,
      },
    };
  }
}
