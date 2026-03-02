import { google } from "googleapis";
import { prisma } from "./prisma";

class ReauthRequiredError extends Error {
  constructor() {
    super("SESSION_EXPIRED");
  }
}

export { ReauthRequiredError };

export async function getValidAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.accessToken) {
    throw new ReauthRequiredError();
  }

  // If token is not expired, use it directly
  if (!user.tokenExpiry || user.tokenExpiry.getTime() > Date.now()) {
    return user.accessToken;
  }

  // Token is expired — try to refresh
  if (!user.refreshToken) {
    throw new ReauthRequiredError();
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: user.refreshToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error("Google token refresh failed:", errorBody);
    throw new ReauthRequiredError();
  }

  const tokens = await response.json();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      accessToken: tokens.access_token,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  return tokens.access_token as string;
}

export function getCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}
