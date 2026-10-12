import { Match, type GuessResponse, type PropertyResult } from '$lib/types/guess';

export const SQUARE_MATCH = '🟩';
export const SQUARE_CLOSE = '🟨';
export const SQUARE_NONE = '⬛';

function squareForMatch(match: Match): string {
	if (match === Match.Exact) return SQUARE_MATCH;
	if (match === Match.LowerClose || match === Match.HigherClose) return SQUARE_CLOSE;
	return SQUARE_NONE;
}

/** Every item matched -> match, some matched -> close, none (or empty) -> none. */
function squareForCollection(results: PropertyResult[] | undefined): string {
	const items = results ?? [];
	const matched = items.filter((r) => r.match === Match.Exact).length;
	if (items.length > 0 && matched === items.length) return SQUARE_MATCH;
	if (matched > 0) return SQUARE_CLOSE;
	return SQUARE_NONE;
}

/**
 * Converts a guess into one square per category, in the order:
 * Genres, Year, Box office, Rating, Certification, Director, Cast.
 */
export function getGuessSquares(guess: GuessResponse): string[] {
	// The winning guess is, by definition, a match on everything.
	if (guess.isCorrect) return Array(7).fill(SQUARE_MATCH);

	return [
		squareForCollection(guess.genresResult),
		squareForMatch(guess.yearResult?.match ?? Match.None),
		squareForMatch(guess.boxOfficeResult?.match ?? Match.None),
		squareForMatch(guess.ratingResult?.match ?? Match.None),
		squareForMatch(guess.ageRatingResult?.match ?? Match.None),
		squareForMatch(guess.directorResult?.match ?? Match.None),
		squareForCollection(guess.castMembersResult)
	];
}

/**
 * One row of squares per guess, oldest guess first.
 * `guesses` is expected newest-first, as returned by the server.
 */
export function getResultRows(guesses: GuessResponse[]): string[] {
	return [...guesses].reverse().map((guess) => getGuessSquares(guess).join(''));
}

/** Plain text suitable for sharing, e.g. "Guessing Games 2026-10-12 - 2 guesses\n1. 🟩🟨..." */
export function formatShareText(guesses: GuessResponse[], playDate: string): string {
	const rows = getResultRows(guesses).map((row, i) => `${i + 1}. ${row}`);
	const count = guesses.length;
	return [`Guessing Games ${playDate} - ${count} ${count === 1 ? 'guess' : 'guesses'}`, ...rows].join(
		'\n'
	);
}

