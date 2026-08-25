const pad = (value: number) => String(value).padStart(2, "0");

/** Format a Date as a local `datetime-local` input value. */
export function toLocalInputValue(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Convert a `datetime-local` input value to a timezone-aware ISO 8601 string. */
export function localInputToIso(value: string): string {
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart || Number.isNaN(new Date(value).getTime())) {
    return new Date(value).toISOString();
  }
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const localDate = new Date(year, month - 1, day, hour, minute);
  const offsetMinutes = -localDate.getTimezoneOffset();
  const absOffset = Math.abs(offsetMinutes);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMins = String(absOffset % 60).padStart(2, "0");
  return `${datePart}T${timePart}:00${sign}${offsetHours}:${offsetMins}`;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
