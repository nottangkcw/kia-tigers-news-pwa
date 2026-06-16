export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  imageUrl: string | null;
  publishedAt: string;
  tag: string;
};

type RawRssItem = {
  title?: string;
  link?: string;
  guid?: string | { "#text"?: string };
  pubDate?: string;
  description?: string;
  source?: string | { "#text"?: string; url?: string };
  "media:content"?: { url?: string };
  "media:thumbnail"?: { url?: string };
};

const FALLBACK_IMAGE = null;

export function stripHtml(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function getSource(source: RawRssItem["source"]) {
  if (!source) return "뉴스";
  if (typeof source === "string") return source;
  return source["#text"] ?? "뉴스";
}

function getGuid(item: RawRssItem) {
  if (typeof item.guid === "string") return item.guid;
  return item.guid?.["#text"] ?? item.link ?? item.title ?? crypto.randomUUID();
}

export function normalizeNewsItem(item: RawRssItem, tag: string): NewsItem | null {
  const title = stripHtml(item.title);
  const url = item.link ?? "";

  if (!title || !url) return null;

  const summary = stripHtml(item.description).replace(title, "").trim();
  const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

  return {
    id: getGuid(item),
    title,
    summary: summary || "기사 링크에서 자세한 내용을 확인하세요.",
    url,
    source: getSource(item.source),
    imageUrl: item["media:content"]?.url ?? item["media:thumbnail"]?.url ?? FALLBACK_IMAGE,
    publishedAt,
    tag,
  };
}

export function sortByPublishedAtDesc(a: NewsItem, b: NewsItem) {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

export function formatKoreanDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
