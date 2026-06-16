import { NextResponse } from "next/server";
import { KBO_TEAMS, MLB_KOREAN_PLAYERS, type TeamKey } from "@/lib/news-config";
import { sortByPublishedAtDesc, type NewsItem } from "@/lib/news-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NAVER_SPORTS_API = "https://api-gw.sports.naver.com/news/articles";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const NEWS_LOOKBACK_DAYS = 1;

type NaverSportsArticle = {
  oid: string;
  aid: string;
  title: string;
  subContent?: string;
  sourceName?: string;
  thumbnail?: string;
  image?: string;
  sportsSection: "kbaseball" | "wbaseball" | string;
  sectionName?: string;
  dateTime: string;
};

type NaverSportsResponse = {
  code: number;
  success: boolean;
  result?: {
    newsList?: NaverSportsArticle[];
  };
};

type NewsDeepLink = {
  label: string;
  url: string;
  source: string;
};

function parseKstDateTime(value: string) {
  return new Date(`${value}+09:00`).toISOString();
}

function getKstDayStart(now = new Date(), daysBack = 0) {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - daysBack) - KST_OFFSET_MS,
  );
}

const TEAM_TITLE_ALIASES: Record<TeamKey, string[]> = {
  kia: ["kia", "기아", "타이거즈", "김도영", "이범호", "네일", "이의리", "양현종", "최형우", "나성범", "박찬호"],
  lg: ["lg", "엘지", "트윈스"],
  doosan: ["두산", "베어스"],
  samsung: ["삼성", "라이온즈"],
  lotte: ["롯데", "자이언츠"],
  hanwha: ["한화", "이글스", "류현진"],
  ssg: ["ssg", "랜더스"],
  kt: ["kt", "위즈", "wiz"],
  nc: ["nc", "다이노스"],
  kiwoom: ["키움", "히어로즈"],
};

const TEAM_NAME_ALIASES: Record<TeamKey, string[]> = {
  kia: ["kia", "기아", "타이거즈"],
  lg: ["lg", "엘지", "트윈스"],
  doosan: ["두산", "베어스"],
  samsung: ["삼성", "라이온즈"],
  lotte: ["롯데", "자이언츠"],
  hanwha: ["한화", "이글스"],
  ssg: ["ssg", "랜더스"],
  kt: ["kt", "위즈", "wiz"],
  nc: ["nc", "다이노스"],
  kiwoom: ["키움", "히어로즈"],
};

