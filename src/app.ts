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
import type { MonitoringRepository } from "@/modules/monitoring/repositories/monitoring.repository.js";
import { PgMonitoringRepository } from "@/modules/monitoring/repositories/pg-monitoring.repository.js";
import { buildMonitoringRoutes } from "@/modules/monitoring/routes/monitoring.route.js";
import { PgStationRepository } from "@/modules/stations/repositories/pg-station.repository.js";
import type { StationRepository } from "@/modules/stations/repositories/station.repository.js";
import { buildStationRoutes } from "@/modules/stations/routes/stations.route.js";

type BuildAppOptions = {
  stationRepository?: StationRepository;
  monitoringRepository?: MonitoringRepository;
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
  const monitoringRepository =
    options.monitoringRepository ?? new PgMonitoringRepository(database);
  const offlineThresholdMinutes =
    options.stationOfflineThresholdMinutes ??
    env.STATION_OFFLINE_THRESHOLD_MINUTES;

  app.register(cookie);
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/api/properties", async () => {
    return (await stationRepository.listProperties?.()) ?? [];
  });
  app.register(
    buildStationRoutes(
      stationRepository,
      offlineThresholdMinutes,
      options.clock,
    ),
    { prefix: "/api/stations" },
  );
  app.register(
    buildMonitoringRoutes(
      monitoringRepository,
      offlineThresholdMinutes,
      options.clock,
    ),
    { prefix: "/api/stations" },
  );

  return app;
}
