import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { mapGameSessionToClientResponse } from '$lib/utils/gameLogic';
import { getDailyMovie, getGameSession } from '$lib/server/gameSession';

export const load: PageServerLoad = async ({ locals, params }) => {
    // default to today if no param is provided.
    const today = new Date().toISOString().split('T')[0];
    const playDate = params.date ?? today;

    // We won't support future dates.
    if (playDate > today) {
        error(404, 'Not found');
    }

    // 1. Get user session
    const { user } = await locals.safeGetSession();
    
    // If no user, they haven't guessed yet, return empty
    if (!user) {
        console.log('no user, returning []');
        return { guesses: [], gameStatus: 'in_progress', playDate };
    }

    // 2. Get today's movie
    const dailyMovie = await getDailyMovie(playDate);
    if (!dailyMovie) {
        console.log('no daily movie, returning []');
        return { guesses: [], gameStatus: 'in_progress', playDate };
    }

    // 3. Get game session
    console.log(`find session for ${user.id}, movie=${dailyMovie.id}`);
    const gameSessionData = await getGameSession(user.id, dailyMovie.id);

    if (!gameSessionData || !gameSessionData.guesses) {
        console.log('no gameSessionData, returning []');
        return { guesses: [], gameStatus: 'in_progress', playDate };
    }

    console.log(`${gameSessionData.status}`);
    return { ...mapGameSessionToClientResponse(gameSessionData, dailyMovie), playDate };
};
