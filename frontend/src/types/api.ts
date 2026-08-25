export interface HealthResponse {
  status: "ok";
  service: string;
}

export type FieldDataType = "text" | "number" | "boolean" | "date" | "select";
export type BookingStatus = "confirmed" | "tentative" | "cancelled";
export type DurationMode = "suggested" | "fixed";
export type CustomValue = string | number | boolean | null;

export interface FieldDefinition {
  id: string;
  entity_type_id: string;
  key: string;
  label: string;
  data_type: FieldDataType;
  is_required: boolean;
  is_searchable: boolean;
  is_filterable: boolean;
  display_order: number;
  select_options: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldDefinitionInput {
  key: string;
  label: string;
  data_type: FieldDataType;
  is_required?: boolean;
  is_searchable?: boolean;
  is_filterable?: boolean;
  display_order?: number;
  select_options?: string[] | null;
}

export interface RoleDefinition {
  id: string;
  key: string;
  label: string;
  booking_scope: string;
  entity_type_id: string;
  is_required: boolean;
  allow_multiple: boolean;
  is_exclusive: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleDefinitionInput {
  key: string;
  label: string;
  booking_scope?: string;
  entity_type_id: string;
  is_required?: boolean;
  allow_multiple?: boolean;
  is_exclusive?: boolean;
  display_order?: number;
}

export interface EntityType {
  id: string;
  key: string;
  name: string;
  color: string | null;
  is_active: boolean;
  fields: FieldDefinition[];
  roles: RoleDefinition[];
  created_at: string;
  updated_at: string;
}

export interface EntityTypeInput {
  key: string;
  name: string;
  color?: string | null;
  fields?: FieldDefinitionInput[];
}

export interface EntityCategory {
  id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  is_active: boolean;
  path: string[];
  created_at: string;
  updated_at: string;
}

export interface EntityCategoryInput {
  name: string;
  parent_id?: string | null;
  color?: string | null;
}

export interface Entity {
  id: string;
  name: string;
  entity_type_id: string;
  entity_type_key: string;
  entity_type_name: string;
  category_id: string | null;
  category_path: string[];
  color: string | null;
  resolved_color: string;
  is_active: boolean;
  values: Record<string, CustomValue>;
  created_at: string;
  updated_at: string;
}

export interface EntityInput {
  name: string;
  entity_type_id: string;
  category_id?: string | null;
  color?: string | null;
  values?: Record<string, CustomValue>;
}

export interface BookingType {
  id: string;
  key: string;
  name: string;
  booking_scope: string;
  default_duration_minutes: number | null;
  duration_mode: DurationMode;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingTypeInput {
  key: string;
  name: string;
  booking_scope?: string;
  default_duration_minutes?: number | null;
  duration_mode?: DurationMode;
}

export interface BookingParticipantInput {
  entity_id: string;
  role_definition_id: string;
  display_order?: number;
}

export interface BookingParticipant extends Required<BookingParticipantInput> {
  id: string;
  entity_name: string;
  entity_type_id: string;
  entity_type_key: string;
  role_key: string;
  role_label: string;
  booking_scope: string;
  is_exclusive: boolean;
  resolved_color: string;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  participants: BookingParticipant[];
  start_at: string;
  end_at: string;
  status: BookingStatus;
  notes: string | null;
  booking_type: BookingType | null;
  created_at: string;
  updated_at: string;
}

export interface BookingInput {
  participants: BookingParticipantInput[];
  start_at: string;
  end_at: string;
  status?: BookingStatus;
  notes?: string | null;
  booking_type_id?: string | null;
}

export interface BookingConflict {
  booking_id: string;
  entity_id: string;
  entity_name: string;
  requested_role_id: string;
  requested_role_key: string;
  conflicting_role_id: string;
  conflicting_role_key: string;
  start_at: string;
  end_at: string;
}

export interface BusinessHours {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

export interface BusinessHoursInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

export interface AvailabilityFilters {
  start_at: string;
  end_at: string;
  role_definition_id?: string;
  entity_type_id?: string;
  category_id?: string;
  filters?: Record<string, unknown>;
  exclude_booking_id?: string;
}

export interface OccupancyResponse {
  entity_id: string;
  range_start: string;
  range_end: string;
  bookings: Booking[];
  free_gaps: Array<{ start_at: string; end_at: string }>;
}
