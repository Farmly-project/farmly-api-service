import { BatchRepository } from "../repositories/batchRepository";
import { ProductRepository } from "../repositories/productRepository";
import { AppError } from "../utils/appError";

export class FefoService {
  private batchRepo = new BatchRepository();
  private productRepo = new ProductRepository();

  async suggestBatchesForProduct(
    productId: number,
    requestedQuantity?: number,
  ) {
    const product = await this.productRepo.findProductById(productId);
    if (!product) {
      throw new AppError("Không tìm thấy sản phẩm", 404);
    }

    // Lấy danh sách lô hợp lệ (status = 'in_stock', current_quantity > 0, exp_date > today)
    const validBatches =
      await this.batchRepo.findAvailableFefoBatches(productId);

    const totalAvailable = validBatches.reduce(
      (sum, b) => sum + Number(b.current_quantity),
      0,
    );

    // Nếu không truyền số lượng cần xuất -> trả về toàn bộ thứ tự lô ưu tiên FEFO
    if (!requestedQuantity || requestedQuantity <= 0) {
      return {
        product_id: productId,
        product_name: product.name,
        total_available_quantity: totalAvailable,
        suggested_batches: validBatches.map((b, index) => ({
          priority: index + 1,
          batch_id: b.id,
          batch_code: b.batch_code,
          harvest_date: b.harvest_date,
          exp_date: b.exp_date,
          available_quantity: Number(b.current_quantity),
          flash_sale_price: b.flash_sale_price,
        })),
      };
    }

    // Mô phỏng phân bổ theo số lượng yêu cầu
    let remaining = requestedQuantity;
    const allocations: Array<{
      priority: number;
      batch_id: number;
      batch_code: string;
      exp_date: string;
      available_quantity: number;
      allocated_quantity: number;
    }> = [];

    for (let i = 0; i < validBatches.length; i++) {
      if (remaining <= 0) break;
      const batch = validBatches[i];
      const available = Number(batch.current_quantity);
      const take = Math.min(remaining, available);

      allocations.push({
        priority: i + 1,
        batch_id: batch.id,
        batch_code: batch.batch_code,
        exp_date: batch.exp_date,
        available_quantity: available,
        allocated_quantity: take,
      });

      remaining = Number((remaining - take).toFixed(2));
    }

    return {
      product_id: productId,
      product_name: product.name,
      requested_quantity: requestedQuantity,
      total_available_quantity: totalAvailable,
      is_sufficient: remaining <= 0,
      shortage_quantity: remaining > 0 ? remaining : 0,
      allocations,
    };
  }
}
