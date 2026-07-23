import type {
  AttributeKey,
  AttributeOption,
} from "../services/warehouse-items.service";

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  CAPACITY: "Dung tích",
  COLOR: "Màu sắc",
  COMPATIBILITY: "Kích thước tương thích",
  CUP_STYLE: "Kiểu ly",
  DIAMETER: "Đường kính",
  FLAVOR: "Hương vị",
  LENGTH: "Chiều dài",
  MATERIAL: "Chất liệu",
  MATERIAL_CATEGORY: "Nhóm nguyên liệu",
  MATERIAL_TYPE: "Loại nguyên liệu",
  PACKAGING_CATEGORY: "Nhóm bao bì",
  PACKAGING_STYLE: "Kiểu bao bì",
  SIZE: "Kích thước",
  SPEC: "Quy cách tồn",
};

export type AttributeOptionStatus = "ACTIVE" | "ALL" | "INACTIVE";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .trim();
}

export function filterAttributeOptions(
  options: AttributeOption[],
  search: string,
  status: AttributeOptionStatus,
) {
  const normalizedSearch = normalizeSearch(search);

  return options.filter((option) => {
    const matchesStatus =
      status === "ALL" ||
      (status === "ACTIVE" ? option.isActive : !option.isActive);
    const haystack = normalizeSearch(
      `${option.name} ${option.code} ${ATTRIBUTE_LABELS[option.key]}`,
    );

    return matchesStatus && haystack.includes(normalizedSearch);
  });
}
