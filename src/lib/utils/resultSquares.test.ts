import { describe, it, expect } from 'vitest';
import { Match, type GuessResponse, type PropertyResult } from '$lib/types/guess';
import {
	getGuessSquares,
	getResultRows,
	formatShareText,
	SQUARE_MATCH as G,
	SQUARE_CLOSE as Y,
	SQUARE_NONE as B
} from './resultSquares';

const prop = (match: Match): PropertyResult => ({ value: 'x', match });

function makeGuess(overrides: Partial<GuessResponse> = {}): GuessResponse {
	return {
		title: 't',
		image: null,
		yearResult: prop(Match.Higher),
		genresResult: [prop(Match.None)],
		boxOfficeResult: prop(Match.Higher),
		ratingResult: prop(Match.Higher),
		directorResult: { ...prop(Match.None), image: '' },
		castMembersResult: [{ ...prop(Match.None), image: '' }],
		ageRatingResult: prop(Match.None),
		isCorrect: false,
		status: 'in_progress',
		...overrides
	};
}

describe('getGuessSquares', () => {
	it('is all black when nothing matches', () => {
		expect(getGuessSquares(makeGuess()).join('')).toBe(B.repeat(7));
	});

	it('matches the first example: genres exact, year + box office close', () => {
		const guess = makeGuess({
			genresResult: [prop(Match.Exact), prop(Match.Exact)],
			yearResult: prop(Match.LowerClose),
			boxOfficeResult: prop(Match.HigherClose)
		});
		expect(getGuessSquares(guess).join('')).toBe(`${G}${Y}${Y}${B}${B}${B}${B}`);
	});

	it('matches the second example: genres + year exact, cast partial', () => {
		const guess = makeGuess({
			genresResult: [prop(Match.Exact)],
			yearResult: prop(Match.Exact),
			castMembersResult: [
				{ ...prop(Match.Exact), image: '' },
				{ ...prop(Match.None), image: '' }
			]
		});
		expect(getGuessSquares(guess).join('')).toBe(`${G}${G}${B}${B}${B}${B}${Y}`);
	});

	it('treats some-but-not-all genres as close', () => {
		const guess = makeGuess({ genresResult: [prop(Match.Exact), prop(Match.None)] });
		expect(getGuessSquares(guess)[0]).toBe(Y);
	});

	it('treats all cast matching as a match', () => {
		const guess = makeGuess({
			castMembersResult: [
				{ ...prop(Match.Exact), image: '' },
				{ ...prop(Match.Exact), image: '' }
			]
		});
		expect(getGuessSquares(guess)[6]).toBe(G);
	});

	it('only counts exact director as a match', () => {
		expect(
			getGuessSquares(makeGuess({ directorResult: { ...prop(Match.Exact), image: '' } }))[5]
		).toBe(G);
	});

	it('handles empty genres and cast', () => {
		const squares = getGuessSquares(makeGuess({ genresResult: [], castMembersResult: [] }));
		expect(squares[0]).toBe(B);
		expect(squares[6]).toBe(B);
	});

	it('is all green for the correct guess', () => {
		expect(getGuessSquares(makeGuess({ isCorrect: true })).join('')).toBe(G.repeat(7));
	});
});

describe('getResultRows / formatShareText', () => {
	// server returns newest first
	const newest = makeGuess({ isCorrect: true });
	const oldest = makeGuess();

	it('orders rows oldest first', () => {
		expect(getResultRows([newest, oldest])).toEqual([B.repeat(7), G.repeat(7)]);
	});

	it('does not mutate the input', () => {
		const input = [newest, oldest];
		getResultRows(input);
		expect(input).toEqual([newest, oldest]);
	});

	it('formats share text', () => {
		expect(formatShareText([newest, oldest], '2026-10-12')).toBe(
			`Guessing Games 2026-10-12 - 2 guesses\n1. ${B.repeat(7)}\n2. ${G.repeat(7)}`
		);
	});

	it('uses singular for one guess', () => {
		expect(formatShareText([newest], '2026-10-12')).toContain('1 guess\n');
	});
});

