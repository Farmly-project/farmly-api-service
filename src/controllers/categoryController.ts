import { Request, Response, NextFunction } from "express";
import { ProductService } from "../services/productService";
import { sendSuccess } from "../utils/responseUtil";

const productService = new ProductService();

export class CategoryController {
  // GET /api/v1/categories
  getAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await productService.getCategories();
      sendSuccess(res, categories, "Lấy danh sách danh mục thành công");
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/categories/:id
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await productService.getCategoryDetail(
        Number(req.params.id),
      );
      sendSuccess(res, category, "Lấy chi tiết danh mục thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/categories
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await productService.createCategory(req.body);
      sendSuccess(res, category, "Tạo danh mục nông sản mới thành công", 201);
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v1/categories/:id
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await productService.updateCategory(
        Number(req.params.id),
        req.body,
      );
      sendSuccess(res, category, "Cập nhật danh mục thành công");
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/v1/categories/:id
  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await productService.deleteCategory(Number(req.params.id));
      sendSuccess(res, null, "Đã xóa mềm danh mục nông sản");
    } catch (error) {
      next(error);
    }
  };
}
