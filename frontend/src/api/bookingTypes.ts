import type { BookingType, BookingTypeInput } from "../types/api";
import { apiRequest, queryString } from "./client";

export const listBookingTypes = (bookingScope?: string, includeInactive = false) =>
  apiRequest<BookingType[]>(
    `/booking-types${queryString({
      booking_scope: bookingScope,
      include_inactive: includeInactive,
    })}`,
  );

export const getBookingType = (id: string) => apiRequest<BookingType>(`/booking-types/${id}`);

export const createBookingType = (input: BookingTypeInput) =>
  apiRequest<BookingType>("/booking-types", { method: "POST", body: input });

export const updateBookingType = (id: string, input: Partial<BookingTypeInput>) =>
  apiRequest<BookingType>(`/booking-types/${id}`, { method: "PATCH", body: input });

export const deactivateBookingType = (id: string) =>
  apiRequest<BookingType>(`/booking-types/${id}/deactivate`, { method: "POST" });
