import type { Booking, BookingInput, BookingStatus } from "../types/api";
import { apiRequest, queryString } from "./client";

export interface BookingFilters {
  range_start?: string;
  range_end?: string;
  entity_type_id?: string;
  entity_id?: string;
  role_definition_id?: string;
  category_id?: string;
  status?: BookingStatus;
  search?: string;
  filters?: Record<string, unknown>;
}

export const listBookings = (filters: BookingFilters = {}) =>
  apiRequest<Booking[]>(`/bookings${queryString(filters)}`);
export const getBooking = (id: string) => apiRequest<Booking>(`/bookings/${id}`);
export const createBooking = (input: BookingInput) =>
  apiRequest<Booking>("/bookings", { method: "POST", body: input });
export const updateBooking = (id: string, input: Partial<BookingInput>) =>
  apiRequest<Booking>(`/bookings/${id}`, { method: "PATCH", body: input });
export const cancelBooking = (id: string) =>
  apiRequest<Booking>(`/bookings/${id}/cancel`, { method: "POST" });
export const deleteBooking = (id: string) =>
  apiRequest<void>(`/bookings/${id}`, { method: "DELETE" });
