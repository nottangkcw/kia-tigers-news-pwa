"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Clock,
  CircleDot,
  ExternalLink,
  Newspaper,
  RefreshCw,
  Search,
  Star,
  Trophy,
  UserRound,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KBO_TEAMS, type TeamConfig, type TeamKey } from "@/lib/news-config";
import { formatKoreanDateTime, type NewsItem } from "@/lib/news-utils";
import { cn } from "@/lib/utils";

type NewsResponse = {
  updatedAt: string;
  team: TeamConfig;
  deepLinks?: NewsDeepLink[];
  featured: NewsItem[];
  teamNews?: NewsItem[];
  latest: NewsItem[];
  mlb: NewsItem[];
  source?: string;
  freshness?: {
    since: string;
    rule: string;
  };
  fallback?: boolean;
};

type NewsDeepLink = {
  label: string;
  url: string;
  source: string;
};

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
  stadium: string;
  status: string;
  gameCenterUrl: string;
  starterNote: string;
};

type KiaPlayer = {
  id: string;
  name: string;
  type: "hitter" | "pitcher";
  primary: string;
  secondary: string;
  tertiary: string;
  kboUrl: string;
  namuUrl: string;
  newsUrl: string;
};

type KboDashboardResponse = {
  updatedAt: string;
  links: {
    schedule: string;
    teamRank: string;
    hitter: string;
    pitcher: string;
  };
  standings: {
    standings: Standing[];
    kia: Standing | null;
  };
  schedule: {
    todayGames: ScheduleGame[];
    kiaGame: ScheduleGame | null;
  };
  players: {
    hitters: KiaPlayer[];
    pitchers: KiaPlayer[];
  };
  errors?: Record<string, string | null>;
};

const CACHE_KEY = "kia-tigers-news-cache-v4";
const DASHBOARD_CACHE_KEY = "kia-tigers-dashboard-cache-v1";
const INITIAL_UPDATED_AT = "1970-01-01T00:00:00.000Z";

const fallbackNews: NewsResponse = {
  updatedAt: INITIAL_UPDATED_AT,
  team: KBO_TEAMS[0],
  deepLinks: [],
  featured: [],
  teamNews: [],
  latest: [],
  mlb: [],
};

async function clearDevelopmentPwaCache() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }
}

