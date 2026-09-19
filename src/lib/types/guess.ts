import type { GameSessionStatus } from "./supabasetables";

export interface GuessResponse {
  title: string;
  image: string | null;
  yearResult: PropertyResult;
  genresResult: PropertyResult[];
  boxOfficeResult: PropertyResult;
  ratingResult: PropertyResult;
  castMembersResult: PropertyResult[];
  ageRatingResult: PropertyResult;
  isCorrect: boolean;
  status: GameSessionStatus;
}

export interface PropertyResult {
  value: string,
  match: Match,
}

export enum Match {
  None,
  Lower,
  LowerClose,
  Exact,
  HigherClose,
  Higher
}
