import { Match, type GuessResponse } from "$lib/types/guess";
import type { Movie } from "$lib/types/supabasetables";
import { PUBLIC_TMDB_THUMB_URL } from "$env/static/public";
import type { GameSessionStatus } from "$lib/types/supabasetables";
import type { TmdbMovie } from "$lib/types/tmdb";
import { tmdb } from "$lib/tmdbClient";

export function formatCurrency(amount: number | null): string {
  if (!amount || amount === 0) return "$0";
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "")}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1).replace(/\.?0+$/, "")}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

export function getNumberMatch(guess: number, target: number, threshold: number): Match {
  if (guess === target) return Match.Exact;
  let isClose = Math.abs(guess - target) <= threshold;
  if (guess > target) {
    return isClose ? Match.LowerClose : Match.Lower;
  }
  return isClose ? Match.HigherClose : Match.Higher;
}

export function getGenreMatch(genre: string, genres: string[]): Match {
  return (genres ?? []).includes(genre) ? Match.Exact : Match.None;
}

export function getPreferredCertLabel(certs: Record<string, string> | null | undefined): string {
  if (!certs || Object.keys(certs).length === 0) return "N/A";
  return certs["GB"] ?? certs["US"] ?? certs["DE"] ?? Object.values(certs)[0] ?? "N/A";
}

export function generateGuessResponse(
  guessMovie: Movie,
  targetMovie: Movie,
  isCorrect: boolean,
  status: GameSessionStatus
): GuessResponse {
  // 1. Release Year
  const guessMovieYear = guessMovie.release_year ?? 0;
  const targetMovieYear = targetMovie.release_year ?? 0;

  // 2. Box Office
  const guessBoxOffice = guessMovie.box_office ?? 0;
  const targetBoxOffice = targetMovie.box_office ?? 0;

  // 3. Rating (0-10 scale in DB, converting to 0-100)
  const rawGuessRating = guessMovie.rating ?? 0;
  const rawTargetRating = targetMovie.rating ?? 0;
  const guessScore = rawGuessRating > 10 ? Math.round(rawGuessRating) : Math.round(rawGuessRating * 10);
  const targetScore = rawTargetRating > 10 ? Math.round(rawTargetRating) : Math.round(rawTargetRating * 10);

  // 4. Cast Members (top 6 actors)
  const targetCastNames = (targetMovie.cast_members ?? []).map(c => c.name.toLowerCase());
  const targetCastIds = new Set((targetMovie.cast_members ?? []).map(c => c.id));
  const castMembersResult = (guessMovie.cast_members ?? []).slice(0, 6).map(cast => ({
    value: cast.name,
    match: (targetCastIds.has(cast.id) || targetCastNames.includes(cast.name.toLowerCase()))
      ? Match.Exact
      : Match.None
  }));

  // 5. Age Rating
  const guessCertLabel = getPreferredCertLabel(guessMovie.certifications);
  const guessMinAge = guessMovie.min_age;
  const targetMinAge = targetMovie.min_age;
  
  let ageMatch = Match.None;
  if (guessMinAge !== null && targetMinAge !== null && targetMinAge !== undefined) {
    ageMatch = getNumberMatch(guessMinAge, targetMinAge, 2);
  } else if (guessCertLabel !== 'N/A' && targetMovie.certifications) {
    const hasExactCert = Object.values(targetMovie.certifications).includes(guessCertLabel);
    ageMatch = hasExactCert ? Match.Exact : Match.None;
  }

  return {
    title: guessMovie.title,
    image: guessMovie.poster_path ? `${PUBLIC_TMDB_THUMB_URL}${guessMovie.poster_path}` : null,
    yearResult: { 
      value: guessMovieYear > 0 ? guessMovieYear.toString() : "N/A",
      match: getNumberMatch(guessMovieYear, targetMovieYear, 5)
    },
    genresResult: (guessMovie.genres ?? []).map((genre: string) => ({ 
      value: genre,
      match: getGenreMatch(genre, targetMovie.genres ?? [])
    })),
    boxOfficeResult: {
      value: formatCurrency(guessBoxOffice),
      match: getNumberMatch(guessBoxOffice, targetBoxOffice, 100_000_000)
    },
    ratingResult: {
      value: guessScore > 0 ? `${guessScore}/100` : "N/A",
      match: getNumberMatch(guessScore, targetScore, 5)
    },
    castMembersResult,
    ageRatingResult: {
      value: guessCertLabel,
      match: ageMatch
    },
    isCorrect,
    status
  };
}