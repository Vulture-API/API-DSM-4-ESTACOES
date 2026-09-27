import "dotenv/config";
import "@/config/zod.config.js";

import z from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string(),
  STATION_OFFLINE_THRESHOLD_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const errors = result.error.issues
    .map((error) => `- ${error.path.join(".")}: ${error.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${errors}`);
}

export const env = result.data;
