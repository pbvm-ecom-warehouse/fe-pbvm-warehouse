function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(formatPrimitive).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, entryValue]) => {
        const formatted = formatPrimitive(entryValue);
        return formatted ? `${key}: ${formatted}` : "";
      })
      .filter(Boolean)
      .join(", ");
  }

  return String(value);
}

export function formatWarehouseItemListValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatPrimitive).filter(Boolean).join(", ");
  }

  return formatPrimitive(value);
}
