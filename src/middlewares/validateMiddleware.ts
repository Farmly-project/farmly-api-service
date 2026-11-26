import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";

interface ParsedRequest {
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
}

export const validate = (schema: ZodType<ParsedRequest>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (parsed.body) req.body = parsed.body;
      if (parsed.query) Object.assign(req.query, parsed.query);
      if (parsed.params) Object.assign(req.params, parsed.params);

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: "error",
          message: "Dữ liệu đầu vào không hợp lệ",
          errors: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      next(error);
    }
  };
};
