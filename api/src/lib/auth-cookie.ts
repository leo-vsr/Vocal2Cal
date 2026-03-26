import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";

const AUTH_COOKIE_NAME = "vocal2cal_auth";
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

interface AuthCookiePayload {
  userId: string;
  exp: number;
}

function getCookieSecret() {
  return process.env.SESSION_SECRET || "vocal2cal-dev-secret";
}

function sign(value: string) {
  return createHmac("sha256", getCookieSecret()).update(value).digest("base64url");
}

function serialize(payload: AuthCookiePayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function deserialize(rawValue: string): AuthCookiePayload | null {
  const [encodedPayload, encodedSignature] = rawValue.split(".");
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = Buffer.from(sign(encodedPayload));
  const actualSignature = Buffer.from(encodedSignature);

  if (
    expectedSignature.length !== actualSignature.length
    || !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AuthCookiePayload;
    if (!payload.userId || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  } as const;
}

function getCookieClearOptions() {
  const { httpOnly, secure, sameSite, path } = getCookieOptions();
  return { httpOnly, secure, sameSite, path } as const;
}

function parseCookies(req: Request) {
  const rawHeader = req.headers.cookie;
  if (!rawHeader) {
    return new Map<string, string>();
  }

  return new Map(
    rawHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) {
          return [part, ""];
        }
        const key = part.slice(0, separatorIndex);
        const value = decodeURIComponent(part.slice(separatorIndex + 1));
        return [key, value];
      })
  );
}

export function setAuthCookie(res: Response, userId: string) {
  const value = serialize({
    userId,
    exp: Date.now() + AUTH_COOKIE_MAX_AGE,
  });

  res.cookie(AUTH_COOKIE_NAME, value, getCookieOptions());
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, getCookieClearOptions());
}

export function getAuthenticatedUserId(req: Request) {
  if (req.session?.userId) {
    return req.session.userId;
  }

  const rawCookie = parseCookies(req).get(AUTH_COOKIE_NAME);
  if (!rawCookie) {
    return null;
  }

  const payload = deserialize(rawCookie);
  if (!payload) {
    return null;
  }

  if (req.session) {
    req.session.userId = payload.userId;
  }

  return payload.userId;
}
