import { supabaseAdmin } from "../config/supabaseClient";
import {
  CreateCategoryDTO,
  CreateCertificationDTO,
  CreateProductDTO,
  ProductQueryParams,
  UpdateCategoryDTO,
  UpdateProductDTO,
} from "../types/productTypes";
import { AppError } from "../utils/appError";

export class ProductRepository {
  // ============================================================================
  // 1. DANH MỤC (CATEGORIES)
  // ============================================================================
  async findAllCategories(includeInactive = false) {
    let query = supabaseAdmin
      .from("categories")
      .select("*")
      .is("deleted_at", null)
      .order("id", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error)
      throw new AppError("Lỗi tải danh sách danh mục: " + error.message, 500);
    return data;
  }

  async findCategoryById(id: number) {
    const { data, error } = await supabaseAdmin
      .from("categories")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) return null;
    return data;
  }

  async createCategory(payload: CreateCategoryDTO & { slug: string }) {
    const { data, error } = await supabaseAdmin
      .from("categories")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Đường dẫn (slug) danh mục đã tồn tại", 409);
      }
      throw new AppError("Tạo danh mục thất bại: " + error.message, 400);
    }
    return data;
  }

  async updateCategory(id: number, payload: UpdateCategoryDTO) {
    const { data, error } = await supabaseAdmin
      .from("categories")
      .update(payload)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Đường dẫn (slug) danh mục đã tồn tại", 409);
      }
      throw new AppError("Cập nhật danh mục thất bại: " + error.message, 400);
    }
    if (!data) throw new AppError("Không tìm thấy danh mục", 404);
    return data;
  }

  async softDeleteCategory(id: number) {
    // Trigger trg_soft_delete_categories trên PostgreSQL tự động chuyển DELETE thành set deleted_at = NOW()
    const existing = await this.findCategoryById(id);
    if (!existing) throw new AppError("Không tìm thấy danh mục để xóa", 404);

    const { error } = await supabaseAdmin
      .from("categories")
      .delete()
      .eq("id", id);
    if (error)
      throw new AppError("Xóa danh mục thất bại: " + error.message, 400);
    return true;
  }

  // ============================================================================
  // 2. SẢN PHẨM (PRODUCTS) & TỒN KHẢ DỤNG FEFO
  // ============================================================================
  async findAllProducts(params: ProductQueryParams) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 && params.limit <= 50
        ? params.limit
        : 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const today = new Date().toISOString().split("T")[0];

    let query = supabaseAdmin
      .from("products")
      .select(
        `
        *,
        category:categories!inner(id, name, slug, allow_subscription),
        images:product_images(id, image_url, is_primary, display_order),
        batches(id, current_quantity, exp_date, status, flash_sale_price, flash_sale_ends_at)
      `,
        { count: "exact" },
      )
      .is("deleted_at", null)
      .eq("is_active", true);

    if (params.search) {
      query = query.ilike("name", `%${params.search}%`);
    }

    if (params.category_id) {
      query = query.eq("category_id", params.category_id);
    }

    if (params.min_price !== undefined) {
      query = query.gte("base_price", params.min_price);
    }

    if (params.max_price !== undefined) {
      query = query.lte("base_price", params.max_price);
    }

    if (params.allow_subscription !== undefined) {
      query = query.eq(
        "categories.allow_subscription",
        params.allow_subscription,
      );
    }

    // Sắp xếp
    if (params.sort_by === "price_asc") {
      query = query.order("base_price", { ascending: true });
    } else if (params.sort_by === "price_desc") {
      query = query.order("base_price", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error)
      throw new AppError("Lỗi tải danh sách sản phẩm: " + error.message, 500);

    // Tính toán tồn khả dụng từ các lô còn hạn (exp_date > today) & ảnh đại diện
    const items = (data || []).map((product: any) => {
      const validBatches = (product.batches || []).filter(
        (b: any) =>
          b.status === "in_stock" &&
          Number(b.current_quantity) > 0 &&
          b.exp_date > today,
      );

      validBatches.sort((a: any, b: any) =>
        a.exp_date.localeCompare(b.exp_date),
      );

      const availableQuantity = validBatches.reduce(
        (sum: number, b: any) => sum + Number(b.current_quantity),
        0,
      );

      const nearestBatch = validBatches[0] || null;
      const activeImages = (product.images || []).filter(
        (img: any) => !img.deleted_at,
      );
      const primaryImage =
        activeImages.find((img: any) => img.is_primary)?.image_url ||
        activeImages[0]?.image_url ||
        null;

      const { batches, ...productInfo } = product;

      return {
        ...productInfo,
        primary_image: primaryImage,
        available_quantity: availableQuantity,
        nearest_exp_date: nearestBatch ? nearestBatch.exp_date : null,
        has_flash_sale: Boolean(
          nearestBatch?.flash_sale_price &&
          (!nearestBatch.flash_sale_ends_at ||
            new Date(nearestBatch.flash_sale_ends_at) > new Date()),
        ),
        flash_sale_price: nearestBatch?.flash_sale_price || null,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total_items: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async findProductById(id: number) {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabaseAdmin
      .from("products")
      .select(
        `
        *,
        category:categories(id, name, slug, allow_subscription),
        images:product_images(id, image_url, is_primary, display_order, deleted_at),
        certifications:quality_certifications(id, cert_name, cert_number, issued_by, issue_date, expiry_date, file_url, deleted_at),
        batches(id, batch_code, harvest_date, exp_date, current_quantity, status, qr_code, flash_sale_price, flash_sale_ends_at)
      `,
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) return null;

    // Lọc các lô còn hạn để tính tồn khả dụng & lấy mã QR lô đang xuất bán (FEFO)
    const validBatches = (data.batches || [])
      .filter(
        (b: any) =>
          b.status === "in_stock" &&
          Number(b.current_quantity) > 0 &&
          b.exp_date > today,
      )
      .sort((a: any, b: any) => a.exp_date.localeCompare(b.exp_date));

    const availableQuantity = validBatches.reduce(
      (sum: number, b: any) => sum + Number(b.current_quantity),
      0,
    );

    const activeImages = (data.images || [])
      .filter((img: any) => !img.deleted_at)
      .sort((a: any, b: any) => a.display_order - b.display_order);

    const activeCertifications = (data.certifications || []).filter(
      (c: any) => !c.deleted_at,
    );

    const { batches, ...rest } = data;

    return {
      ...rest,
      images: activeImages,
      certifications: activeCertifications,
      available_quantity: availableQuantity,
      nearest_exp_date: validBatches[0]?.exp_date || null,
      active_batch_trace: validBatches[0]
        ? {
            batch_code: validBatches[0].batch_code,
            harvest_date: validBatches[0].harvest_date,
            exp_date: validBatches[0].exp_date,
            qr_code: validBatches[0].qr_code,
          }
        : null,
    };
  }

  async createProduct(payload: CreateProductDTO & { slug: string }) {
    const { images, ...productFields } = payload;

    const { data: product, error } = await supabaseAdmin
      .from("products")
      .insert(productFields)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Đường dẫn (slug) sản phẩm đã tồn tại", 409);
      }
      throw new AppError("Tạo sản phẩm thất bại: " + error.message, 400);
    }

    if (images && images.length > 0) {
      const imageRows = images.map((img, idx) => ({
        product_id: product.id,
        image_url: img.image_url,
        is_primary: img.is_primary ?? idx === 0,
        display_order: img.display_order ?? idx,
      }));

      await supabaseAdmin.from("product_images").insert(imageRows);
    }

    return await this.findProductById(product.id);
  }

  async updateProduct(id: number, payload: UpdateProductDTO) {
    const { images, ...productFields } = payload;

    const { data, error } = await supabaseAdmin
      .from("products")
      .update(productFields)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Đường dẫn (slug) sản phẩm đã tồn tại", 409);
      }
      throw new AppError("Cập nhật sản phẩm thất bại: " + error.message, 400);
    }
    if (!data) throw new AppError("Không tìm thấy sản phẩm", 404);

    if (images) {
      // Soft-delete ảnh cũ và chèn danh sách ảnh mới
      await supabaseAdmin.from("product_images").delete().eq("product_id", id);

      if (images.length > 0) {
        const imageRows = images.map((img, idx) => ({
          product_id: id,
          image_url: img.image_url,
          is_primary: img.is_primary ?? idx === 0,
          display_order: img.display_order ?? idx,
        }));
        await supabaseAdmin.from("product_images").insert(imageRows);
      }
    }

    return await this.findProductById(id);
  }

  async softDeleteProduct(id: number) {
    const existing = await this.findProductById(id);
    if (!existing) throw new AppError("Không tìm thấy sản phẩm để xóa", 404);

    // Trigger trg_soft_delete_products tự động set deleted_at = NOW()
    const { error } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", id);
    if (error)
      throw new AppError("Xóa sản phẩm thất bại: " + error.message, 400);
    return true;
  }

  // ============================================================================
  // 3. CHỨNG NHẬN KIỂM ĐỊNH (QUALITY CERTIFICATIONS)
  // ============================================================================
  async createCertification(
    productId: number,
    payload: CreateCertificationDTO & { file_url: string },
  ) {
    const { data, error } = await supabaseAdmin
      .from("quality_certifications")
      .insert({
        product_id: productId,
        ...payload,
      })
      .select("*")
      .single();

    if (error) {
      throw new AppError(
        "Lưu chứng nhận kiểm định thất bại: " + error.message,
        400,
      );
    }
    return data;
  }
}
