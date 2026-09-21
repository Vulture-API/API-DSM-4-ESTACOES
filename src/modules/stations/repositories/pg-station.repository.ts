import type { Pool } from "pg";

import type { StationRepository } from "@/modules/stations/repositories/station.repository.js";
import type {
  CreateStationData,
  ListStationsFilters,
  PaginatedStations,
  Station,
  UpdateStationData,
} from "@/modules/stations/types/station.type.js";

const STATION_COLUMNS = `
  id,
  property_id,
  mac_address,
  name,
  latitude::float8 AS latitude,
  longitude::float8 AS longitude,
  last_communication_at,
  created_at
`;

export class PgStationRepository implements StationRepository {
  constructor(private readonly database: Pool) {}

  async create(data: CreateStationData): Promise<Station> {
    const result = await this.database.query<Station>(
      `
        INSERT INTO stations (property_id, mac_address, name, latitude, longitude, created_at)
        VALUES ($1, $2, $3, $4, $5, current_timestamp)
        RETURNING ${STATION_COLUMNS}
      `,
      [
        data.property_id,
        data.mac_address,
        data.name,
        data.latitude,
        data.longitude,
      ],
    );

    return result.rows[0]!;
  }

  async findMany(filters: ListStationsFilters): Promise<PaginatedStations> {
    const offset = (filters.page - 1) * filters.limit;

    const result = await this.database.query<
      Station & { total_records: string }
    >(
      `
        SELECT
          ${STATION_COLUMNS},
          COUNT(*) OVER() AS total_records
        FROM stations
        WHERE ($1::int IS NULL OR property_id = $1::int)
        ORDER BY id ASC
        LIMIT $2 OFFSET $3
      `,
      [filters.property_id ?? null, filters.limit, offset],
    );

    const totalRecords = Number(result.rows[0]?.total_records ?? 0);
    const data = result.rows.map(
      ({ total_records: _ignored, ...station }) => station,
    );

    return { data, total_records: totalRecords };
  }

  async findById(id: number): Promise<Station | null> {
    const result = await this.database.query<Station>(
      `SELECT ${STATION_COLUMNS} FROM stations WHERE id = $1`,
      [id],
    );

    return result.rows[0] ?? null;
  }

  async findByMacAddress(macAddress: string): Promise<Station | null> {
    const result = await this.database.query<Station>(
      `SELECT ${STATION_COLUMNS} FROM stations WHERE mac_address = $1`,
      [macAddress],
    );

    return result.rows[0] ?? null;
  }

  async update(id: number, data: UpdateStationData): Promise<Station | null> {
    const result = await this.database.query<Station>(
      `
        UPDATE stations
        SET property_id = $2, mac_address = $3, name = $4, latitude = $5, longitude = $6
        WHERE id = $1
        RETURNING ${STATION_COLUMNS}
      `,
      [
        id,
        data.property_id,
        data.mac_address,
        data.name,
        data.latitude,
        data.longitude,
      ],
    );

    return result.rows[0] ?? null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM stations WHERE id = $1`,
      [id],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async propertyExists(propertyId: number): Promise<boolean> {
    const result = await this.database.query(
      `SELECT 1 FROM properties WHERE id = $1`,
      [propertyId],
    );

    return (result.rowCount ?? 0) > 0;
  }
}
