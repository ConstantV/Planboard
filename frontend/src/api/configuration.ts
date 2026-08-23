import type {
  EntityType,
  EntityTypeInput,
  FieldDefinition,
  FieldDefinitionInput,
  RoleDefinition,
  RoleDefinitionInput,
} from "../types/api";
import { apiRequest, queryString } from "./client";

export const listEntityTypes = (includeInactive = false) =>
  apiRequest<EntityType[]>(`/entity-types${queryString({ include_inactive: includeInactive })}`);

export const getEntityType = (id: string) => apiRequest<EntityType>(`/entity-types/${id}`);

export const createEntityType = (input: EntityTypeInput) =>
  apiRequest<EntityType>("/entity-types", { method: "POST", body: input });

export const updateEntityType = (id: string, input: Partial<EntityTypeInput>) =>
  apiRequest<EntityType>(`/entity-types/${id}`, { method: "PATCH", body: input });

export const deactivateEntityType = (id: string) =>
  apiRequest<EntityType>(`/entity-types/${id}/deactivate`, { method: "POST" });

export const createFieldDefinition = (entityTypeId: string, input: FieldDefinitionInput) =>
  apiRequest<FieldDefinition>(`/entity-types/${entityTypeId}/fields`, {
    method: "POST",
    body: input,
  });

export const updateFieldDefinition = (id: string, input: Partial<FieldDefinitionInput>) =>
  apiRequest<FieldDefinition>(`/field-definitions/${id}`, { method: "PATCH", body: input });

export const deactivateFieldDefinition = (id: string) =>
  apiRequest<FieldDefinition>(`/field-definitions/${id}/deactivate`, { method: "POST" });

export const listRoleDefinitions = (entityTypeId?: string, includeInactive = false) =>
  apiRequest<RoleDefinition[]>(
    `/role-definitions${queryString({
      entity_type_id: entityTypeId,
      include_inactive: includeInactive,
    })}`,
  );

export const createRoleDefinition = (input: RoleDefinitionInput) =>
  apiRequest<RoleDefinition>("/role-definitions", { method: "POST", body: input });

export const updateRoleDefinition = (
  id: string,
  input: Partial<RoleDefinitionInput>,
) => apiRequest<RoleDefinition>(`/role-definitions/${id}`, { method: "PATCH", body: input });

export const deactivateRoleDefinition = (id: string) =>
  apiRequest<RoleDefinition>(`/role-definitions/${id}/deactivate`, { method: "POST" });

export const installPreset = (key: "hair_salon" | "rental" | "repair_workshop") =>
  apiRequest<EntityType[]>(`/presets/${key}`, { method: "POST" });
