import type { RequestHandler } from "express";
import type { UserRole } from "@resolveai/shared";
import { AuthenticationError, getUserFromToken } from "../services/authService.js";

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header("authorization");
    const [scheme, token] = header?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      throw new AuthenticationError("Missing bearer token");
    }

    req.authUser = await getUserFromToken(token);
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuthenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header("authorization");

    if (!header) {
      next();
      return;
    }

    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      // Invalid header format — skip auth silently for optional routes
      next();
      return;
    }

    req.authUser = await getUserFromToken(token);
    next();
  } catch {
    // Token is invalid or expired — skip auth silently for optional routes
    // The request will continue without req.authUser set
    next();
  }
};

export function authorizeRoles(...roles: UserRole[]): RequestHandler {
  // STAFF and TECHNICIAN are treated as equivalent roles
  const expandedRoles = new Set(roles);
  if (expandedRoles.has("STAFF")) expandedRoles.add("TECHNICIAN");
  if (expandedRoles.has("TECHNICIAN")) expandedRoles.add("STAFF");

  return (req, _res, next) => {
    if (!req.authUser) {
      next(new AuthenticationError("Authentication required"));
      return;
    }

    if (!expandedRoles.has(req.authUser.role)) {
      const error = new Error("Forbidden");
      error.name = "AuthorizationError";
      next(error);
      return;
    }

    next();
  };
}
