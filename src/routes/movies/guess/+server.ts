import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/supabaseAdmin";
import { tmdb } from "$lib/tmdbClient";
import { json, error as jsonError } from "@sveltejs/kit";
import type { DailyMovieWithDetails } from "$lib/types/supabasetables";
import { PUBLIC_TMDB_THUMB_URL } from "$env/static/public";
import type { TmdbGenre } from "$lib/types/tmdb";
import { Match, type GuessResponse } from "$lib/types/guess";

const AGE_MAPPING: Record<string, Record<string, number>> = {
  GB: { 'U': 0, 'PG': 8, '12': 12, '12A': 12, '15': 15, '18': 18, 'R18': 18 },
  US: { 'G': 0, 'PG': 8, 'PG-13': 13, 'R': 17, 'NC-17': 18, 'NR': 0 },
  DE: { '0': 0, '6': 6, '12': 12, '16': 16, '18': 18 }
};

export const POST: RequestHandler = async ({ url, request }) => {
    const today = new Date().toISOString().split('T')[0]; 
    const { guessedMovieId } = await request.json();

    // get today's movie
    console.log(`guessed movie ${guessedMovieId}`);
    const { data, error } = await supabaseAdmin
        .from('daily_movies')
        .select(`
            play_date,
            custom_hints,
            movie:movies (
              id,
              title,
              release_year,
              poster_path,
              genres,
              director,
              popularity,
              cast_members,
              box_office,
              rating,
              min_age,
              certifications
            )
        `)
        .eq('play_date', today)
        .single<DailyMovieWithDetails>();
        
      console.log(data);

    if (!data?.movie?.id) {
      console.log("return empty");
      return json([]);
    }

    let guessMovieDetails = await tmdb.getMovieDetails(guessedMovieId);

    console.log(`${guessMovieDetails.ok}`);
    if (!guessMovieDetails.ok) {
      console.log("return 500");
      return jsonError(500, "No value back for id");
    }

    // 1. Release Year
    const guessMovieYear = guessMovieDetails.release_date 
      ? new Date(guessMovieDetails.release_date).getFullYear() 
      : 0;

    // 2. Box Office
    const targetBoxOffice = data.movie.box_office ?? 0;
    const guessBoxOffice = guessMovieDetails.revenue ?? 0;

    // 3. Rating (converted to 0-100 scale, e.g. 7.1 -> 71/100)
    const rawTargetRating = data.movie.rating ?? 0;
    const targetScore = rawTargetRating > 10 ? Math.round(rawTargetRating) : Math.round(rawTargetRating * 10);
    const guessScore = guessMovieDetails.vote_average ? Math.round(guessMovieDetails.vote_average * 10) : 0;

    // 4. Cast Members (top 6 actors)
    const targetCastNames = (data.movie.cast_members ?? []).map(c => c.name.toLowerCase());
    const targetCastIds = new Set((data.movie.cast_members ?? []).map(c => c.id));
    const castMembersResult = (guessMovieDetails.credits?.cast ?? []).slice(0, 6).map(cast => ({
      value: cast.name,
      match: (targetCastIds.has(cast.id) || targetCastNames.includes(cast.name.toLowerCase()))
        ? Match.Exact
        : Match.None
    }));

    // 5. Age Rating
    const guessAge = extractAgeRating(guessMovieDetails.release_dates?.results);
    const targetMinAge = data.movie.min_age;
    let ageMatch = Match.None;
    if (guessAge.minAge !== null && targetMinAge !== null && targetMinAge !== undefined) {
      ageMatch = getNumberMatch(guessAge.minAge, targetMinAge, 2);
    } else if (guessAge.certLabel !== 'N/A' && data.movie.certifications) {
      const hasExactCert = Object.values(data.movie.certifications).includes(guessAge.certLabel);
      ageMatch = hasExactCert ? Match.Exact : Match.None;
    }

    let response: GuessResponse = {
      title: guessMovieDetails.title,
      image: `${PUBLIC_TMDB_THUMB_URL}${guessMovieDetails.poster_path}`,
      yearResult: { 
        value: guessMovieYear.toString(),
        match: getNumberMatch(guessMovieYear, data.movie.release_year as number, 5)
      },
      genresResult: guessMovieDetails.genres.map((genre: TmdbGenre) => ({ 
        value: genre.name,
        match: getGenreMatch(genre.name, data.movie.genres)
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
        value: guessAge.certLabel,
        match: ageMatch
      }
    };

    return json(response);
};

function formatCurrency(amount: number): string {
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

function extractAgeRating(releaseDatesResults?: { iso_3166_1: string; release_dates: { certification: string }[] }[]): { certLabel: string; minAge: number | null } {
  if (!releaseDatesResults || releaseDatesResults.length === 0) {
    return { certLabel: "N/A", minAge: null };
  }

  const certs: Record<string, string> = {};
  for (const r of releaseDatesResults) {
    const cert = r.release_dates.find(d => d.certification?.trim())?.certification;
    if (cert) certs[r.iso_3166_1] = cert;
  }

  // Preference: GB, then US, then DE, or first available
  const certLabel = certs["GB"] ?? certs["US"] ?? certs["DE"] ?? Object.values(certs)[0] ?? "N/A";
  let minAge: number | null = null;

  if (certs["GB"] && AGE_MAPPING.GB[certs["GB"]] !== undefined) {
    minAge = AGE_MAPPING.GB[certs["GB"]];
  } else if (certs["US"] && AGE_MAPPING.US[certs["US"]] !== undefined) {
    minAge = AGE_MAPPING.US[certs["US"]];
  } else if (certs["DE"] && AGE_MAPPING.DE[certs["DE"]] !== undefined) {
    minAge = AGE_MAPPING.DE[certs["DE"]];
  }

  return { certLabel, minAge };
}

function getGenreMatch(genre: string, genres: string[]): Match {
  return (genres ?? []).includes(genre) ? Match.Exact : Match.None;
}

function getNumberMatch(guess: number, target: number, threshold: number): Match {
  if (guess == target) return Match.Exact;

  let isClose = Math.abs(guess - target) <= threshold;

  if (guess > target) {
    return isClose ? Match.LowerClose : Match.Lower;
  }

  return isClose ? Match.HigherClose : Match.Higher;
}