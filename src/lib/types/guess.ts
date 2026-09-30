import type { GameSessionStatus } from "./supabasetables";

export interface GuessResponse {
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
}

export interface PropertyResult {
  value: string,
  match: Match,
}

export interface CastPropertyResult extends PropertyResult { 
  image: string
}

export enum Match {
  None,
  Lower,
  LowerClose,
  Exact,
  HigherClose,
  Higher
}


export function getBadgeClassForMatch(match: Match) : string {
    if (match === Match.Exact) return "badge badge-success";
    if (match === Match.HigherClose || match === Match.LowerClose) return "badge badge-warning";

    return "badge badge-neutral";
}

export function getArrowForMatch(match: Match) : string {
    if (match === Match.Exact) return "";
    if (match === Match.HigherClose || match === Match.Higher) return "↑";
    if (match === Match.LowerClose || match === Match.Lower) return "↓";

    return "";
}

export function getTextColorForMatch(match: Match) : string {
    if (match === Match.Exact) return "text-emerald-400";
    if (match === Match.HigherClose || match === Match.LowerClose) return "text-orange-800";

    return "text-white";
}

export function getBgForMatch(match: Match) : string {
    if (match === Match.Exact) return "bg-success";
    if (match === Match.HigherClose || match === Match.LowerClose) return "bg-warning";

    return "bg-neutral";
}
