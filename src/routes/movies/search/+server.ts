import { json } from '@sveltejs/kit';
import type { RequestHandler } from "./$types";
import { PUBLIC_TMDB_THUMB_URL } from '$env/static/public';
import type { SearchResult, SearchResponse } from '$lib/types/search';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export type { SearchResult, SearchResponse };

/**
 * The GET endpoint for movies/search. Returns movies with a title matching on the
 *  search term provided from our Supabase movies table. 
 * @param url The URL of the GET request.
 * @param locals 
 * @returns SearchResults if found, in JSON format. Otherwise empty array. 
 */
export const GET: RequestHandler = async ({ url }) => {
    let titleToSearchFor = url.searchParams.get('title');

    console.log(`Searching for ${titleToSearchFor}`);
    if (!titleToSearchFor) {
        return json([]);
    }

    // Search Supabase movies table directly using ilike
    const { data: movies, error: dbError } = await supabaseAdmin
        .from('movies')
        .select('id, title, release_year, poster_path')
        .ilike('title', `%${titleToSearchFor}%`)
        .limit(10);
    
    if (dbError) {
        console.error("Supabase search error:", dbError);
        return json([]);
    }

    console.log(movies);
    // return results to front-end 
    let result = {
        results: movies?.map(movie => getSearchResultFromDbMovie(movie)),
        ok: true
    };

    return json(result);
}

/**
 * Converts DB Movie to a SearchResult.
 * @param movie 
 * @returns The SearchResult.
 */
function getSearchResultFromDbMovie(movie: any) : SearchResult { 
    return {
        id: movie.id,
        title: movie.title,
        releaseDate: movie.release_year ? `${movie.release_year}-01-01` : "",
        imagePath: movie.poster_path ? `${PUBLIC_TMDB_THUMB_URL}${movie.poster_path}` : ""
    }
}