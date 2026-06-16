import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KBO_BASE_URL = "https://www.koreabaseball.com";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KIA_TEAM_ID = "HT";

const KBO_URLS = {
  schedule: `${KBO_BASE_URL}/Schedule/Schedule.aspx`,
  scheduleApi: `${KBO_BASE_URL}/ws/Schedule.asmx/GetScheduleList`,
  teamRank: `${KBO_BASE_URL}/Record/TeamRank/TeamRank.aspx`,
  hitter: `${KBO_BASE_URL}/Record/Player/HitterBasic/Basic1.aspx`,
  pitcher: `${KBO_BASE_URL}/Record/Player/PitcherBasic/Basic1.aspx`,
};

const NAVER_SCHEDULE_API = "https://api-gw.sports.naver.com/schedule/games";
const NAVER_MOBILE_URLS = {
  schedule: "https://m.sports.naver.com/kbaseball/index",
  teamRank: "https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2026&tab=teamRank",
  hitter: "https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2026&tab=hitter&teamCode=HT",
  pitcher: "https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2026&tab=pitcher&teamCode=HT",
};

const KBO_TEAM_NAMES = ["KIA", "LG", "두산", "삼성", "롯데", "한화", "SSG", "KT", "NC", "키움"];
const KBO_TEAM_IDS = ["HT", "LG", "OB", "SS", "LT", "HH", "SK", "KT", "NC", "WO"];

type Standing = {
  rank: string;
  team: string;
  games: string;
  wins: string;
  losses: string;
  draws: string;
  winRate: string;
  gamesBehind: string;
  streak: string;
};

type ScheduleGame = {
  id: string;
  dateLabel: string;
  time: string;
  awayTeam: string;
  homeTeam: string;
  awayScore: string | null;
  homeScore: string | null;
  scoreLabel: string;
  hasScore: boolean;
  stadium: string;
  status: string;
  gameCenterUrl: string;
  starterNote: string;
  scoreSource: string;
};

type KiaPlayer = {
  id: string;
  name: string;
  type: "hitter" | "pitcher";
  team: string;
  primary: string;
  secondary: string;
  tertiary: string;
  kboUrl: string;
  namuUrl: string;
  newsUrl: string;
};

type ScheduleCell = string | { Text?: string };

type ScheduleResponse = {
  rows?: Array<{ row?: ScheduleCell[] }>;
};

type NaverScheduleGame = {
  gameId: string;
  gameDateTime: string;
  stadium?: string;
  statusCode?: string;
  statusInfo?: string;
  homeTeamName: string;
  homeTeamScore: number;
  awayTeamName: string;
  awayTeamScore: number;
  cancel?: boolean;
};

function stripHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteKboUrl(value = "") {
  if (!value) return KBO_URLS.schedule;
  if (value.startsWith("http")) return value;
  return `${KBO_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

function getKstParts(now = new Date()) {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const year = String(kstNow.getUTCFullYear());
  const month = String(kstNow.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kstNow.getUTCDate()).padStart(2, "0");

  return {
    year,
    month,
    day,
    dateLabel: `${month}.${day}`,
    isoDate: `${year}-${month}-${day}`,
  };
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 kia-tigers-news-pwa/0.1",
    },
  });

  if (!response.ok) throw new Error(`KBO request failed: ${response.status}`);
  return response.text();
}

function getTableRows(html: string) {
  const tbody = html.match(/<tbody[\s\S]*?>([\s\S]*?)<\/tbody>/i)?.[1] ?? html;
  return Array.from(tbody.matchAll(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi)).map((match) => match[1]);
}

function getCells(rowHtml: string) {
  return Array.from(rowHtml.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)).map((match) => stripHtml(match[1]));
}

async function fetchStandings() {
  const html = await fetchText(KBO_URLS.teamRank);
  const standings = getTableRows(html)
    .map(getCells)
    .filter((cells) => cells.length >= 8)
    .map<Standing>((cells) => ({
      rank: cells[0],
      team: cells[1],
      games: cells[2],
      wins: cells[3],
      losses: cells[4],
      draws: cells[5],
      winRate: cells[6],
      gamesBehind: cells[7],
      streak: cells[9] ?? "",
    }))
    .filter((item) => KBO_TEAM_NAMES.includes(item.team));

  return {
    standings,
    kia: standings.find((item) => item.team === "KIA") ?? null,
  };
}

async function postSchedule(teamId = "") {
  const { year, month } = getKstParts();
  const body = new URLSearchParams({
    leId: "1",
    srIdList: "0,9,6",
    seasonId: year,
    gameMonth: month,
    teamId,
  });

  const response = await fetch(KBO_URLS.scheduleApi, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: KBO_URLS.schedule,
      "User-Agent": "Mozilla/5.0 kia-tigers-news-pwa/0.1",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
  });

  if (!response.ok) throw new Error(`KBO schedule request failed: ${response.status}`);
  return (await response.json()) as ScheduleResponse;
}

async function fetchNaverTodayGames() {
  const { isoDate, dateLabel } = getKstParts();
  const params = new URLSearchParams({
    fields:
      "basic,superCategoryId,categoryName,gameId,gameDateTime,stadium,statusCode,statusInfo,homeTeamName,homeTeamScore,awayTeamName,awayTeamScore",
    upperCategoryId: "kbaseball",
    categoryId: "kbo",
    fromDate: isoDate,
    toDate: isoDate,
    size: "100",
  });

  const response = await fetch(`${NAVER_SCHEDULE_API}?${params.toString()}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Referer: "https://sports.news.naver.com/kbaseball/schedule/index",
      "User-Agent": "Mozilla/5.0 kia-tigers-news-pwa/0.1",
    },
  });

  if (!response.ok) throw new Error(`Naver score request failed: ${response.status}`);

  const data = (await response.json()) as { result?: { games?: NaverScheduleGame[] } };

  return (data.result?.games ?? [])
    .filter((game) => game.awayTeamName && game.homeTeamName)
    .map<ScheduleGame>((game, index) => {
      const hasScore = game.statusCode === "STARTED" || game.statusCode === "RESULT";
      const time = game.gameDateTime.slice(11, 16);
      const status = game.cancel ? "취소" : game.statusInfo || (hasScore ? "진행중" : "예정");

      return {
        id: game.gameId || `${dateLabel}-${time}-${game.awayTeamName}-${game.homeTeamName}-${index}`,
        dateLabel,
        time,
        awayTeam: game.awayTeamName,
        homeTeam: game.homeTeamName,
        awayScore: hasScore ? String(game.awayTeamScore) : null,
        homeScore: hasScore ? String(game.homeTeamScore) : null,
        scoreLabel: hasScore ? `${game.awayTeamScore} : ${game.homeTeamScore}` : "경기 전",
        hasScore,
        stadium: game.stadium ?? "",
        status,
        gameCenterUrl: KBO_URLS.schedule,
        starterNote: "선발투수는 KBO 경기센터에서 경기별로 확인",
        scoreSource: "Naver Sports live score",
      };
    });
}

