export const dailyMoviesTable: string = 'daily_movies';

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

export const moviesTable: string = 'movies';
/**
 * Represents a row in the `public.movies` table.
 * Stores cached movie details, ratings, cast, and comparison metrics from TMDB.
 */
export interface Movie {
  id: number;
  title: string;
  release_year: number | null;
  poster_path: string | null;
  genres: string[];
  director: string | null;
  director_profile_path: string | null;
  popularity: number | null;
  cast_members: CastMember[];
  box_office: number | null;
  rating: number | null;
  vote_count?: number | null;
  min_age: number | null;
  certifications: Record<string, string>;
  cached_at: string;
}

/**
 * Represents a daily movie challenge joined with its full movie record.
 * Used to fetch the target movie and any custom unlockable hints for a given play date.
 */
export interface DailyMovieWithDetails {
  play_date: string;
  custom_hints: Record<string, any> | null;
  movie: Movie; // The joined movie record
}

/**
 * Allowed status states for a game session ('in_progress', 'won', or 'lost').
 */
export type GameSessionStatus = 'in_progress' | 'won' | 'lost';

export const gamesSessionTable: string = 'game_sessions';  
/**
 * Represents a row in the `public.game_sessions` table.
 * Tracks a player's daily game session for a specific target movie, attempt limit, and outcome status.
 */
export interface GameSession {
  id: string;
  user_id: string;
  target_movie_id: number;
  status: GameSessionStatus;
  max_attempts: number;
  created_at: string;
  updated_at: string;
}

export const guessTable: string = 'guesses';  
/**
 * Represents a row in the `public.guesses` table.
 * Records each individual movie guess turn made during a game session and whether it was correct.
 */
export interface Guess {
  id: string;
  game_id: string;
  user_id: string;
  guess_number: number;
  movie_id: number;
  is_correct: boolean;
  created_at: string;
}

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
 * Represents the full game session response including its history of guesses and joined movie data.
 */
export interface GameSessionResponse extends GameSession {
  guesses: GameSessionGuess[];
}

