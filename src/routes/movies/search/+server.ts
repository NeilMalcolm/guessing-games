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

    // Group and check for duplicate titles
    const formattedResults = formatTitlesWithYearForDuplicates(movies || []);

    // return results to front-end 
    let result = {
        results: formattedResults,
        ok: true
    };

    return json(result);
}

/**
 * Checks for duplicate titles and appends the release year to them.
 * Converts DB Movie to a SearchResult.
 * @param movies array of DB movies
 * @returns Array of SearchResult
 */
function formatTitlesWithYearForDuplicates(movies: any[]): SearchResult[] {
    const titleCounts = new Map<string, number>();
    for (const movie of movies) {
        const titleLower = movie.title.toLowerCase();
        titleCounts.set(titleLower, (titleCounts.get(titleLower) || 0) + 1);
    }

    return movies.map(movie => {
        const titleLower = movie.title.toLowerCase();
        const hasDuplicate = (titleCounts.get(titleLower) || 0) > 1;
        
        let finalTitle = movie.title;
        if (hasDuplicate && movie.release_year) {
            finalTitle = `${movie.title} (${movie.release_year})`;
        }

        return {
            id: movie.id,
            title: finalTitle,
            imagePath: movie.poster_path ? `${PUBLIC_TMDB_THUMB_URL}${movie.poster_path}` : ""
        };
    });
}