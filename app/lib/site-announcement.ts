export const defaultSiteAnnouncement = "新品、連線與現貨資訊，請持續關注！";

export type SiteAnnouncement = {
  content: string;
};

export function announcementContent(value: string | null | undefined) {
  return value?.trim() || defaultSiteAnnouncement;
}
