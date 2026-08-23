import type { Entity, EntityCategory, EntityCategoryInput, EntityInput } from "../types/api";
import { apiRequest, queryString } from "./client";

export interface EntityFilters {
  entity_type_id?: string;
  category_id?: string;
  search?: string;
  filters?: Record<string, unknown>;
  include_inactive?: boolean;
}

export const listEntities = (filters: EntityFilters = {}) =>
  apiRequest<Entity[]>(`/entities${queryString(filters)}`);
export const getEntity = (id: string) => apiRequest<Entity>(`/entities/${id}`);
export const createEntity = (input: EntityInput) =>
  apiRequest<Entity>("/entities", { method: "POST", body: input });
export const updateEntity = (id: string, input: Partial<EntityInput>) =>
  apiRequest<Entity>(`/entities/${id}`, { method: "PATCH", body: input });
export const deactivateEntity = (id: string) =>
  apiRequest<Entity>(`/entities/${id}/deactivate`, { method: "POST" });

export const listCategories = (includeInactive = false) =>
  apiRequest<EntityCategory[]>(
    `/categories${queryString({ include_inactive: includeInactive })}`,
  );
export const getCategory = (id: string) => apiRequest<EntityCategory>(`/categories/${id}`);
export const createCategory = (input: EntityCategoryInput) =>
  apiRequest<EntityCategory>("/categories", { method: "POST", body: input });
export const updateCategory = (id: string, input: Partial<EntityCategoryInput>) =>
  apiRequest<EntityCategory>(`/categories/${id}`, { method: "PATCH", body: input });
export const deactivateCategory = (id: string) =>
  apiRequest<EntityCategory>(`/categories/${id}/deactivate`, { method: "POST" });
