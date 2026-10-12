import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	Match,
	type CastPropertyResult,
	type GuessResponse,
	type PropertyResult
} from '$lib/types/guess';
import Guess, { LONGEST_DATA_MATCH_DELAY_MS, SUCCESS_BACKGROUND_DELAY_MS } from './+Guess.svelte';
import type { GameSessionStatus } from '$lib/types/supabasetables';

describe('+Guess.svelte', () => {
	it('renders guess content text correctly', async () => {
		render(Guess, { guess: getFullGuessResponse(), index: 0 });

		// We should see title as a heading
		await expect.element(page.getByRole('heading', { level: 3 })).toHaveTextContent('Example');

		// We should see release year
		await expect.element(page.getByTitle('Year')).toHaveTextContent('2026');

		// We should see rating
		await expect.element(page.getByTitle('Rating')).toHaveTextContent('78/100');

		// We should see age rating
		await expect.element(page.getByTitle('Certification')).toHaveTextContent('12A');

		// We should see genres show
		const genresDiv = page.getByTitle('Genres');
		await expect.element(genresDiv.getByText('Adventure')).toBeInTheDocument();
		await expect.element(genresDiv.getByText('Action')).toBeInTheDocument();

		// We should see cast members show
		const castDiv = page.getByTitle('Cast');
		await expect.element(castDiv.getByText('John Smith')).toBeInTheDocument();
		await expect.element(castDiv.getByText('Jane Smith')).toBeInTheDocument();
	});

	it('renders matched values correctly', async () => {
		render(Guess, { guess: getGuessResponseWithMatch(Match.Exact), index: 0 });
		await assertMatchFields('bg-success', '');
	});

	it('renders high match values correctly', async () => {
		render(Guess, { guess: getGuessResponseWithMatch(Match.Higher), index: 1 });
		await assertMatchFields('bg-neutral', '↑');
	});

	it('renders close-high match values correctly', async () => {
		render(Guess, { guess: getGuessResponseWithMatch(Match.HigherClose), index: 2 });
		await assertMatchFields('bg-warning', '↑');
	});

	it('renders low match values correctly', async () => {
		render(Guess, { guess: getGuessResponseWithMatch(Match.Lower), index: 3 });
		await assertMatchFields('bg-neutral', '↓');
	});

	it('renders close-low match values correctly', async () => {
		render(Guess, { guess: getGuessResponseWithMatch(Match.LowerClose), index: 4 });
		await assertMatchFields('bg-warning', '↓');
	});

	describe('director and cast member results', () => {
		it('renders director result with profile image and name', async () => {
			render(Guess, { guess: getFullGuessResponse(), index: 0 });

			const directorSection = page.getByTitle('Director');
			await expect.element(directorSection).toBeInTheDocument();
			await expect.element(directorSection.getByText('Danny Devito')).toBeInTheDocument();

			const image = directorSection.getByAltText('Profile picture for Danny Devito');
			await expect.element(image).toBeInTheDocument();
			await expect.element(image).toHaveAttribute('src', 'http://example.com/image2.png');
		});

		it('renders all cast members with profile images and names', async () => {
			render(Guess, { guess: getFullGuessResponse(), index: 0 });

			const castSection = page.getByTitle('Cast');
			await expect.element(castSection).toBeInTheDocument();

			// First cast member
			await expect.element(castSection.getByText('John Smith')).toBeInTheDocument();
			const johnImg = castSection.getByAltText('Profile picture for John Smith');
			await expect.element(johnImg).toBeInTheDocument();
			await expect.element(johnImg).toHaveAttribute('src', 'http://example.com/image2.png');

			// Second cast member
			await expect.element(castSection.getByText('Jane Smith')).toBeInTheDocument();
			const janeImg = castSection.getByAltText('Profile picture for Jane Smith');
			await expect.element(janeImg).toBeInTheDocument();
			await expect.element(janeImg).toHaveAttribute('src', 'http://example.com/image.png');
		});

		it('applies exact match highlight (ring-success and text-success) when match is Exact', async () => {
			render(Guess, { guess: getGuessResponseWithMatch(Match.Exact), index: 0 });

			const directorSection = page.getByTitle('Director');
			const directorName = directorSection.getByText('Danny Devito');
			await expect.element(directorName).toHaveClass('text-success');
			const directorImg = directorSection.getByAltText('Profile picture for Danny Devito');
			await expect.element(directorImg.element().parentElement).toHaveClass('ring-success');

			const castSection = page.getByTitle('Cast');
			const johnName = castSection.getByText('John Smith');
			await expect.element(johnName).toHaveClass('text-success');
			const johnImg = castSection.getByAltText('Profile picture for John Smith');
			await expect.element(johnImg.element().parentElement).toHaveClass('ring-success');
		});

		it('does not apply exact match styling when match is not Exact', async () => {
			render(Guess, { guess: getGuessResponseWithMatch(Match.None), index: 0 });

			const directorSection = page.getByTitle('Director');
			const directorName = directorSection.getByText('Danny Devito');
			await expect.element(directorName).not.toHaveClass('text-success');
			await expect.element(directorName).toHaveClass('opacity-90');
			const directorImg = directorSection.getByAltText('Profile picture for Danny Devito');
			await expect.element(directorImg.element().parentElement).not.toHaveClass('ring-success');

			const castSection = page.getByTitle('Cast');
			const johnName = castSection.getByText('John Smith');
			await expect.element(johnName).not.toHaveClass('text-success');
			await expect.element(johnName).toHaveClass('opacity-90');
			const johnImg = castSection.getByAltText('Profile picture for John Smith');
			await expect.element(johnImg.element().parentElement).not.toHaveClass('ring-success');
		});

		it('does not render director section when directorResult is not present', async () => {
			const guess = getFullGuessResponse();
			delete (guess as Partial<GuessResponse>).directorResult;
			render(Guess, { guess, index: 0 });

			await expect.element(page.getByTitle('Director')).not.toBeInTheDocument();
		});

		it('does not render cast section when castMembersResult is empty', async () => {
			const guess = getFullGuessResponse();
			guess.castMembersResult = [];
			render(Guess, { guess, index: 0 });

			await expect.element(page.getByTitle('Cast')).not.toBeInTheDocument();
		});
	});

	describe('tile background color on correct guess', () => {
		it('has a success background delay strictly later than the longest DataMatch animation delay', () => {
			expect(SUCCESS_BACKGROUND_DELAY_MS).toBeGreaterThan(LONGEST_DATA_MATCH_DELAY_MS);
		});

		it('does not apply success background color when guess is not correct', async () => {
			render(Guess, { guess: getGuessResponseWithMatch(Match.Exact, false), index: 0 });

			const tile = page.getByTestId('guess-tile');
			await expect.element(tile).toHaveClass('bg-base-300');
			await expect.element(tile).not.toHaveClass('bg-success');
		});

		it('applies success background color immediately when guess is correct and not animated', async () => {
			render(Guess, {
				guess: getGuessResponseWithMatch(Match.Exact, true),
				index: 0,
				animate: false
			});

			const tile = page.getByTestId('guess-tile');
			await expect.element(tile).toHaveClass('bg-success');
			await expect.element(tile).not.toHaveClass('bg-base-300');
		});

		it('applies success background color on delay when guess is correct and animated', async () => {
			render(Guess, {
				guess: getGuessResponseWithMatch(Match.Exact, true),
				index: 0,
				animate: true,
				delay: 200
			});

			const tile = page.getByTestId('guess-tile');
			// Before the delay, the tile has the default background and not the success color
			await expect.element(tile).toHaveClass('bg-base-300');
			await expect.element(tile).not.toHaveClass('bg-success');

			// Wait for delay to complete
			await new Promise((resolve) => setTimeout(resolve, 250));

			// After delay, the tile has the success background color
			await expect.element(tile).toHaveClass('bg-success');
			await expect.element(tile).not.toHaveClass('bg-base-300');
		});

		it('does not apply success background color even after delay when guess is incorrect and animated', async () => {
			render(Guess, {
				guess: getGuessResponseWithMatch(Match.Exact, false),
				index: 0,
				animate: true,
				delay: 200
			});

			const tile = page.getByTestId('guess-tile');
			await expect.element(tile).toHaveClass('bg-base-300');
			await expect.element(tile).not.toHaveClass('bg-success');

			await new Promise((resolve) => setTimeout(resolve, 250));

			await expect.element(tile).toHaveClass('bg-base-300');
			await expect.element(tile).not.toHaveClass('bg-success');
		});
	});

	describe('choreographed element reveals during animation', () => {
		it('reveals genres, director, and cast from regular/unrevealed state to success in sequence when animated', async () => {
			render(Guess, {
				guess: getGuessResponseWithMatch(Match.Exact, true),
				index: 0,
				animate: true,
				delay: 300
			});

			const genresDiv = page.getByTitle('Genres');
			const actionBadge = genresDiv.getByText('Action');
			const adventureBadge = genresDiv.getByText('Adventure');

			const directorSection = page.getByTitle('Director');
			const directorName = directorSection.getByText('Danny Devito');
			const directorImg = directorSection.getByAltText('Profile picture for Danny Devito');

			const castSection = page.getByTitle('Cast');
			const johnName = castSection.getByText('John Smith');
			const johnImg = castSection.getByAltText('Profile picture for John Smith');

			// Immediately upon mount, elements start in unrevealed / regular state
			await expect.element(actionBadge).toHaveClass('badge-neutral');
			await expect.element(actionBadge).not.toHaveClass('badge-success');

			await expect.element(directorName).not.toHaveClass('text-success');
			await expect.element(directorImg.element().parentElement).not.toHaveClass('ring-success');

			await expect.element(johnName).not.toHaveClass('text-success');
			await expect.element(johnImg.element().parentElement).not.toHaveClass('ring-success');

			// Wait for the full animation sequence to finish
			await new Promise((resolve) => setTimeout(resolve, 350));

			// After the sequence finishes, exact matches are revealed to success
			await expect.element(actionBadge).not.toHaveClass('badge-neutral');
			await expect.element(adventureBadge).not.toHaveClass('badge-neutral');

			await expect.element(directorImg.element().parentElement).toHaveClass('ring-success');
			await expect.element(johnImg.element().parentElement).toHaveClass('ring-success');
		});
	});
});

