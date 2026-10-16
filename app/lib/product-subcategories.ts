import {
  beddingTypeOptions,
  japanTypeOptions,
  koreaTypeOptions,
  plushTypeOptions,
} from "./product-categories";

export type SubcategoryScope = "bedding" | "korea" | "plush" | "japan";

export type ProductSubcategory = {
  id: string;
  scope: SubcategoryScope;
  value: string;
  label: string;
  sortOrder: number;
};

export type StoredProductSubcategory = {
  id: string;
  scope: SubcategoryScope;
  value: string;
  label: string;
  sort_order: number;
};

function defaultsFor(
  scope: SubcategoryScope,
  options: readonly { id: string; label: string }[],
): ProductSubcategory[] {
  return options.map((option, index) => ({
    id: `${scope}-${option.id}`,
    scope,
    value: option.id,
    label: option.label,
    sortOrder: index + 1,
  }));
}

export const defaultProductSubcategories: ProductSubcategory[] = [
  ...defaultsFor("bedding", beddingTypeOptions),
  ...defaultsFor("korea", koreaTypeOptions),
  ...defaultsFor("plush", plushTypeOptions),
  ...defaultsFor("japan", japanTypeOptions),
];

export function toProductSubcategories(
  records: StoredProductSubcategory[],
): ProductSubcategory[] {
  return records.map((record) => ({
    id: record.id,
    scope: record.scope,
    value: record.value,
    label: record.label,
    sortOrder: record.sort_order,
  }));
}

export function subcategoriesFor(
  subcategories: ProductSubcategory[],
  scope: SubcategoryScope,
) {
  return subcategories
    .filter((subcategory) => subcategory.scope === scope)
    .sort((first, second) => first.sortOrder - second.sortOrder || first.label.localeCompare(second.label, "zh-Hant"));
}

export function subcategoryLabel(
  subcategories: ProductSubcategory[],
  scope: SubcategoryScope,
  value: string | null | undefined,
) {
  return subcategoriesFor(subcategories, scope).find((subcategory) => subcategory.value === value)?.label;
}
