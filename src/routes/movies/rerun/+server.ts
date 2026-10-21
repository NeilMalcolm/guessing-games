import { supabaseAdmin } from "$lib/supabaseAdmin";
import { dailyMoviesTable, type DailyMovieWithDetails } from "$lib/types/supabasetables";
import type { RequestHandler } from "@sveltejs/kit";
import { json, error as jsonError } from "@sveltejs/kit";


export const GET: RequestHandler = async ({request, locals}) => {

  let { session, user } = await locals.safeGetSession();
  if (!session)
  {
    let signInResult = await locals.supabase.auth.signInAnonymously();

    session = signInResult.data.session;
    user = signInResult.data.user;
  }

  if (!user) {
    throw jsonError(401, "No user found");
  }
  
    let results = supabaseAdmin.from(dailyMoviesTable)
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
        director_profile_path,
        popularity,
        cast_members,
        box_office,
        rating,
        min_age,
        certifications,
        video
        `)
}