export function NewsApp() {
  const [selectedTeam, setSelectedTeam] = useState<TeamKey>("kia");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<NewsResponse>(fallbackNews);
  const [dashboard, setDashboard] = useState<KboDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const cachedNews = window.localStorage.getItem(CACHE_KEY);
    const cachedDashboard = window.localStorage.getItem(DASHBOARD_CACHE_KEY);

    if (cachedNews) {
      try {
        setData(JSON.parse(cachedNews) as NewsResponse);
      } catch {
        window.localStorage.removeItem(CACHE_KEY);
      }
      setLoading(false);
    }

    if (cachedDashboard) {
      try {
        setDashboard(JSON.parse(cachedDashboard) as KboDashboardResponse);
      } catch {
        window.localStorage.removeItem(DASHBOARD_CACHE_KEY);
      }
      setDashboardLoading(false);
    }

    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    } else {
      clearDevelopmentPwaCache().catch(() => undefined);
    }

    void loadDashboard();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    void loadNews(selectedTeam);
  }, [selectedTeam]);

  async function loadNews(team: TeamKey) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/news?team=${team}`, { cache: "no-store" });
      if (!response.ok) throw new Error("뉴스 응답이 올바르지 않습니다.");

      const nextData = (await response.json()) as NewsResponse;
      setData(nextData);
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(nextData));
    } catch {
      setError("새 뉴스를 불러오지 못했습니다. 저장된 뉴스가 있으면 그대로 보여드립니다.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard() {
    setDashboardLoading(true);
    setDashboardError("");

    try {
      const response = await fetch("/api/kbo", { cache: "no-store" });
      if (!response.ok) throw new Error("KBO 기록 응답이 올바르지 않습니다.");

      const nextDashboard = (await response.json()) as KboDashboardResponse;
      setDashboard(nextDashboard);
      window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(nextDashboard));
    } catch {
      setDashboardError("KBO 공식 기록을 불러오지 못했습니다. 저장된 기록이 있으면 그대로 보여드립니다.");
    } finally {
      setDashboardLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadNews(selectedTeam), loadDashboard()]);
  }

  const filteredLatest = useMemo(() => filterNews(data.latest, query), [data.latest, query]);
  const filteredFeatured = useMemo(() => filterNews(data.featured, query), [data.featured, query]);
  const filteredTeamNews = useMemo(() => filterNews(data.teamNews ?? [], query), [data.teamNews, query]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#FFF8E6_0%,#FFFFFF_46%,#FFF5D1_100%)]">
      <section className="border-b border-tiger-red/15 bg-tiger-ink text-white">
        <div className="container max-w-5xl px-4 pb-5 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-13 shrink-0 items-center justify-center rounded-lg bg-tiger-gold text-tiger-ink shadow-sm">
                <CircleDot className="size-8" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-tiger-gold">KBO 뉴스 PWA</p>
                <h1 className="truncate text-2xl font-black tracking-normal">타이거즈 뉴스</h1>
              </div>
            </div>
            <div
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold",
                isOnline ? "bg-white/12 text-tiger-gold" : "bg-tiger-red text-white",
              )}
            >
              {isOnline ? <Wifi className="size-4" aria-hidden /> : <WifiOff className="size-4" aria-hidden />}
              {isOnline ? "온라인" : "오프라인"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="relative block">
              <span className="sr-only">뉴스 검색</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="선수, 감독, 상대팀 검색"
                className="h-13 border-white/20 bg-white pl-12 text-tiger-ink"
              />
            </label>
            <Button
              size="lg"
              variant="secondary"
              onClick={refreshAll}
              disabled={loading || dashboardLoading}
              className="h-13 text-base"
            >
              <RefreshCw className={cn("size-5", (loading || dashboardLoading) && "animate-spin")} aria-hidden />
              새로고침
            </Button>
          </div>
        </div>
      </section>

      <div className="container max-w-5xl px-4 py-5">
        {dashboardError ? <Notice tone="warn" message={dashboardError} /> : null}
        <KiaDashboard dashboard={dashboard} loading={dashboardLoading} />

        <TeamNewsSelector selectedTeam={selectedTeam} onSelect={setSelectedTeam} />
        <DeepLinkStrip team={data.team} links={data.deepLinks ?? []} />

        <section className="mt-5 rounded-lg border border-tiger-red/20 bg-white p-4 shadow-soft">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Star className="size-5 fill-tiger-gold text-tiger-red" aria-hidden />
                <p className="text-sm font-bold text-tiger-red">{data.team.name} 우선 보기</p>
              </div>
              <h2 className="mt-1 text-2xl font-black break-keep">오늘의 주요 기사</h2>
            </div>
            <Badge variant="secondary" className="shrink-0 text-sm">
              {formatKoreanDateTime(data.updatedAt)}
            </Badge>
          </div>
          {error ? <Notice tone="warn" message={error} /> : null}
          {data.freshness ? <Notice message={`${data.source ?? "뉴스 API"} 기준, ${data.freshness.rule}`} /> : null}
          {data.fallback ? <Notice message="실시간 뉴스 연결이 불안정해 바로 열 수 있는 공식/검색 링크를 보여드립니다." /> : null}
          {loading && !data.latest.length ? <SkeletonList /> : <NewsGrid items={filteredFeatured.slice(0, 4)} featured />}
        </section>

        <section className="mt-6">
          <SectionHeader title={`${data.team.shortName} 구단 맞춤 기사`} count={filteredTeamNews.length} />
          {loading && data.latest.length > 0 ? <Notice message="새 뉴스를 확인하는 중입니다." /> : null}
          {!loading && !filteredTeamNews.length ? <Notice message="오늘/어제 수집 기사 안에서 구단명이 뚜렷한 기사가 적어, 위 심층 링크로 최신 검색을 바로 열 수 있습니다." /> : null}
          <NewsGrid items={filteredTeamNews} />
        </section>

        <section className="mt-6">
          <SectionHeader title="전체 KBO 최신 뉴스" count={filteredLatest.length} />
          <NewsGrid items={filteredLatest} />
        </section>

        <section className="mt-7 pb-8">
          <SectionHeader title="MLB 한국인 선수 소식" count={data.mlb.length} />
          <NewsGrid items={data.mlb} compact />
        </section>
      </div>
    </main>
  );
}

function TeamNewsSelector({
  selectedTeam,
  onSelect,
}: {
  selectedTeam: TeamKey;
  onSelect: (team: TeamKey) => void;
}) {
  return (
    <section className="mt-5 rounded-lg border border-tiger-red/20 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-tiger-red">뉴스 팀 선택</p>
          <h2 className="text-xl font-black break-keep">구단별 기사 보기</h2>
        </div>
        <Newspaper className="size-6 text-tiger-red" aria-hidden />
      </div>
      <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1">
        <div className="flex min-w-max gap-2">
          {KBO_TEAMS.map((team) => (
            <Button
              key={team.key}
              variant={selectedTeam === team.key ? "default" : "outline"}
              size="lg"
              onClick={() => onSelect(team.key)}
              className={cn(
                "h-12 rounded-md px-4 text-base",
                selectedTeam === team.key && "bg-tiger-red text-white hover:bg-tiger-red/90",
              )}
            >
              {team.shortName}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}

function DeepLinkStrip({ team, links }: { team: TeamConfig; links: NewsDeepLink[] }) {
  if (!links.length) return null;

  return (
    <section className="mt-4 rounded-lg border border-tiger-red/20 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-tiger-red">{team.name}</p>
          <h2 className="text-xl font-black break-keep">심층 뉴스 바로가기</h2>
        </div>
        <Newspaper className="size-6 text-tiger-red" aria-hidden />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {links.map((link) => (
          <Button key={`${link.source}-${link.label}`} asChild variant="outline" className="h-12 justify-between px-3">
            <a href={link.url} target="_blank" rel="noreferrer">
              <span className="min-w-0 truncate">{link.label}</span>
              <ExternalLink className="size-4 shrink-0" aria-hidden />
            </a>
          </Button>
        ))}
      </div>
    </section>
  );
}

function filterNews(items: NewsItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  return items.filter((item) =>
    [item.title, item.summary, item.source, item.tag].join(" ").toLowerCase().includes(normalizedQuery),
  );
}

function KiaDashboard({ dashboard, loading }: { dashboard: KboDashboardResponse | null; loading: boolean }) {
  if (loading && !dashboard) return <DashboardSkeleton />;
  if (!dashboard) return null;

  return (
    <section className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
      <GamePanel dashboard={dashboard} />
      <RankPanel dashboard={dashboard} />
      <PlayersPanel title="KIA 타자 기록" icon={<UsersRound className="size-5" aria-hidden />} players={dashboard.players.hitters} sourceUrl={dashboard.links.hitter} />
      <PlayersPanel title="KIA 투수 기록" icon={<UserRound className="size-5" aria-hidden />} players={dashboard.players.pitchers} sourceUrl={dashboard.links.pitcher} />
    </section>
  );
}

function GamePanel({ dashboard }: { dashboard: KboDashboardResponse }) {
  const kiaGame = dashboard.schedule.kiaGame;

  return (
    <Card className="border-tiger-red/20 bg-white shadow-soft lg:col-span-1">
      <CardContent>
        <PanelTitle icon={<CalendarDays className="size-5" aria-hidden />} title="KIA 오늘/다음 경기" actionUrl={dashboard.links.schedule} />
        {kiaGame ? (
          <div className="mt-3 rounded-md bg-tiger-ink p-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <Badge className="bg-tiger-gold text-tiger-ink hover:bg-tiger-gold">{kiaGame.dateLabel} {kiaGame.time}</Badge>
              <span className="text-sm font-semibold text-white/75">{kiaGame.stadium}</span>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3 text-center text-2xl font-black">
              <span>{kiaGame.awayTeam}</span>
              <span className="text-tiger-gold">vs</span>
              <span>{kiaGame.homeTeam}</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button asChild variant="secondary" className="h-11">
                <a href={kiaGame.gameCenterUrl} target="_blank" rel="noreferrer">
                  경기센터 <ExternalLink className="size-4" aria-hidden />
                </a>
              </Button>
              <div className="flex min-h-11 items-center justify-center rounded-md border border-white/15 px-3 text-center text-sm font-semibold text-white/80">
                {kiaGame.starterNote}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState message="KIA 경기 일정이 없습니다." />
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-black">오늘 KBO 경기</h3>
            <Badge variant="outline">{dashboard.schedule.todayGames.length}경기</Badge>
          </div>
          <div className="grid gap-2">
            {dashboard.schedule.todayGames.length ? (
              dashboard.schedule.todayGames.map((game) => <GameRow key={game.id} game={game} />)
            ) : (
              <EmptyState message="오늘 등록된 KBO 경기가 없습니다." />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GameRow({ game }: { game: ScheduleGame }) {
  return (
    <a href={game.gameCenterUrl} target="_blank" rel="noreferrer" className="grid grid-cols-[58px_1fr_auto] items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-semibold hover:border-tiger-red/35">
      <span className="text-muted-foreground">{game.time}</span>
      <span className="break-keep">{game.awayTeam} vs {game.homeTeam}</span>
      <span className="text-muted-foreground">{game.stadium}</span>
    </a>
  );
}

function RankPanel({ dashboard }: { dashboard: KboDashboardResponse }) {
  const kia = dashboard.standings.kia;

  return (
    <Card className="border-tiger-red/20 bg-white shadow-soft">
      <CardContent>
        <PanelTitle icon={<Trophy className="size-5" aria-hidden />} title="KIA 순위표" actionUrl={dashboard.links.teamRank} />
        {kia ? (
          <div className="mt-3 rounded-md border border-tiger-red/20 bg-[#fffdf7] p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-tiger-red">현재 순위</p>
                <p className="text-5xl font-black text-tiger-ink">{kia.rank}위</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-muted-foreground">승률</p>
                <p className="text-2xl font-black">{kia.winRate}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniStat label="승" value={kia.wins} />
              <MiniStat label="패" value={kia.losses} />
              <MiniStat label="무" value={kia.draws} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <MiniStat label="경기차" value={kia.gamesBehind} />
              <MiniStat label="연속" value={kia.streak || "-"} />
            </div>
          </div>
        ) : (
          <EmptyState message="순위 정보를 불러오지 못했습니다." />
        )}

        <div className="mt-4 grid gap-2">
          {dashboard.standings.standings.slice(0, 5).map((row) => (
            <div key={row.team} className={cn("grid grid-cols-[36px_1fr_auto] rounded-md px-3 py-2 text-sm font-bold", row.team === "KIA" ? "bg-tiger-red text-white" : "bg-muted")}>
              <span>{row.rank}</span>
              <span>{row.team}</span>
              <span>{row.wins}승 {row.losses}패</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PlayersPanel({ title, icon, players, sourceUrl }: { title: string; icon: ReactNode; players: KiaPlayer[]; sourceUrl: string }) {
  return (
    <Card className="border-tiger-red/20 bg-white shadow-soft lg:col-span-1">
      <CardContent>
        <PanelTitle icon={icon} title={title} actionUrl={sourceUrl} />
        <div className="mt-3 grid gap-2">
          {players.length ? players.map((player) => <PlayerRow key={`${player.type}-${player.id}`} player={player} />) : <EmptyState message="선수 기록을 불러오지 못했습니다." />}
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerRow({ player }: { player: KiaPlayer }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a href={player.namuUrl} target="_blank" rel="noreferrer" className="text-lg font-black text-tiger-ink hover:text-tiger-red">
            {player.name}
          </a>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">{player.primary} · {player.secondary}</p>
          <p className="text-sm font-semibold text-muted-foreground">{player.tertiary}</p>
        </div>
        <Badge variant="outline" className="shrink-0">{player.type === "hitter" ? "타자" : "투수"}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <SmallLink href={player.kboUrl} label="기록" icon={<BarChart3 className="size-4" aria-hidden />} />
        <SmallLink href={player.newsUrl} label="기사" icon={<Newspaper className="size-4" aria-hidden />} />
        <SmallLink href={player.namuUrl} label="위키" icon={<ExternalLink className="size-4" aria-hidden />} />
      </div>
    </div>
  );
}

function SmallLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Button asChild variant="outline" size="sm" className="h-9 px-2">
      <a href={href} target="_blank" rel="noreferrer">
        {icon}
        {label}
      </a>
    </Button>
  );
}

function PanelTitle({ icon, title, actionUrl }: { icon: ReactNode; title: string; actionUrl: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-tiger-red">
        {icon}
        <h2 className="text-xl font-black text-tiger-ink break-keep">{title}</h2>
      </div>
      <Button asChild variant="ghost" size="icon" className="shrink-0" title="공식 기록 열기">
        <a href={actionUrl} target="_blank" rel="noreferrer">
          <ExternalLink className="size-5" aria-hidden />
        </a>
      </Button>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-2 py-3">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xl font-black break-keep">{title}</h2>
      <Badge variant="outline" className="text-sm">
        {count}건
      </Badge>
    </div>
  );
}

function Notice({ message, tone = "info" }: { message: string; tone?: "info" | "warn" }) {
  return (
    <div
      className={cn(
        "mt-4 rounded-md border px-4 py-3 text-sm font-semibold",
        tone === "warn" ? "border-tiger-red/25 bg-tiger-red/10 text-tiger-red" : "border-border bg-muted",
      )}
    >
      {message}
    </div>
  );
}

function NewsGrid({
  items,
  featured = false,
  compact = false,
}: {
  items: NewsItem[];
  featured?: boolean;
  compact?: boolean;
}) {
  if (!items.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-base font-semibold text-muted-foreground">
          표시할 기사가 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("grid gap-3", featured ? "mt-4 sm:grid-cols-2" : "sm:grid-cols-2")}>
      {items.map((item) => (
        <NewsCard key={item.id} item={item} compact={compact} featured={featured} />
      ))}
    </div>
  );
}

function NewsCard({ item, featured, compact }: { item: NewsItem; featured?: boolean; compact?: boolean }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card
        className={cn(
          "h-full overflow-hidden transition-transform group-hover:-translate-y-0.5 group-hover:shadow-soft",
          featured && "border-tiger-red/35 bg-[#fffdf7]",
        )}
      >
        <CardContent className={cn("grid h-full grid-cols-[88px_1fr] gap-3 p-3", compact && "grid-cols-[72px_1fr]")}>
          <div className="relative h-full min-h-24 overflow-hidden rounded-md bg-tiger-ink">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
            ) : (
              <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_35%_35%,#FFD23F,#C41230_58%,#191919)] text-white">
                <CircleDot className="size-9" aria-hidden />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={featured ? "default" : "outline"}>{item.tag}</Badge>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Clock className="size-3.5" aria-hidden />
                {formatKoreanDateTime(item.publishedAt)}
              </span>
            </div>
            <h3 className="line-clamp-2 break-keep text-base font-black leading-6 group-hover:text-tiger-red">{item.title}</h3>
            {!compact ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.summary}</p> : null}
            <div className="mt-3 flex items-center justify-between gap-2 text-sm font-bold text-tiger-red">
              <span className="truncate">{item.source}</span>
              <ExternalLink className="size-4 shrink-0" aria-hidden />
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-md border border-dashed px-4 py-5 text-center text-sm font-semibold text-muted-foreground">{message}</div>;
}

function SkeletonList() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {[0, 1, 2, 3].map((item) => (
        <Card key={item}>
          <CardContent className="grid grid-cols-[88px_1fr] gap-3 p-3">
            <div className="h-24 animate-pulse rounded-md bg-muted" />
            <div className="space-y-3">
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-5 w-full animate-pulse rounded bg-muted" />
              <div className="h-5 w-4/5 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <section className="mt-4 grid gap-3 lg:grid-cols-2">
      {[0, 1, 2, 3].map((item) => (
        <Card key={item}>
          <CardContent className="space-y-3">
            <div className="h-6 w-36 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded bg-muted" />
            <div className="h-12 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