function parseGameMatchup(matchupHtml = "") {
  const html = String(matchupHtml);
  const spans = Array.from(html.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)).map((match) =>
    stripHtml(match[1]),
  );
  const tokens = spans.filter(Boolean);
  const teams = tokens.filter((token) => KBO_TEAM_NAMES.includes(token));
  const scores = tokens.filter((token) => /^\d+$/.test(token));
  const awayScore = scores[0] ?? null;
  const homeScore = scores[1] ?? null;

  return {
    awayTeam: teams[0] ?? "",
    homeTeam: teams[teams.length - 1] ?? "",
    awayScore,
    homeScore,
  };
}

function getScheduleCellText(cell: ScheduleCell | undefined) {
  if (!cell) return "";
  if (typeof cell === "string") return cell;
  return cell.Text ?? "";
}

function parseScheduleGame(cells: ScheduleCell[], index: number): ScheduleGame | null {
  if (cells.length < 8) return null;

  const dateLabel = stripHtml(getScheduleCellText(cells[0])).slice(0, 5);
  const time = stripHtml(getScheduleCellText(cells[1]));
  const matchup = parseGameMatchup(getScheduleCellText(cells[2]));
  const { awayTeam, homeTeam, awayScore, homeScore } = matchup;
  const actionText = stripHtml(getScheduleCellText(cells[3]));
  const href = getScheduleCellText(cells[3]).match(/href=['"]([^'"]+)['"]/i)?.[1] ?? "";
  const stadium = stripHtml(getScheduleCellText(cells[7]));
  const memo = stripHtml(getScheduleCellText(cells[8]));
  const hasScore = awayScore !== null && homeScore !== null;
  const status = hasScore ? (actionText.includes("리뷰") ? "종료" : "진행중") : memo || "예정";

  if (!dateLabel || !awayTeam || !homeTeam) return null;

  return {
    id: `${dateLabel}-${time}-${awayTeam}-${homeTeam}-${index}`,
    dateLabel,
    time,
    awayTeam,
    homeTeam,
    awayScore,
    homeScore,
    scoreLabel: hasScore ? `${awayScore} : ${homeScore}` : "경기 전",
    hasScore,
    stadium,
    status,
    gameCenterUrl: absoluteKboUrl(href),
    starterNote: "선발투수는 KBO 경기센터에서 경기별로 확인",
    scoreSource: "KBO official schedule",
  };
}

