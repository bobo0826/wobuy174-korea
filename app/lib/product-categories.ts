export const productCategoryOptions = [
  { id: "popular", label: "熱門商品" },
  { id: "bedding", label: "韓國棉被" },
  { id: "korea", label: "韓國選品" },
  { id: "japan", label: "日本選品" },
  { id: "other", label: "其他選品" },
] as const;

export type ProductCategory = (typeof productCategoryOptions)[number]["id"];

export const beddingTypeOptions = [
  { id: "cool", label: "涼感被" },
  { id: "allSeason", label: "四季被" },
  { id: "pillow", label: "秒睡枕" },
] as const;

export type BeddingType = (typeof beddingTypeOptions)[number]["id"];

export const koreaTypeOptions = [
  { id: "plush", label: "正版玩偶" },
  { id: "pajamas", label: "正韓睡衣" },
  { id: "fashion", label: "時尚潮牌" },
  { id: "snacks", label: "零食糖果" },
  { id: "beauty", label: "藥局美妝" },
  { id: "dutyFree", label: "免稅精選" },
  { id: "socks", label: "純棉襪子" },
] as const;

export type KoreaType = (typeof koreaTypeOptions)[number]["id"];

export const plushTypeOptions = [
  { id: "sanrio", label: "三麗鷗" },
  { id: "chiikawa", label: "吉伊卡哇" },
  { id: "pokemon", label: "寶可夢" },
  { id: "miffy", label: "米飛兔" },
  { id: "pingu", label: "PINGU" },
  { id: "regional", label: "地區限定" },
  { id: "other", label: "其他" },
] as const;

export type PlushType = (typeof plushTypeOptions)[number]["id"];

function aliasesFor<T extends readonly { id: string; label: string }[]>(options: T) {
  return Object.fromEntries(
    options.flatMap((option) => [
      [option.label, option.id],
      [option.id, option.id],
      [option.id.toLowerCase(), option.id],
    ]),
  ) as Record<string, string>;
}

export const productCategoryAliases = aliasesFor(productCategoryOptions);

export const beddingTypeAliases: Record<string, string> = {
  ...aliasesFor(beddingTypeOptions),
  "-18°C 涼被": "cool",
  "涼被": "cool",
  "抗蟎秒睡枕": "pillow",
  "秒睡枕": "pillow",
};

export const koreaTypeAliases: Record<string, string> = aliasesFor(koreaTypeOptions);

export const plushTypeAliases: Record<string, string> = aliasesFor(plushTypeOptions);

export function categoryLabel<T extends readonly { id: string; label: string }[]>(
  options: T,
  id: string | null | undefined,
) {
  return options.find((option) => option.id === id)?.label;
}
