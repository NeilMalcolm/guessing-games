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

	it('matches the first user example: genres exact, year + box office close', () => {
		const guess = makeGuess({
			genresResult: [prop(Match.Exact), prop(Match.Exact)],
			yearResult: prop(Match.LowerClose),
			boxOfficeResult: prop(Match.HigherClose)
		});
		expect(getGuessSquares(guess).join('')).toBe(`${G}${Y}${Y}${B}${B}${B}${B}`);
	});

	it('matches the second user example: genres + year exact, cast partial', () => {
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

	describe('individual categories', () => {
		it('evaluates year correctly for exact, close (higher/lower), and far', () => {
			expect(getGuessSquares(makeGuess({ yearResult: prop(Match.Exact) }))[1]).toBe(G);
			expect(getGuessSquares(makeGuess({ yearResult: prop(Match.LowerClose) }))[1]).toBe(Y);
			expect(getGuessSquares(makeGuess({ yearResult: prop(Match.HigherClose) }))[1]).toBe(Y);
			expect(getGuessSquares(makeGuess({ yearResult: prop(Match.Lower) }))[1]).toBe(B);
			expect(getGuessSquares(makeGuess({ yearResult: prop(Match.Higher) }))[1]).toBe(B);
			expect(getGuessSquares(makeGuess({ yearResult: prop(Match.None) }))[1]).toBe(B);
		});

		it('evaluates box office correctly for exact, close, and far', () => {
			expect(getGuessSquares(makeGuess({ boxOfficeResult: prop(Match.Exact) }))[2]).toBe(G);
			expect(getGuessSquares(makeGuess({ boxOfficeResult: prop(Match.LowerClose) }))[2]).toBe(Y);
			expect(getGuessSquares(makeGuess({ boxOfficeResult: prop(Match.HigherClose) }))[2]).toBe(Y);
			expect(getGuessSquares(makeGuess({ boxOfficeResult: prop(Match.Higher) }))[2]).toBe(B);
		});

		it('evaluates rating correctly for exact, close, and far', () => {
			expect(getGuessSquares(makeGuess({ ratingResult: prop(Match.Exact) }))[3]).toBe(G);
			expect(getGuessSquares(makeGuess({ ratingResult: prop(Match.LowerClose) }))[3]).toBe(Y);
			expect(getGuessSquares(makeGuess({ ratingResult: prop(Match.HigherClose) }))[3]).toBe(Y);
			expect(getGuessSquares(makeGuess({ ratingResult: prop(Match.Lower) }))[3]).toBe(B);
		});

		it('evaluates certification correctly for exact, close, and none', () => {
			expect(getGuessSquares(makeGuess({ ageRatingResult: prop(Match.Exact) }))[4]).toBe(G);
			expect(getGuessSquares(makeGuess({ ageRatingResult: prop(Match.HigherClose) }))[4]).toBe(Y);
			expect(getGuessSquares(makeGuess({ ageRatingResult: prop(Match.None) }))[4]).toBe(B);
		});

		it('evaluates director correctly: only exact is green, others black', () => {
			expect(
				getGuessSquares(makeGuess({ directorResult: { ...prop(Match.Exact), image: '' } }))[5]
			).toBe(G);
			expect(
				getGuessSquares(makeGuess({ directorResult: { ...prop(Match.None), image: '' } }))[5]
			).toBe(B);
		});

		it('evaluates genres correctly: all exact = green, some exact = yellow, none = black', () => {
			expect(
				getGuessSquares(
					makeGuess({ genresResult: [prop(Match.Exact), prop(Match.Exact)] })
				)[0]
			).toBe(G);
			expect(
				getGuessSquares(
					makeGuess({ genresResult: [prop(Match.Exact), prop(Match.None)] })
				)[0]
			).toBe(Y);
			expect(
				getGuessSquares(
					makeGuess({ genresResult: [prop(Match.None), prop(Match.None)] })
				)[0]
			).toBe(B);
		});

		it('evaluates cast correctly: all exact = green, some exact = yellow, none = black', () => {
			expect(
				getGuessSquares(
					makeGuess({
						castMembersResult: [
							{ ...prop(Match.Exact), image: '' },
							{ ...prop(Match.Exact), image: '' }
						]
					})
				)[6]
			).toBe(G);
			expect(
				getGuessSquares(
					makeGuess({
						castMembersResult: [
							{ ...prop(Match.Exact), image: '' },
							{ ...prop(Match.None), image: '' }
						]
					})
				)[6]
			).toBe(Y);
			expect(
				getGuessSquares(
					makeGuess({
						castMembersResult: [{ ...prop(Match.None), image: '' }]
					})
				)[6]
			).toBe(B);
		});
	});

	it('handles empty genres and cast lists gracefully', () => {
		const squares = getGuessSquares(makeGuess({ genresResult: [], castMembersResult: [] }));
		expect(squares[0]).toBe(B);
		expect(squares[6]).toBe(B);
	});

	it('is all green for the winning guess', () => {
		expect(getGuessSquares(makeGuess({ isCorrect: true })).join('')).toBe(G.repeat(7));
	});
});

describe('getResultRows / formatShareText', () => {
	it('matches full game session progression and orders oldest-first', () => {
		// Guess 1 (first attempt): only genres partial, rating close
		const guess1 = makeGuess({
			genresResult: [prop(Match.Exact), prop(Match.None)],
			ratingResult: prop(Match.LowerClose)
		}); // Expect: 🟨 ⬛ ⬛ 🟨 ⬛ ⬛ ⬛

		// Guess 2 (second attempt): director exact, year exact, box office close
		const guess2 = makeGuess({
			directorResult: { ...prop(Match.Exact), image: '' },
			yearResult: prop(Match.Exact),
			boxOfficeResult: prop(Match.HigherClose)
		}); // Expect: ⬛ 🟩 🟨 ⬛ ⬛ 🟩 ⬛

		// Guess 3 (winning attempt): isCorrect = true
		const guess3 = makeGuess({ isCorrect: true, status: 'won' }); // Expect: 🟩 🟩 🟩 🟩 🟩 🟩 🟩

		// The server returns guesses newest-first: [guess3, guess2, guess1]
		const sessionGuesses = [guess3, guess2, guess1];
		const rows = getResultRows(sessionGuesses);

		expect(rows).toEqual([
			`${Y}${B}${B}${Y}${B}${B}${B}`,
			`${B}${G}${Y}${B}${B}${G}${B}`,
			`${G}${G}${G}${G}${G}${G}${G}`
		]);
	});

	it('does not mutate the input array when reversing', () => {
		const newest = makeGuess({ isCorrect: true });
		const oldest = makeGuess();
		const input = [newest, oldest];
		getResultRows(input);
		expect(input[0]).toBe(newest);
		expect(input[1]).toBe(oldest);
	});

	it('formats share text correctly with multiple rows and numbering', () => {
		const newest = makeGuess({ isCorrect: true });
		const oldest = makeGuess();
		expect(formatShareText([newest, oldest], '2026-10-12')).toBe(
			`Guessing Games 2026-10-12 - 2 guesses\n1. ${B.repeat(7)}\n2. ${G.repeat(7)}`
		);
	});

	it('uses singular for one guess in share text', () => {
		const singleGuess = makeGuess({ isCorrect: true });
		expect(formatShareText([singleGuess], '2026-10-12')).toBe(
			`Guessing Games 2026-10-12 - 1 guess\n1. ${G.repeat(7)}`
		);
	});
});
