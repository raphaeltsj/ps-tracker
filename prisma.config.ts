import { defineConfig } from "prisma/config";
import { DATABASE_URL } from "./lib/db-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: DATABASE_URL,
  },
});
