import { Request, Response, NextFunction } from "express";
import { ProductService } from "../services/productService";
import { sendSuccess } from "../utils/responseUtil";

const productService = new ProductService();

export class ProductController {
  // GET /api/v1/products
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.getProducts(req.query as any);
      sendSuccess(res, result, "Lấy danh sách sản phẩm thành công");
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/products/:id
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productService.getProductDetail(
        Number(req.params.id),
      );
      sendSuccess(res, product, "Lấy chi tiết sản phẩm thành công");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/products
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productService.createProduct(req.body);
      sendSuccess(res, product, "Tạo sản phẩm mới thành công", 201);
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v1/products/:id
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productService.updateProduct(
        Number(req.params.id),
        req.body,
      );
      sendSuccess(res, product, "Cập nhật sản phẩm thành công");
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/v1/products/:id
  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await productService.deleteProduct(Number(req.params.id));
      sendSuccess(res, null, "Đã xóa mềm sản phẩm");
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/products/:productId/certifications
  uploadCertification = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const productId = Number(req.params.productId);
      const cert = await productService.addCertification(
        productId,
        req.body,
        req.file,
      );
      sendSuccess(res, cert, "Tải lên chứng nhận chất lượng thành công", 201);
    } catch (error) {
      next(error);
    }
  };
}
