import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from "./$types";
import { tmdb } from '$lib/tmdbClient';
import type { TmdbMovie } from '$lib/types/tmdb';
import { PUBLIC_TMDB_THUMB_URL } from '$env/static/public';
import type { SearchResult, SearchResponse } from '$lib/types/search';

export type { SearchResult, SearchResponse };

/**
 * The GET endpoint for movies/search. Returns movies with a title matching on the
 *  search term provided. 
 * @param url The URL of the GET request.
 * @param locals 
 * @returns SearchResults if found, in JSON format. Otherwise empty array. 
 */
export const GET: RequestHandler = async ({ url, locals }) => {
    let titleToSearchFor = url.searchParams.get('title');

    if (!titleToSearchFor) {
        return json([]);
    }

    // Search TMDB for the title
    let response = await tmdb.searchForMovie(titleToSearchFor);
    
    if (!response)
    {
        console.log("response not OK");
        return json([]);
    }

    // Store in supabase

    // return results to front-end 
    let result = {
        results: response.results?.map(movie => getSearchResultFromTmdbMovie(movie)),
        ok: true
    };

    return json(result);
}

/**
 * Converts TmdbMovie to a SearchResult.
 * @param movie 
 * @returns The SearchResult.
 */
function getSearchResultFromTmdbMovie(movie: TmdbMovie) : SearchResult { 
    return {
        id: movie.id,
        title: movie.title,
        releaseDate: movie.release_date,
        imagePath: `${PUBLIC_TMDB_THUMB_URL}${movie.poster_path}`
    }
}