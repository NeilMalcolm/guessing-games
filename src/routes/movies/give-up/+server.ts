import type { RequestHandler } from "./$types";
import { json, error as jsonError } from "@sveltejs/kit";
import { mapGameSessionToClientResponse } from "$lib/utils/gameLogic";
import {
  parseAndValidatePlayDate,
  getRequiredDailyMovie,
  getOrCreateUser,
  getOrCreateGameSession,
  updateGameSessionStatus
} from "$lib/server/gameSession";

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json().catch(() => ({}));
  const playDate = parseAndValidatePlayDate(body.date);

  const dailyMovie = await getRequiredDailyMovie(playDate);
  const user = await getOrCreateUser(locals);
  const gameSession = await getOrCreateGameSession(user.id, dailyMovie.id);

  // Ensure game session belongs to the authenticated user
  if (gameSession.user_id !== user.id) {
    throw jsonError(403, "Forbidden: Game session does not belong to authenticated user");
  }

  // Check if session is already finished
  if (gameSession.status !== 'in_progress') {
    throw jsonError(400, `Game session is already finished with status: ${gameSession.status}`);
  }

  await updateGameSessionStatus(gameSession.id, user.id, 'gave_up');
  gameSession.status = 'gave_up';

  const clientResponse = mapGameSessionToClientResponse(gameSession, dailyMovie);
  return json(clientResponse);
};
