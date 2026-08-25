import type { AvailabilityFilters, Entity, OccupancyResponse } from "../types/api";
import { apiRequest, queryString } from "./client";

export const findAvailability = (filters: AvailabilityFilters) =>
  apiRequest<Entity[]>(`/availability${queryString(filters)}`);

export const getEntityOccupancy = (
  entityId: string,
  rangeStart: string,
  rangeEnd: string,
) =>
  apiRequest<OccupancyResponse>(
    `/entities/${entityId}/occupancy${queryString({
      range_start: rangeStart,
      range_end: rangeEnd,
    })}`,
  );
