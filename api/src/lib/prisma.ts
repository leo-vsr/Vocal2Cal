import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildPrismaDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(rawUrl);

    if (process.env.NODE_ENV === "production" && !parsedUrl.searchParams.has("connection_limit")) {
      // Serverless functions should avoid Prisma's default multi-connection pool.
      parsedUrl.searchParams.set("connection_limit", "1");
    }

    if (process.env.NODE_ENV === "production" && !parsedUrl.searchParams.has("pool_timeout")) {
      parsedUrl.searchParams.set("pool_timeout", "20");
    }

    if (
      process.env.NODE_ENV === "production"
      && parsedUrl.hostname.includes("pooler.supabase.com")
      && parsedUrl.port === "5432"
    ) {
      console.warn(
        "[prisma] DATABASE_URL points to the Supabase session pooler (:5432). "
          + "Use the transaction pooler (:6543) on Vercel to avoid exhausting connections."
      );
    }

    return parsedUrl.toString();
  } catch {
    return rawUrl;
  }
}

function createPrismaClient() {
  const datasourceUrl = buildPrismaDatabaseUrl();

  return new PrismaClient(
    datasourceUrl
      ? {
          datasources: {
            db: {
              url: datasourceUrl,
            },
          },
        }
      : undefined
  );
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
