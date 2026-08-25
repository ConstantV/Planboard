import type { BusinessHours, BusinessHoursInput } from "../types/api";
import { apiRequest } from "./client";

export const listBusinessHours = () => apiRequest<BusinessHours[]>("/business-hours");

export const updateBusinessHours = (items: BusinessHoursInput[]) =>
  apiRequest<BusinessHours[]>("/business-hours", { method: "PUT", body: items });