async function assertMatchFields(expectedClass: string, arrow: string) {
	const expectations = [
		{ title: 'Year', text: `2026 ${arrow}`.trim() },
		{ title: 'Box Office', text: `$2.5M ${arrow}`.trim() },
		{ title: 'Rating', text: `78/100 ${arrow}`.trim() },
		{ title: 'Certification', text: '12A' }
	];

	for (const { title, text } of expectations) {
		const div = page.getByTitle(title);
		await expect.element(div).toHaveClass(expectedClass);
		await expect.element(div).toHaveTextContent(text);
	}
}

function getFullGuessResponse(): GuessResponse {
	return getGuessResponseWithMatch(Match.Exact);
}

function getGuessResponseWithMatch(match: Match, isCorrect: boolean = false): GuessResponse {
	return getGuessResponse(
		'Example',
		'https://example.com/image.png',
		{
			value: '2026',
			match
		},
		[
			{
				value: 'Action',
				match
			},
			{
				value: 'Adventure',
				match
			}
		],
		{
			value: '$2.5M',
			match
		},
		{
			value: '78/100',
			match
		},
		{
			value: 'Danny Devito',
			image: 'http://example.com/image2.png',
			match
		},
		[
			{
				value: 'John Smith',
				image: 'http://example.com/image2.png',
				match
			},
			{
				value: 'Jane Smith',
				image: 'http://example.com/image.png',
				match
			}
		],
		{
			value: '12A',
			match
		},
		isCorrect,
		'in_progress'
	);
}

function getGuessResponse(
	title: string,
	image: string | null = null,
	yearResult: PropertyResult,
	genresResult: PropertyResult[],
	boxOfficeResult: PropertyResult,
	ratingResult: PropertyResult,
	directorResult: CastPropertyResult,
	castMembersResult: CastPropertyResult[],
	ageRatingResult: PropertyResult,
	isCorrect: boolean,
	status: GameSessionStatus
): GuessResponse {
	return {
		title: title,
		image: image,
		yearResult: yearResult,
		genresResult: genresResult,
		boxOfficeResult: boxOfficeResult,
		ratingResult: ratingResult,
		directorResult: directorResult,
		castMembersResult: castMembersResult,
		ageRatingResult: ageRatingResult,
		isCorrect: isCorrect,
		status: status
	};
}
