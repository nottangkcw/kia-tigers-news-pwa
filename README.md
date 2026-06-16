# 타이거즈 뉴스 PWA

기아 타이거즈 팬을 위한 모바일-first KBO 뉴스 PWA입니다. Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui 스타일 컴포넌트로 구성했습니다.

## 주요 기능

- 기아 타이거즈 기본 선택 팀 필터
- KBO 팀별 뉴스 검색 RSS 수집
- 기아 관련 주요 기사 상단 강조
- MLB 한국인 선수 뉴스 섹션
- 최신순 카드 UI, 검색, 새로고침
- 홈 화면 추가용 PWA manifest와 service worker
- 마지막 뉴스 localStorage 캐시와 오프라인 안내

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## 검증

```bash
npm run typecheck
npm run lint
npm run build
```

## 배포 메모

Vercel에 연결하면 HTTPS가 자동 적용되어 모바일 Chrome에서 홈 화면 추가 조건을 맞추기 쉽습니다. 실제 배포 전에는 `npm run build`를 통과한 뒤 Vercel 프로젝트로 import하면 됩니다.

## 뉴스 출처

앱 서버 라우트 `app/api/news/route.ts`에서 Google News RSS 검색을 사용합니다. 네이버/다음 스포츠 원문은 앱에서 복제하지 않고 외부 기사 링크로 연결합니다.
