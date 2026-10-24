import type { GameSessionStatus } from "./supabasetables";

export interface GuessResponse {
  movieId: number;
  title: string;
  image: string | null;
  yearResult: PropertyResult;
  genresResult: PropertyResult[];
  boxOfficeResult: PropertyResult;
  ratingResult: PropertyResult;
  directorResult: CastPropertyResult;
  castMembersResult: CastPropertyResult[];
  ageRatingResult: PropertyResult;
  isCorrect: boolean;
  status: GameSessionStatus;
}

export interface GameSessionClientResponse {
  guesses: GuessResponse[];
  gameStatus: GameSessionStatus;
  targetMovie?: TargetMovie | null
}

export interface TargetMovie { 
  title: string,
  videoUrl: string | null;
}

export interface PropertyResult {
  value: string,
  match: Match,
}

export interface CastPropertyResult extends PropertyResult { 
  image: string | null
}

export enum Match {
  None,
  Lower,
  LowerClose,
  Exact,
  HigherClose,
  Higher
}


export function getBadgeClassForMatch(match: Match, success?: boolean) : string {
    if (match === Match.Exact) return success ? "badge bg-neutral/15 border-transparent text-neutral/80" : "badge badge-success";
    if (match === Match.HigherClose || match === Match.LowerClose) return "badge badge-warning";

    return "badge bg-base-300";
}

export function getArrowForMatch(match: Match) : string {
    if (match === Match.Exact) return "";
    if (match === Match.HigherClose || match === Match.Higher) return "↑";
    if (match === Match.LowerClose || match === Match.Lower) return "↓";

    return "";
}

export function getTextColorForMatch(match: Match) : string {
    if (match === Match.Exact) return "text-neutral/80";
    if (match === Match.HigherClose || match === Match.LowerClose) return "text-orange-800";

    return "base-content";
}

export function getBgForMatch(match: Match, success?: boolean) : string {
    if (match === Match.Exact) return success ? "bg-neutral/15" : "bg-success";
    if (match === Match.HigherClose || match === Match.LowerClose) return "bg-warning";

    return "bg-base-300";
}
