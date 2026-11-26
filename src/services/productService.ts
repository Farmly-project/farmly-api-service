import { ProductRepository } from "../repositories/productRepository";
import {
  CreateCategoryDTO,
  CreateCertificationDTO,
  CreateProductDTO,
  ProductQueryParams,
  UpdateCategoryDTO,
  UpdateProductDTO,
} from "../types/productTypes";
import { AppError } from "../utils/appError";
import { uploadToSupabaseStorage } from "../utils/storageUtil";

export class ProductService {
  private productRepo = new ProductRepository();

  // Hàm chuẩn hóa chuỗi tiếng Việt có dấu thành slug không dấu
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  // --- DANH MỤC ---
  async getCategories() {
    return await this.productRepo.findAllCategories(false);
  }

  async getCategoryDetail(id: number) {
    const category = await this.productRepo.findCategoryById(id);
    if (!category) {
      throw new AppError("Không tìm thấy danh mục nông sản", 404);
    }
    return category;
  }

  async createCategory(payload: CreateCategoryDTO) {
    const slug = payload.slug
      ? this.generateSlug(payload.slug)
      : this.generateSlug(payload.name);
    return await this.productRepo.createCategory({ ...payload, slug });
  }

  async updateCategory(id: number, payload: UpdateCategoryDTO) {
    const updateData: UpdateCategoryDTO = { ...payload };
    if (payload.slug) {
      updateData.slug = this.generateSlug(payload.slug);
    } else if (payload.name && !payload.slug) {
      updateData.slug = this.generateSlug(payload.name);
    }
    return await this.productRepo.updateCategory(id, updateData);
  }

  async deleteCategory(id: number) {
    return await this.productRepo.softDeleteCategory(id);
  }

  // --- SẢN PHẨM ---
  async getProducts(params: ProductQueryParams) {
    return await this.productRepo.findAllProducts(params);
  }

  async getProductDetail(id: number) {
    const product = await this.productRepo.findProductById(id);
    if (!product || !product.is_active) {
      throw new AppError(
        "Sản phẩm không tồn tại hoặc đã ngừng kinh doanh",
        404,
      );
    }
    return product;
  }

  async createProduct(payload: CreateProductDTO) {
    if (payload.category_id) {
      const cat = await this.productRepo.findCategoryById(payload.category_id);
      if (!cat) {
        throw new AppError("Danh mục được chọn không tồn tại", 400);
      }
    }

    const slug = payload.slug
      ? this.generateSlug(payload.slug)
      : this.generateSlug(payload.name);
    return await this.productRepo.createProduct({ ...payload, slug });
  }

  async updateProduct(id: number, payload: UpdateProductDTO) {
    if (payload.category_id) {
      const cat = await this.productRepo.findCategoryById(payload.category_id);
      if (!cat) {
        throw new AppError("Danh mục được chọn không tồn tại", 400);
      }
    }

    const updateData: UpdateProductDTO = { ...payload };
    if (payload.slug) {
      updateData.slug = this.generateSlug(payload.slug);
    }
    return await this.productRepo.updateProduct(id, updateData);
  }

  async deleteProduct(id: number) {
    return await this.productRepo.softDeleteProduct(id);
  }

  // --- CHỨNG NHẬN KIỂM ĐỊNH (VietGAP, GlobalGAP, USDA...) ---
  async addCertification(
    productId: number,
    payload: CreateCertificationDTO,
    file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppError(
        "Vui lòng đính kèm file scan chứng nhận (PDF, JPG, PNG, WEBP)",
        400,
      );
    }

    const product = await this.productRepo.findProductById(productId);
    if (!product) {
      throw new AppError("Không tìm thấy sản phẩm để gắn chứng nhận", 404);
    }

    if (
      payload.issue_date &&
      payload.expiry_date &&
      payload.expiry_date < payload.issue_date
    ) {
      throw new AppError(
        "Ngày hết hạn chứng nhận không được trước ngày cấp",
        400,
      );
    }

    // Upload file lên bucket 'farmly-media' (hoặc 'certifications') trên Supabase Storage
    const fileUrl = await uploadToSupabaseStorage(
      file,
      process.env.SUPABASE_STORAGE_BUCKET || "farmly-media",
      `certifications/product-${productId}`,
    );

    return await this.productRepo.createCertification(productId, {
      ...payload,
      file_url: fileUrl,
    });
  }
}
