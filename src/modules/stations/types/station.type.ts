export type Station = {
  id: number;
  property_id: number;
  mac_address: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  last_communication_at: Date | null;
  created_at: Date;
};

export type CreateStationData = {
  property_id: number;
  mac_address: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

export type UpdateStationData = CreateStationData;

export type ListStationsFilters = {
  page: number;
  limit: number;
  property_id?: number | undefined;
};

export type PaginatedStations = {
  data: Station[];
  total_records: number;
};
