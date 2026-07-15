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
    const record = value as Record<string, unknown>;
    const unit = formatPrimitive(record.unit);
    const factor = formatPrimitive(record.factor ?? record.quantity);

    if (unit || factor) {
      return [unit, factor ? `x${factor}` : ""].filter(Boolean).join(" ");
    }

    const name = formatPrimitive(record.name);
    const entryValue = formatPrimitive(record.value);
    const code = formatPrimitive(record.code);

    if (name || entryValue || code) {
      const label = name && entryValue ? `${name}: ${entryValue}` : name || entryValue;
      return [label, code ? `(${code})` : ""].filter(Boolean).join(" ");
    }

    return Object.values(record).map(formatPrimitive).filter(Boolean).join(", ");
  }

  return String(value);
}

export function formatWarehouseItemListValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatPrimitive).filter(Boolean).join(", ");
  }

  return formatPrimitive(value);
}