function getOtherTeamTitleAliases(team: TeamKey) {
  return Object.entries(TEAM_NAME_ALIASES)
    .filter(([key]) => key !== team)
    .flatMap(([, aliases]) => aliases);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getFirstKeywordIndex(text: string, keywords: string[]) {
  const indexes = keywords
    .map((keyword) => text.indexOf(normalizeText(keyword)))
    .filter((index) => index >= 0);

  return indexes.length ? Math.min(...indexes) : -1;
}

function isTeamFeaturedNews(item: NewsItem, team: (typeof KBO_TEAMS)[number]) {
  const title = normalizeText(item.title);
  const teamNameIndex = getFirstKeywordIndex(title, TEAM_NAME_ALIASES[team.key]);
  const otherTeamIndex = getFirstKeywordIndex(title, getOtherTeamTitleAliases(team.key));

  if (teamNameIndex >= 0) {
    return !(otherTeamIndex >= 0 && otherTeamIndex < teamNameIndex);
  }

  if (otherTeamIndex >= 0) return false;

  const personAliases = TEAM_TITLE_ALIASES[team.key].filter(
    (alias) => !TEAM_NAME_ALIASES[team.key].includes(alias),
  );
  const personMatchCount = personAliases.filter((alias) => title.includes(normalizeText(alias))).length;

  return personMatchCount >= 2;
}

function getTeamRelevanceScore(item: NewsItem, team: (typeof KBO_TEAMS)[number]) {
  const title = normalizeText(item.title);
  const summary = normalizeText(item.summary);
  const haystack = `${title} ${summary}`;
  const teamNames = TEAM_NAME_ALIASES[team.key];
  const allAliases = TEAM_TITLE_ALIASES[team.key];
  const otherTeamInTitle = getFirstKeywordIndex(title, getOtherTeamTitleAliases(team.key)) >= 0;
  const teamNameInTitle = teamNames.some((alias) => title.includes(normalizeText(alias)));

  let score = 0;

  for (const alias of teamNames) {
    const normalizedAlias = normalizeText(alias);
    if (title.includes(normalizedAlias)) score += 80;
    if (summary.includes(normalizedAlias)) score += 25;
  }

  for (const alias of allAliases) {
    const normalizedAlias = normalizeText(alias);
    if (title.includes(normalizedAlias)) score += 30;
    if (summary.includes(normalizedAlias)) score += 10;
  }

  for (const token of team.query.split(/\s+/)) {
    const normalizedToken = normalizeText(token);
    if (normalizedToken && haystack.includes(normalizedToken)) score += 8;
  }

  if (isTeamFeaturedNews(item, team)) score += 50;
  if (otherTeamInTitle && !teamNameInTitle) score -= 55;

  return Math.max(score, 0);
}

function getTeamNews(items: NewsItem[], team: (typeof KBO_TEAMS)[number]) {
  return items
    .map((item) => ({ item, score: getTeamRelevanceScore(item, team) }))
    .filter(({ score }) => score >= 25)
    .sort((a, b) => b.score - a.score || sortByPublishedAtDesc(a.item, b.item))
    .map(({ item }) => item);
}

function buildDeepLinks(teamConfig: (typeof KBO_TEAMS)[number]): NewsDeepLink[] {
  const encodedQuery = encodeURIComponent(teamConfig.query);

  return [
    {
      label: "네이버 최신뉴스",
      source: "네이버",
      url: `https://search.naver.com/search.naver?where=news&sort=1&query=${encodedQuery}`,
    },
    {
      label: "다음 최신뉴스",
      source: "다음",
      url: `https://search.daum.net/search?w=news&sort=recency&q=${encodedQuery}`,
    },
    {
      label: "스포츠 검색",
      source: "네이버 스포츠",
      url: `https://m.sports.naver.com/search?query=${encodedQuery}`,
    },
    {
      label: "구단 공식",
      source: teamConfig.shortName,
      url: teamConfig.officialUrl,
    },
  ];
}

function includesAnyKeyword(item: NewsItem, keywords: string[]) {
  const haystack = `${item.title} ${item.summary} ${item.tag}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function isMlbKoreanPlayerNews(item: NewsItem) {
  const haystack = `${item.title} ${item.summary} ${item.tag}`.toLowerCase();
  const hasMlbSignal = ["mlb", "메이저리그", "샌프란시스코", "다저스", "파드리스"].some((keyword) =>
    haystack.includes(keyword.toLowerCase()),
  );

  return hasMlbSignal && includesAnyKeyword(item, MLB_KOREAN_PLAYERS);
}

function isRecentNews(item: NewsItem) {
  return new Date(item.publishedAt) >= getKstDayStart(new Date(), NEWS_LOOKBACK_DAYS);
}

function uniqueByUrl(items: NewsItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function naverArticleToNewsItem(article: NaverSportsArticle, tag: string): NewsItem {
  return {
    id: `naver-${article.oid}-${article.aid}`,
    title: article.title,
    summary: article.subContent?.trim() || "네이버 스포츠 기사에서 자세한 내용을 확인하세요.",
    url: `https://m.sports.naver.com/${article.sportsSection}/article/${article.oid}/${article.aid}`,
    source: article.sourceName?.trim() || "네이버 스포츠",
    imageUrl: article.thumbnail || article.image || null,
    publishedAt: parseKstDateTime(article.dateTime),
    tag,
  };
}

