import { format } from "date-fns";

export function formatDateTime(value: string | Date) {
  return format(new Date(value), "dd/MM/yyyy HH:mm");
}
