import { Match, type GuessResponse, type GameSessionClientResponse } from "$lib/types/guess";
import type { Movie, GameSessionResponse, GameSessionStatus } from "$lib/types/supabasetables";
import { PUBLIC_TMDB_THUMB_URL } from "$env/static/public";

const CAST_MEMBER_DISPLAY_COUNT: number = 5;

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

  // 4. director matches
  const directorResult: any = {
    value: formatName(guessMovie.director),
    image: guessMovie.director_profile_path ? `${PUBLIC_TMDB_THUMB_URL}${guessMovie.director_profile_path}` : null,
    match: targetMovie.director === guessMovie.director ? Match.Exact : Match.None
  };

  // 5. Cast Members (top X actors)
  const targetCastNames = (targetMovie.cast_members ?? []).map(c => c.name.toLowerCase());
  const targetCastIds = new Set((targetMovie.cast_members ?? []).map(c => c.id));
  const castMembersResult = (guessMovie.cast_members ?? []).slice(0, CAST_MEMBER_DISPLAY_COUNT).map(cast => ({
    value: formatName(cast.name),
    image: cast.profile_path ? `${PUBLIC_TMDB_THUMB_URL}${cast.profile_path}` : null,
    match: (targetCastIds.has(cast.id) || targetCastNames.includes(cast.name.toLowerCase()))
      ? Match.Exact
      : Match.None
  }));

  // 6. Age Rating
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
    movieId: guessMovie.id,
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
    directorResult: directorResult,
    castMembersResult,
    ageRatingResult: {
      value: guessCertLabel,
      match: ageMatch
    },
    isCorrect,
    status
  };
}

const formatName = (fullName: string | null): string => {
  // Split on one or more spaces to handle accidental double spaces

  if (!fullName) 
  {
    return "";
  }

  const [first, ...rest] = fullName.trim().split(/\s+/);
  
  // Return early if there's no last name
  if (rest.length === 0) return first;

  // Combine the first initial with the remaining parts
  return `${first[0].toUpperCase()}. ${rest.join(' ')}`;
};

export function mapGameSessionToClientResponse(
  gameSession: GameSessionResponse,
  dailyMovie: Movie
): GameSessionClientResponse {
  const sortedGuesses = [...(gameSession.guesses ?? [])].sort(
    (a, z) => z.guess_number - a.guess_number
  );

  const mappedGuesses = sortedGuesses
    .map((guessRecord) => {
      return guessRecord.movie 
        ? generateGuessResponse(
          guessRecord.movie,
          dailyMovie,
          guessRecord.is_correct,
          gameSession.status
        ) 
        : null;
    })
    .filter(Boolean) as GuessResponse[];

  let targetMovie = gameSession.status === 'in_progress'
    ? null
    : {
      title: dailyMovie.title,
      videoUrl: dailyMovie.video ? `https://www.youtube.com/embed/${dailyMovie.video}` : null
    }; 


  return {
    guesses: mappedGuesses,
    gameStatus: gameSession.status,
    targetMovie: targetMovie
  };
}
