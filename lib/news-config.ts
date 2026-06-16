export type TeamKey =
  | "kia"
  | "lg"
  | "doosan"
  | "samsung"
  | "lotte"
  | "hanwha"
  | "ssg"
  | "kt"
  | "nc"
  | "kiwoom";

export type TeamConfig = {
  key: TeamKey;
  name: string;
  shortName: string;
  query: string;
  officialUrl: string;
};

export const KBO_TEAMS: TeamConfig[] = [
  { key: "kia", name: "기아 타이거즈", shortName: "KIA", query: "기아 타이거즈 KIA 타이거즈", officialUrl: "https://tigers.co.kr/" },
  { key: "lg", name: "LG 트윈스", shortName: "LG", query: "LG 트윈스", officialUrl: "https://www.lgtwins.com/" },
  { key: "doosan", name: "두산 베어스", shortName: "두산", query: "두산 베어스", officialUrl: "https://www.doosanbears.com/" },
  { key: "samsung", name: "삼성 라이온즈", shortName: "삼성", query: "삼성 라이온즈", officialUrl: "https://www.samsunglions.com/" },
  { key: "lotte", name: "롯데 자이언츠", shortName: "롯데", query: "롯데 자이언츠", officialUrl: "https://www.giantsclub.com/" },
  { key: "hanwha", name: "한화 이글스", shortName: "한화", query: "한화 이글스", officialUrl: "https://www.hanwhaeagles.co.kr/" },
  { key: "ssg", name: "SSG 랜더스", shortName: "SSG", query: "SSG 랜더스", officialUrl: "https://www.ssglanders.com/" },
  { key: "kt", name: "KT 위즈", shortName: "KT", query: "KT 위즈", officialUrl: "https://www.ktwiz.co.kr/" },
  { key: "nc", name: "NC 다이노스", shortName: "NC", query: "NC 다이노스", officialUrl: "https://www.ncdinos.com/" },
  { key: "kiwoom", name: "키움 히어로즈", shortName: "키움", query: "키움 히어로즈", officialUrl: "https://heroesbaseball.co.kr/" },
];

export const MLB_KOREAN_PLAYERS = ["류현진", "김하성", "이정후", "고우석", "배지환"];
