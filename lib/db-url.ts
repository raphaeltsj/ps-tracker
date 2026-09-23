// Local SQLite file. Override with DATABASE_URL in .env if needed.
export const DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
