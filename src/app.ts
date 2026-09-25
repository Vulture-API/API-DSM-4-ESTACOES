import "@/config/zod.config.js";

import cookie from "@fastify/cookie";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";

import { database } from "@/config/database.js";
import { env } from "@/config/environment.js";
import { handleError } from "@/errors/error-handler.js";
import { PgStationRepository } from "@/modules/stations/repositories/pg-station.repository.js";
import type { StationRepository } from "@/modules/stations/repositories/station.repository.js";
import { buildStationRoutes } from "@/modules/stations/routes/stations.route.js";

type BuildAppOptions = {
  stationRepository?: StationRepository;
  stationOfflineThresholdMinutes?: number;
  clock?: () => Date;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(handleError);

  const stationRepository =
    options.stationRepository ?? new PgStationRepository(database);

  app.register(cookie);
  app.get("/health", async () => ({ status: "ok" }));
  app.register(
    buildStationRoutes(
      stationRepository,
      options.stationOfflineThresholdMinutes ??
        env.STATION_OFFLINE_THRESHOLD_MINUTES,
      options.clock,
    ),
    {
      prefix: "/api/stations",
    },
  );

  return app;
}
