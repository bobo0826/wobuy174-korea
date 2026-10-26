export const defaultSiteAnnouncements = [
  "新品、連線與現貨資訊，請持續關注！",
  "歡迎加入 LINE 社群，掌握最新到貨與連線消息。",
  "現貨商品可直接私訊 LINE@ 詢問庫存與下單。",
];

export const defaultSiteAnnouncement = defaultSiteAnnouncements[0];

export type SiteAnnouncement = {
  slot: number;
  content: string;
};

export function announcementContent(value: string | null | undefined) {
  return value?.trim() || defaultSiteAnnouncement;
}

export function announcementContents(values: Array<string | null | undefined> | null | undefined) {
  const contents = (values ?? []).map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return contents.length ? contents : defaultSiteAnnouncements;
}
