
export interface CastMember {
  id: number;
  name: string;
  character: string;
  order: number;
  profile_path: string | null;
}
export interface Movie {
  id: number;
  title: string;
  release_year: number | null;
  poster_path: string | null;
  genres: string[];
  director: string | null;
  popularity: number | null;
  cast_members: CastMember[];
  box_office: number | null;
  rating: number | null;
  vote_count?: number | null;
  min_age: number | null;
  certifications: Record<string, string>;
  cached_at: string;
}

export interface DailyMovieWithDetails {
  play_date: string;
  custom_hints: Record<string, any> | null;
  movie: Movie; // The joined movie record
}