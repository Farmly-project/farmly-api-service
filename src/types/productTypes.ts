export interface CreateCategoryDTO {
  name: string;
  slug?: string;
  description?: string;
  image_url?: string;
  allow_subscription?: boolean;
  is_active?: boolean;
}

export interface UpdateCategoryDTO extends Partial<CreateCategoryDTO> {}

export interface ProductImageInput {
  image_url: string;
  is_primary?: boolean;
  display_order?: number;
}

export interface CreateProductDTO {
  category_id?: number | null;
  name: string;
  slug?: string;
  unit?: string;
  base_price: number;
  short_description?: string;
  description?: string;
  preservation_days?: number;
  is_active?: boolean;
  images?: ProductImageInput[];
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: number;
  min_price?: number;
  max_price?: number;
  allow_subscription?: boolean;
  sort_by?: "newest" | "price_asc" | "price_desc";
}

export interface CreateCertificationDTO {
  cert_name: string;
  cert_number?: string;
  issued_by?: string;
  issue_date?: string;
  expiry_date?: string;
}
