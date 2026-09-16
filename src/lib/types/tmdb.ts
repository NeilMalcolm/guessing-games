/*
    Movie Search interfaces/Types
*/

export interface TmdbPaginatedResponse<T> {
    page?: number;
    results?: T[];
    total_pages?: number;
    total_results?: number;
    ok: boolean;
    error?: string;
}

export interface TmdbMovie {
    id: number;
    title: string;
    original_title: string;
    overview: string;
    release_date: string; // "YYYY-MM-DD" or "" if unreleased
    poster_path: string | null;
    backdrop_path: string | null;
    genre_ids: number[];
    original_language: string;
    popularity: number;
    vote_average: number;
    vote_count: number;
    video: boolean;
    adult: boolean;
    softcore?: boolean;
}

export type TmdbMovieSearchResponse = TmdbPaginatedResponse<TmdbMovie>;


/*
    Movie Details interfaces/Types
*/

export interface TmdbGenre {
    id: number;
    name: string;
}
export interface TmdbCollection {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
}
export interface TmdbProductionCompany {
    id: number;
    logo_path: string | null;
    name: string;
    origin_country: string;
}
export interface TmdbProductionCountry {
    iso_3166_1: string;
    name: string;
}
export interface TmdbSpokenLanguage {
    english_name: string;
    iso_639_1: string;
    name: string;
}
export interface TmdbCastMember {
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string | null;
    cast_id: number;
    character: string;
    credit_id: string;
    order: number;
}
export interface TmdbCrewMember {
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string | null;
    credit_id: string;
    department: string;
    job: string;
}
export interface TmdbCredits {
    cast: TmdbCastMember[];
    crew: TmdbCrewMember[];
}
export interface TmdbReleaseDateItem {
    certification: string;
    descriptors: string[];
    iso_639_1: string;
    note: string;
    release_date: string;
    type: number;
}
export interface TmdbCountryReleaseDates {
    iso_3166_1: string;
    release_dates: TmdbReleaseDateItem[];
}
export interface TmdbReleaseDates {
    results: TmdbCountryReleaseDates[];
}
export interface TmdbMovieDetail {
    adult: boolean;
    backdrop_path: string | null;
    belongs_to_collection: TmdbCollection | null;
    budget: number;
    genres: TmdbGenre[];
    homepage: string;
    id: number;
    imdb_id: string | null;
    origin_country: string[];
    original_language: string;
    original_title: string;
    overview: string;
    popularity: number;
    poster_path: string | null;
    production_companies: TmdbProductionCompany[];
    production_countries: TmdbProductionCountry[];
    release_date: string;
    revenue: number;
    runtime: number | null;
    softcore?: boolean;
    spoken_languages: TmdbSpokenLanguage[];
    status: string;
    tagline: string | null;
    title: string;
    video: boolean;
    vote_average: number;
    vote_count: number;
    credits: TmdbCredits;
    release_dates: TmdbReleaseDates;
}
/**
 * Type representing either the resolved movie details (with optional status fields)
 * or a client failure response.
 */
export type TmdbMovieDetailResponse = 
    | (TmdbMovieDetail & { ok?: boolean; error?: string })
    | { ok: false; error: string };