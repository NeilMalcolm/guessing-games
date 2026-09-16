import { TMDB_BASE_URL, TMDB_API_KEY, TMDB_ACCESS_TOKEN } from "$env/static/private";
import { PUBLIC_TMDB_THUMB_URL } from "$env/static/public";
import type { TmdbMovieDetailResponse, TmdbMovieSearchResponse } from "./types/tmdb";

class TmdbClient {
    private baseUrl: string;
    private apiKey: string;
    private accessToken: string;
    private thumbUrl: string;

    constructor(baseUrl: string, apiKey: string, accessToken: string, thumbUrl: string) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.accessToken = accessToken;
        this.thumbUrl = thumbUrl;
    }

    public async searchForMovie(query: string) : Promise<TmdbMovieSearchResponse> {
        let searchUrl = new URL(`${this.baseUrl}search/movie`);
        searchUrl.searchParams.append('query', query)

        let apiResponse = await fetch(searchUrl,
        {
            headers: [
                [ "Authorization", `Bearer ${this.accessToken}` ]
            ]
        });

        if (!apiResponse.ok) {
            console.log("failed request");

            return {
                error: "failed request",
                ok: false
            };
        }

        let responseJson = await apiResponse.json();
        let typedResponse : TmdbMovieSearchResponse = responseJson as TmdbMovieSearchResponse;

        return typedResponse;
    }

    public async getMovieDetails(id: number) : Promise<TmdbMovieDetailResponse> { 
        let detailUrl = new URL(`${this.baseUrl}movie/${id}?language=en-gb&append_to_response=release_dates,credits`);
        
        console.log(detailUrl);
        let apiResponse = await fetch(detailUrl,
        {
            headers: [
                [ "Authorization", `Bearer ${this.accessToken}` ]
            ]
        });

        if (!apiResponse.ok) {
            console.log(`failed request ${apiResponse.status} | ${apiResponse.body}`);
            
            return {
                error: "failed request",
                ok: false
            };
        }

        let responseJson = await apiResponse.json();
        let typedResponse : TmdbMovieDetailResponse = responseJson as TmdbMovieDetailResponse;
        typedResponse.ok = true;
        return typedResponse;
    }
}

export const tmdb = new TmdbClient(TMDB_BASE_URL, TMDB_API_KEY, TMDB_ACCESS_TOKEN, PUBLIC_TMDB_THUMB_URL);