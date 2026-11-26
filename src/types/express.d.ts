import { AuthUserPayload } from "./authTypes";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      accessToken?: string;
    }
  }
}
