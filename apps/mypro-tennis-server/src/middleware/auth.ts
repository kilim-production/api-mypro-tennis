import type { NextFunction, Request, Response } from "express";
import { verifySession, type SessionClaims } from "@mypro/auth";
import { config } from "../config";

declare global {
  namespace Express {
    interface Request {
      session?: SessionClaims;
    }
  }
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return response.status(401).json({ message: "Session requise." });
  try {
    request.session = verifySession(token, config.jwtSecret);
    return next();
  } catch {
    return response.status(401).json({ message: "Session expirée ou invalide." });
  }
}
