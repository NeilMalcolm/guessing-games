import type { Database, Tables } from './database.types';

type TableName = keyof Database['public']['Tables'];

export const dailyMoviesTable = 'daily_movies' satisfies TableName;

/**
 * Represents a cast member stored within a movie's cast_members payload.
 */
export interface CastMember {
  id: number;
  name: string;
  character: string;
  order: number;
  profile_path: string | null;
}

export const moviesTable = 'movies' satisfies TableName;
/**
 * Represents a row in the `public.movies` table.
 * Stores cached movie details, ratings, cast, and comparison metrics from TMDB.
 */
export type Movie = Omit<Tables<'movies'>, 'cast_members' | 'certifications' | 'vote_count' | 'video'> & {
  vote_count?: number | null;
  video?: string | null;
  cast_members: CastMember[];
  certifications: Record<string, string>;
};

export const movieHintsTable = 'movie_hints' satisfies TableName;
/**
 * Represents a row in the `public.movie_hints` table.
 * Server-only hint data (tagline, top keywords and the R2 key of the pixellated poster) for a movie.
 */
export type MovieHints = Tables<'movie_hints'>;

/**
 * Represents a daily movie challenge joined with its full movie record.
 * Used to fetch the target movie and any custom unlockable hints for a given play date.
 */
export type DailyMovieWithDetails = Pick<Tables<'daily_movies'>, 'play_date' | 'custom_hints'> & {
  movie: Movie; // The joined movie record
};

/**
 * Allowed status states for a game session ('in_progress', 'won', 'lost', or 'gave_up').
 */
export type GameSessionStatus = 'in_progress' | 'won' | 'lost' | 'gave_up';

export const gamesSessionTable = 'game_sessions' satisfies TableName;
/**
 * Represents a row in the `public.game_sessions` table.
 * Tracks a player's daily game session for a specific target movie, attempt limit, and outcome status.
 */
export type GameSession = Omit<Tables<'game_sessions'>, 'status'> & {
  status: GameSessionStatus;
};

export const guessTable = 'guesses' satisfies TableName;
/**
 * Represents a row in the `public.guesses` table.
 * Records each individual movie guess turn made during a game session and whether it was correct.
 */
export type Guess = Tables<'guesses'>;

/**
 * Represents an individual guess record with its joined movie details, as returned in a game session query.
 */
export interface GameSessionGuess {
  id: string;
  guess_number: number;
  movie_id?: number;
  is_correct: boolean;
  created_at: string;
  movie: Movie;
}

/**
 * Allowed hint categories for a game session.
 */
export const HINT_TYPES = ['tagline', 'keywords', 'poster'] as const;
export type HintType = (typeof HINT_TYPES)[number];;

export const gameSessionHintsTable = 'game_session_hints' satisfies TableName;
/**
 * Represents a row in the `public.game_session_hints` table.
 * Tracks which hints have been unlocked and used in a game session.
 */
export type GameSessionHint = Omit<Tables<'game_session_hints'>, 'hint_type'> & {
  hint_type: HintType;
};

/**
 * Represents the full game session response including its history of guesses and joined movie data.
 */
export interface GameSessionResponse extends GameSession {
  guesses: GameSessionGuess[];
  hints?: GameSessionHint[];
}

