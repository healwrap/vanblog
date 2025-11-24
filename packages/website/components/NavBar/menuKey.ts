import type { MenuItem } from "../../api/getAllData";

export const getMenuItemKey = (
  item: MenuItem,
  extra?: string | number
): string => {
  const base = [
    item.id ?? "menu",
    item.level ?? 0,
    item.value ?? "value",
    item.name ?? "name",
  ].join("-");
  if (extra === undefined || extra === null) {
    return base;
  }
  return `${base}-${extra}`;
};