async function fetchNaverSportsNews(section: "kbaseball" | "wbaseball", tag: string) {
  const url = new URL(`${NAVER_SPORTS_API}/${section}`);
  url.searchParams.set("page", "1");
  url.searchParams.set("pageSize", "50");

  const response = await fetch(url, {
    next: { revalidate: 120 },
    headers: {
      Accept: "application/json",
      Referer: `https://m.sports.naver.com/${section}/news/index`,
      "User-Agent": "Mozilla/5.0 kia-tigers-news-pwa/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Naver Sports request failed: ${response.status}`);
  }

  const data = (await response.json()) as NaverSportsResponse;
  if (!data.success || !data.result?.newsList) {
    throw new Error("Naver Sports response did not include a news list.");
  }

  return data.result.newsList.map((article) =>
    naverArticleToNewsItem(article, article.sectionName || tag),
  );
}

function fallbackItem(title: string, summary: string, url: string, source: string, tag: string, minutesAgo: number): NewsItem {
  return {
    id: `${tag}-${title}`,
    title,
    summary,
    url,
    source,
    imageUrl: null,
    publishedAt: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
    tag,
  };
}

function buildFallbackNews(teamConfig: (typeof KBO_TEAMS)[number]) {
  const encodedTeam = encodeURIComponent(teamConfig.query);

  const featured = [
    fallbackItem(
      `${teamConfig.name} 최신 뉴스 모아보기`,
      "실시간 뉴스 연결이 불안정할 때 바로 열어볼 수 있는 네이버 스포츠 검색 링크입니다.",
      `https://search.naver.com/search.naver?where=news&sort=1&query=${encodedTeam}`,
      "네이버 검색",
      teamConfig.name,
      8,
    ),
    fallbackItem(
      `${teamConfig.name} 공식 소식 확인`,
      "구단 공지, 경기 소식, 선수단 소식은 공식 채널에서 가장 정확하게 확인할 수 있습니다.",
      teamConfig.officialUrl,
      teamConfig.shortName,
      teamConfig.name,
      18,
    ),
  ];

  const latest = [
    ...featured,
    fallbackItem(
      "네이버 스포츠 KBO 최신 뉴스",
      "오늘 올라온 KBO 리그 최신 기사를 네이버 스포츠에서 바로 확인할 수 있습니다.",
      "https://m.sports.naver.com/kbaseball/news/index",
      "네이버 스포츠",
      "KBO",
      28,
    ),
    fallbackItem(
      "KBO 공식 기록실 바로가기",
      "경기 일정, 결과, 팀 순위는 KBO 공식 기록실에서 확인할 수 있습니다.",
      "https://www.koreabaseball.com/Record/TeamRank/TeamRank.aspx",
      "KBO",
      "KBO",
      36,
    ),
  ];

  const mlb = [
    fallbackItem(
      "MLB 한국인 선수 뉴스 모아보기",
      "류현진, 김하성, 이정후 등 한국인 선수 소식을 확인하는 네이버 스포츠 링크입니다.",
      "https://m.sports.naver.com/wbaseball/news/index",
      "네이버 스포츠",
      "MLB",
      20,
    ),
  ];

  return { featured, teamNews: featured, latest, mlb, deepLinks: buildDeepLinks(teamConfig) };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const team = (searchParams.get("team") ?? "kia") as TeamKey;
  const teamConfig = KBO_TEAMS.find((item) => item.key === team) ?? KBO_TEAMS[0];

  try {
    const [kboNews, mlbNews] = await Promise.all([
      fetchNaverSportsNews("kbaseball", "KBO"),
      fetchNaverSportsNews("wbaseball", "MLB"),
    ]);

    const allKboNews = uniqueByUrl(kboNews)
      .filter((item) => !isMlbKoreanPlayerNews(item))
      .sort(sortByPublishedAtDesc);
    const allMlbNews = uniqueByUrl(mlbNews)
      .filter(isMlbKoreanPlayerNews)
      .sort(sortByPublishedAtDesc);
    const recentKboNews = allKboNews.filter(isRecentNews);
    const recentMlbNews = allMlbNews.filter(isRecentNews);
    const displayKboNews = recentKboNews.length ? recentKboNews : allKboNews;
    const displayMlbNews = recentMlbNews.length ? recentMlbNews : allMlbNews;

    const featuredTeamNews = displayKboNews.filter((item) => isTeamFeaturedNews(item, teamConfig));
    const teamNews = getTeamNews(displayKboNews, teamConfig);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      team: teamConfig,
      source: "Naver Sports public API",
      freshness: {
        since: getKstDayStart(new Date(), NEWS_LOOKBACK_DAYS).toISOString(),
        rule: recentKboNews.length ? "한국시간 어제 0시 이후 기사 표시" : "최근 1일 기사 없음, 네이버 스포츠 최신 수집분 표시",
      },
      deepLinks: buildDeepLinks(teamConfig),
      featured: featuredTeamNews.slice(0, 8),
      teamNews: teamNews.slice(0, 16),
      latest: displayKboNews.slice(0, 30),
      mlb: displayMlbNews.slice(0, 12),
    });
  } catch (error) {
    const fallback = buildFallbackNews(teamConfig);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      team: teamConfig,
      fallback: true,
      error: error instanceof Error ? error.message : "Unknown error",
      ...fallback,
    });
  }
}
