import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { DATABASE_URL } from "@/lib/db-url";

// Reuse one client across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: DATABASE_URL }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
