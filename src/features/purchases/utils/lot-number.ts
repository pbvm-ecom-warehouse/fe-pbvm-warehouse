const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const LOT_NUMBER_PATTERN = /^LOT-(\d{2})(\d{2})(\d{2})-(\d{3})$/;

export function isCalendarDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function normalizeLotSequence(value: string | number) {
  const sequence = Number(String(value).trim());
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) return "";
  return String(sequence).padStart(3, "0");
}

export function formatLotNumber(
  manufacturedDate: string,
  sequence: string | number,
) {
  if (!isCalendarDate(manufacturedDate)) return "";
  const normalizedSequence = normalizeLotSequence(sequence);
  if (!normalizedSequence) return "";
  const compactDate = manufacturedDate.slice(2).replaceAll("-", "");
  return `LOT-${compactDate}-${normalizedSequence}`;
}

export function parseLotNumber(value: string) {
  const match = LOT_NUMBER_PATTERN.exec(value.trim().toUpperCase());
  if (!match || match[4] === "000") return null;
  const manufacturedDate = `20${match[1]}-${match[2]}-${match[3]}`;
  if (!isCalendarDate(manufacturedDate)) return null;
  return {
    manufacturedDate,
    lotSequence: String(Number(match[4])),
  };
}

export function todayInHoChiMinh(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(now);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}
