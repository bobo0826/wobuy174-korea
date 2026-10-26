export const defaultSiteAnnouncements = [
  "新品、連線與現貨資訊，請持續關注！",
  "歡迎加入 LINE 社群，掌握最新到貨與連線消息。",
  "現貨商品可直接私訊 LINE@ 詢問庫存與下單。",
];

export const defaultSiteAnnouncement = defaultSiteAnnouncements[0];

export type SiteAnnouncement = {
  slot: number;
  content: string;
  enabled: boolean;
};

export const defaultSiteAnnouncementItems: SiteAnnouncement[] = defaultSiteAnnouncements.map((content, index) => ({
  slot: index + 1,
  content,
  enabled: true,
}));

export function announcementContent(value: string | null | undefined) {
  return value?.trim() || defaultSiteAnnouncement;
}

export function announcementContents(values: Array<string | null | undefined> | null | undefined) {
  const contents = (values ?? []).map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return contents.length ? contents : defaultSiteAnnouncements;
}

export function toSiteAnnouncements(values: Array<Partial<SiteAnnouncement>> | null | undefined) {
  return defaultSiteAnnouncementItems.map((fallback) => {
    const value = values?.find((item) => item.slot === fallback.slot);
    return {
      slot: fallback.slot,
      content: value?.content?.trim() || fallback.content,
      enabled: value?.enabled ?? fallback.enabled,
    };
  });
}

export function visibleAnnouncementContents(items: SiteAnnouncement[]) {
  return items.filter((item) => item.enabled).map((item) => item.content.trim()).filter(Boolean);
}