async function fetchSchedule() {
  const { dateLabel } = getKstParts();
  const [teamSchedules, kiaSchedule, naverTodayGames] = await Promise.all([
    Promise.all(KBO_TEAM_IDS.map((teamId) => postSchedule(teamId))),
    postSchedule(KIA_TEAM_ID),
    fetchNaverTodayGames().catch(() => [] as ScheduleGame[]),
  ]);

  const seenGames = new Set<string>();
  const todayGames = teamSchedules
    .flatMap((schedule) => schedule.rows ?? [])
    .map((item, index) => parseScheduleGame(item.row ?? [], index))
    .filter((item): item is ScheduleGame => Boolean(item))
    .filter((game) => game.dateLabel === dateLabel)
    .filter((game) => {
      const key = `${game.dateLabel}-${game.time}-${game.awayTeam}-${game.homeTeam}-${game.stadium}`;
      if (seenGames.has(key)) return false;
      seenGames.add(key);
      return true;
    });

  const kiaGames = (kiaSchedule.rows ?? [])
    .map((item, index) => parseScheduleGame(item.row ?? [], index))
    .filter((item): item is ScheduleGame => Boolean(item));

  const liveTodayGames = naverTodayGames.length ? naverTodayGames : todayGames;

  return {
    todayGames: liveTodayGames,
    kiaGame:
      liveTodayGames.find((game) => game.awayTeam === "KIA" || game.homeTeam === "KIA") ??
      kiaGames.find((game) => game.dateLabel === dateLabel) ??
      kiaGames.find((game) => game.dateLabel >= dateLabel) ??
      null,
  };
}

function getFirstPlayerId(rowHtml: string) {
  return rowHtml.match(/playerId=(\d+)/i)?.[1] ?? "";
}

function buildPlayerLinks(name: string, id: string, type: "hitter" | "pitcher") {
  const query = encodeURIComponent(`KIA 타이거즈 ${name}`);
  const detailPath = id
    ? `/Record/Player/${type === "hitter" ? "HitterDetail/Basic" : "PitcherDetail/Basic"}.aspx?playerId=${id}`
    : "";

  return {
    kboUrl: detailPath ? absoluteKboUrl(detailPath) : type === "hitter" ? KBO_URLS.hitter : KBO_URLS.pitcher,
    namuUrl: `https://namu.wiki/w/${encodeURIComponent(name)}`,
    newsUrl: `https://search.naver.com/search.naver?where=news&sort=1&query=${query}`,
  };
}

async function fetchHitterPlayers() {
  const html = await fetchText(KBO_URLS.hitter);
  return getTableRows(html)
    .map((rowHtml) => ({ rowHtml, cells: getCells(rowHtml), id: getFirstPlayerId(rowHtml) }))
    .filter(({ cells }) => cells[2] === "KIA")
    .slice(0, 12)
    .map<KiaPlayer>(({ cells, id }) => {
      const links = buildPlayerLinks(cells[1], id, "hitter");
      return {
        id: id || `hitter-${cells[1]}`,
        name: cells[1],
        type: "hitter",
        team: cells[2],
        primary: `타율 ${cells[3]}`,
        secondary: `${cells[4]}경기 ${cells[8]}안타`,
        tertiary: `${cells[11]}홈런 ${cells[13]}타점`,
        ...links,
      };
    });
}

async function fetchPitcherPlayers() {
  const html = await fetchText(KBO_URLS.pitcher);
  return getTableRows(html)
    .map((rowHtml) => ({ rowHtml, cells: getCells(rowHtml), id: getFirstPlayerId(rowHtml) }))
    .filter(({ cells }) => cells[2] === "KIA")
    .slice(0, 12)
    .map<KiaPlayer>(({ cells, id }) => {
      const links = buildPlayerLinks(cells[1], id, "pitcher");
      return {
        id: id || `pitcher-${cells[1]}`,
        name: cells[1],
        type: "pitcher",
        team: cells[2],
        primary: `ERA ${cells[3]}`,
        secondary: `${cells[4]}경기 ${cells[5]}승 ${cells[6]}패`,
        tertiary: `${cells[10]}이닝 ${cells[15]}탈삼진`,
        ...links,
      };
    });
}

async function fetchPlayers() {
  const [hitters, pitchers] = await Promise.all([fetchHitterPlayers(), fetchPitcherPlayers()]);
  return { hitters, pitchers };
}

export async function GET() {
  const [standingsResult, scheduleResult, playersResult] = await Promise.allSettled([
    fetchStandings(),
    fetchSchedule(),
    fetchPlayers(),
  ]);

  const standings = standingsResult.status === "fulfilled" ? standingsResult.value : { standings: [], kia: null };
  const schedule = scheduleResult.status === "fulfilled" ? scheduleResult.value : { todayGames: [], kiaGame: null };
  const players = playersResult.status === "fulfilled" ? playersResult.value : { hitters: [], pitchers: [] };

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    source: "KBO official records + Naver Sports live scoreboard",
    links: {
      schedule: NAVER_MOBILE_URLS.schedule,
      teamRank: NAVER_MOBILE_URLS.teamRank,
      hitter: NAVER_MOBILE_URLS.hitter,
      pitcher: NAVER_MOBILE_URLS.pitcher,
    },
    standings,
    schedule,
    players,
    errors: {
      standings: standingsResult.status === "rejected" ? standingsResult.reason?.message : null,
      schedule: scheduleResult.status === "rejected" ? scheduleResult.reason?.message : null,
      players: playersResult.status === "rejected" ? playersResult.reason?.message : null,
    },
  });
}
