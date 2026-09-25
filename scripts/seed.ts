import { Pool } from "pg";

import { env } from "../src/config/environment.js";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

async function seed() {
  console.log("Iniciando população do banco de dados...");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Garantir usuário proprietário
    const userRes = await client.query(
      "SELECT id FROM users ORDER BY id ASC LIMIT 1",
    );
    const ownerUserId = userRes.rows[0]?.id ?? 1;

    // 2. Popular propriedades
    const propertiesData = [
      { name: "Fazenda Santa Clara", location: "Piracicaba - SP" },
      { name: "Sítio Boa Vista", location: "Jacareí - SP" },
      { name: "Fazenda Santa Rita", location: "São José dos Campos - SP" },
      { name: "Fazenda Boa Vista", location: "Taubaté - SP" },
      { name: "Fazenda Esperança", location: "Jacareí - SP" },
      { name: "Fazenda Água Limpa", location: "Pindamonhangaba - SP" },
    ];

    const propertyIds: Record<string, number> = {};

    for (const prop of propertiesData) {
      const existing = await client.query(
        "SELECT id FROM properties WHERE name = $1",
        [prop.name],
      );
      if (existing.rows.length > 0) {
        propertyIds[prop.name] = existing.rows[0].id;
      } else {
        const inserted = await client.query(
          "INSERT INTO properties (name, location, owner_user_id, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id",
          [prop.name, prop.location, ownerUserId],
        );
        propertyIds[prop.name] = inserted.rows[0].id;
      }
    }

    console.log("Propriedades cadastradas/existentes:", propertyIds);

    // 3. Garantir tipos de sensores básicos
    const sensorTypesData = [
      { name: "Pressão", unit: "hPa", factor: 1.0, gain: 1.0 },
      { name: "Índice Pluviométrico", unit: "mm", factor: 1.0, gain: 1.0 },
      { name: "Temperatura", unit: "°C", factor: 1.0, gain: 1.0 },
      { name: "Velocidade do Vento", unit: "km/h", factor: 1.0, gain: 1.0 },
      { name: "Umidade", unit: "%", factor: 1.0, gain: 1.0 },
    ];

    const sensorTypeIds: Record<string, number> = {};
    for (const st of sensorTypesData) {
      const existing = await client.query(
        "SELECT id FROM sensor_types WHERE name = $1",
        [st.name],
      );
      if (existing.rows.length > 0) {
        sensorTypeIds[st.name] = existing.rows[0].id;
      } else {
        const inserted = await client.query(
          "INSERT INTO sensor_types (name, unit_of_measure, factor, gain) VALUES ($1, $2, $3, $4) RETURNING id",
          [st.name, st.unit, st.factor, st.gain],
        );
        sensorTypeIds[st.name] = inserted.rows[0].id;
      }
    }

    // 4. Popular estações
    const stationsData = [
      {
        name: "Estação 01",
        propriedade: "Fazenda Santa Rita",
        mac_address: "00:1A:2B:3C:4D:01",
        latitude: -23.1791,
        longitude: -45.8872,
        minutesAgo: 2,
      },
      {
        name: "Estação 02",
        propriedade: "Fazenda Santa Rita",
        mac_address: "00:1A:2B:3C:4D:02",
        latitude: -23.1755,
        longitude: -45.879,
        minutesAgo: 4,
      },
      {
        name: "Estação 03",
        propriedade: "Fazenda Santa Rita",
        mac_address: "00:1A:2B:3C:4D:03",
        latitude: -23.1702,
        longitude: -45.876,
        minutesAgo: 1,
      },
      {
        name: "Estação 04",
        propriedade: "Fazenda Boa Vista",
        mac_address: "00:1A:2B:3C:4D:04",
        latitude: -23.1868,
        longitude: -45.8901,
        minutesAgo: 15,
      },
      {
        name: "Estação 05",
        propriedade: "Fazenda Boa Vista",
        mac_address: "00:1A:2B:3C:4D:05",
        latitude: -23.181,
        longitude: -45.8845,
        minutesAgo: 40,
      },
      {
        name: "Estação 06",
        propriedade: "Fazenda Esperança",
        mac_address: "00:1A:2B:3C:4D:06",
        latitude: -23.1745,
        longitude: -45.893,
        minutesAgo: 3,
      },
      {
        name: "Estação 07",
        propriedade: "Fazenda Esperança",
        mac_address: "00:1A:2B:3C:4D:07",
        latitude: -23.1799,
        longitude: -45.8801,
        minutesAgo: 5,
      },
      {
        name: "Estação 08",
        propriedade: "Sítio Boa Vista",
        mac_address: "00:1A:2B:3C:4D:08",
        latitude: -23.1912,
        longitude: -45.8888,
        minutesAgo: 60,
      },
      {
        name: "Estação 09",
        propriedade: "Sítio Boa Vista",
        mac_address: "00:1A:2B:3C:4D:09",
        latitude: -23.1955,
        longitude: -45.877,
        minutesAgo: 6,
      },
      {
        name: "Estação 10",
        propriedade: "Fazenda Água Limpa",
        mac_address: "00:1A:2B:3C:4D:10",
        latitude: -23.168,
        longitude: -45.885,
        minutesAgo: 7,
      },
      {
        name: "Estação 11",
        propriedade: "Fazenda Água Limpa",
        mac_address: "00:1A:2B:3C:4D:11",
        latitude: -23.1729,
        longitude: -45.8919,
        minutesAgo: 8,
      },
      {
        name: "Estação 12",
        propriedade: "Fazenda Santa Clara",
        mac_address: "00:1A:2B:3C:4D:12",
        latitude: -23.184,
        longitude: -45.882,
        minutesAgo: 120,
      },
    ];

    for (const st of stationsData) {
      const propId = propertyIds[st.propriedade] || 1;
      const lastComm = `NOW() - INTERVAL '${st.minutesAgo} minutes'`;

      const existing = await client.query(
        "SELECT id FROM stations WHERE mac_address = $1",
        [st.mac_address],
      );

      let stationId: number;
      if (existing.rows.length > 0) {
        stationId = existing.rows[0].id;
        await client.query(
          `UPDATE stations SET property_id = $1, name = $2, latitude = $3, longitude = $4, last_communication_at = ${lastComm} WHERE id = $5`,
          [propId, st.name, st.latitude, st.longitude, stationId],
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO stations (property_id, mac_address, name, latitude, longitude, last_communication_at, created_at)
           VALUES ($1, $2, $3, $4, $5, ${lastComm}, NOW() - INTERVAL '30 days')
           RETURNING id`,
          [propId, st.mac_address, st.name, st.latitude, st.longitude],
        );
        stationId = inserted.rows[0].id;
      }

      // Sensores para a estação
      const sensorsConfig = [
        {
          localId: `HUM-${stationId.toString().padStart(2, "0")}`,
          type: "Umidade",
          value: 32 + (stationId % 10),
        },
        {
          localId: `TEMP-${stationId.toString().padStart(2, "0")}`,
          type: "Temperatura",
          value: 22.5 + (stationId % 5),
        },
        {
          localId: `WIND-${stationId.toString().padStart(2, "0")}`,
          type: "Velocidade do Vento",
          value: 12.0 + (stationId % 8),
        },
        {
          localId: `PRESS-${stationId.toString().padStart(2, "0")}`,
          type: "Pressão",
          value: 1013.25 + (stationId % 4),
        },
      ];

      for (const s of sensorsConfig) {
        const typeId = sensorTypeIds[s.type];
        if (!typeId) continue;

        const existingSensor = await client.query(
          "SELECT id FROM sensors WHERE station_id = $1 AND sensor_type_id = $2",
          [stationId, typeId],
        );

        let sensorId: number;
        if (existingSensor.rows.length > 0) {
          sensorId = existingSensor.rows[0].id;
        } else {
          const insertedSensor = await client.query(
            "INSERT INTO sensors (station_id, sensor_type_id, local_identifier, operational_status, created_at) VALUES ($1, $2, $3, true, NOW()) RETURNING id",
            [stationId, typeId, s.localId],
          );
          sensorId = insertedSensor.rows[0].id;
        }

        // Leitura recente
        const existingReading = await client.query(
          "SELECT id FROM readings WHERE sensor_id = $1 LIMIT 1",
          [sensorId],
        );
        if (existingReading.rows.length === 0) {
          await client.query(
            "INSERT INTO readings (sensor_id, value, unix_time, data_consistent, created_at) VALUES ($1, $2, $3, true, NOW())",
            [sensorId, s.value, Math.floor(Date.now() / 1000)],
          );
        }
      }
    }

    await client.query("COMMIT");
    console.log(
      "Banco de dados populado com sucesso com 12 estações, propriedades, sensores e leituras!",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao popular o banco:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
