import { BatchRepository } from "../repositories/batchRepository";
import { CreateFarmingLogDTO } from "../types/batchTypes";
import { AppError } from "../utils/appError";
import { generateBatchQrCode } from "../utils/qrUtil";
import { uploadToSupabaseStorage } from "../utils/storageUtil";

export class FarmingLogService {
  private batchRepo = new BatchRepository();

  async getBatchTimeline(batchId: number) {
    const batch = await this.batchRepo.findBatchById(batchId);
    if (!batch) {
      throw new AppError("Không tìm thấy lô hàng", 404);
    }

    const logs = await this.batchRepo.findFarmingLogsByBatchId(batchId);
    return {
      batch_id: batch.id,
      batch_code: batch.batch_code,
      status: batch.status,
      sowing_date: batch.sowing_date,
      harvest_date: batch.harvest_date,
      exp_date: batch.exp_date,
      qr_code: batch.qr_code,
      logs,
    };
  }

  async addFarmingLog(
    userId: string,
    batchId: number,
    payload: CreateFarmingLogDTO,
    file?: Express.Multer.File,
  ) {
    const batch = await this.batchRepo.findBatchById(batchId);
    if (!batch) {
      throw new AppError("Không tìm thấy lô hàng", 404);
    }

    // UC04 - E3: Kiểm tra thời gian thực hiện không được ở tương lai hoặc trước ngày gieo hạt
    const loggedAtDate = payload.logged_at
      ? new Date(payload.logged_at)
      : new Date();
    if (isNaN(loggedAtDate.getTime())) {
      throw new AppError("Thời gian thực hiện (logged_at) không hợp lệ", 400);
    }

    if (loggedAtDate.getTime() > Date.now() + 60 * 1000) {
      throw new AppError(
        "Ngày thực hiện nhật ký không được lớn hơn thời điểm hiện tại",
        400,
      );
    }

    const loggedDateOnly = loggedAtDate.toISOString().split("T")[0];
    if (batch.sowing_date && loggedDateOnly < batch.sowing_date) {
      throw new AppError(
        `Ngày thực hiện (${loggedDateOnly}) không được trước ngày gieo hạt (${batch.sowing_date})`,
        400,
      );
    }

    // Upload ảnh/video minh chứng nếu có
    let evidenceUrl: string | null = null;
    if (file) {
      evidenceUrl = await uploadToSupabaseStorage(
        file,
        process.env.SUPABASE_STORAGE_BUCKET || "farmly-media",
        `farming-logs/batch-${batchId}`,
      );
    }

    const newLog = await this.batchRepo.createFarmingLog({
      batch_id: batchId,
      performed_by: userId,
      stage: payload.stage,
      title: payload.title,
      description: payload.description || null,
      evidence_image_url: evidenceUrl,
      logged_at: loggedAtDate.toISOString(),
    });

    // Cập nhật mốc thời gian tương ứng trên bảng batches nếu cần
    const batchUpdates: Record<string, any> = {};
    if (payload.stage === "sowing" && !batch.sowing_date) {
      batchUpdates.sowing_date = loggedDateOnly;
    }

    // UC04 Bước 5-6: Nếu Farm Staff ghi nhật ký Thu hoạch (harvesting) cho lô đang trồng -> Chuyển sang in_stock
    if (payload.stage === "harvesting" && batch.status === "growing") {
      const harvestDate = loggedDateOnly;
      let expDate = payload.exp_date;
      if (!expDate) {
        const calcExp = new Date(harvestDate);
        calcExp.setDate(
          calcExp.getDate() + Number(batch.product?.preservation_days || 5),
        );
        expDate = calcExp.toISOString().split("T")[0];
      }
      if (expDate < harvestDate) {
        throw new AppError("Hạn sử dụng không được trước ngày thu hoạch", 400);
      }
      batchUpdates.status = "in_stock";
      batchUpdates.harvest_date = harvestDate;
      batchUpdates.exp_date = expDate;
    }

    if (Object.keys(batchUpdates).length > 0) {
      await this.batchRepo.updateBatch(batchId, batchUpdates);
    }

    return newLog;
  }

  // UC04 Bước 7-8 & UC22: Sinh mã QR cho lô hàng đã thu hoạch
  async generateQrForBatch(userId: string, batchId: number) {
    const batch = await this.batchRepo.findBatchById(batchId);
    if (!batch) {
      throw new AppError("Không tìm thấy lô hàng", 404);
    }

    // UC04 - E1: Lô chưa ở trạng thái Đã thu hoạch -> Trả lỗi 409 Conflict
    if (batch.status === "growing" || !batch.harvest_date) {
      throw new AppError(
        "Lô hàng đang ở trạng thái canh tác (chưa thu hoạch), không thể sinh mã QR",
        409,
      );
    }

    // UC04 - E2: Kiểm tra lô phải có ít nhất 1 nhật ký Gieo hạt (sowing)
    const logs = await this.batchRepo.findFarmingLogsByBatchId(batchId);
    const hasSowingLog = logs.some((log: any) => log.stage === "sowing");
    if (!hasSowingLog) {
      throw new AppError(
        "Lô chưa có nhật ký gieo hạt (sowing), không thể sinh mã QR",
        400,
      );
    }

    // UC04 - A2: Nếu lô đã có mã QR -> Không sinh mới, trả về QR cũ để in lại tem
    const qrResult = await generateBatchQrCode(batch.batch_code);

    if (!batch.qr_code) {
      await this.batchRepo.updateBatch(batchId, {
        qr_code: qrResult.trace_link,
      });

      await this.batchRepo.writeActivityLog(
        userId,
        "GENERATE_QR",
        "batches",
        batchId,
        { qr_code: null },
        { qr_code: qrResult.trace_link },
      );
    }

    return {
      batch_id: batch.id,
      batch_code: batch.batch_code,
      qr_code: batch.qr_code || qrResult.trace_link,
      qr_image_base64: qrResult.qr_image_base64,
    };
  }

  // UC10: Trang công khai truy xuất nguồn gốc khi quét mã QR (không chứa thông tin khách hàng/đơn hàng)
  async traceBatchPublic(batchCode: string) {
    const batch = await this.batchRepo.findBatchByCode(batchCode.trim());
    if (!batch) {
      throw new AppError(
        `Không tìm thấy thông tin truy xuất cho mã lô "${batchCode}"`,
        404,
      );
    }

    // Tăng lượt quét QR
    await this.batchRepo.incrementQrScanCount(
      batch.id,
      batch.qr_scan_count || 0,
    );

    const logs = await this.batchRepo.findFarmingLogsByBatchId(batch.id);

    const productData: any = batch.product || {};
    const activeImages = (productData.images || []).filter(
      (img: any) => !img.deleted_at,
    );
    const primaryImage =
      activeImages.find((img: any) => img.is_primary)?.image_url ||
      activeImages[0]?.image_url ||
      null;
    const activeCerts = (productData.certifications || []).filter(
      (c: any) => !c.deleted_at,
    );

    return {
      batch_code: batch.batch_code,
      status: batch.status,
      sowing_date: batch.sowing_date,
      harvest_date: batch.harvest_date,
      exp_date: batch.exp_date,
      qr_scan_count: (batch.qr_scan_count || 0) + 1,
      product: {
        id: productData.id,
        name: productData.name,
        unit: productData.unit,
        description: productData.description,
        category: productData.category,
        primary_image: primaryImage,
        certifications: activeCerts,
      },
      farming_timeline: logs,
    };
  }
}
