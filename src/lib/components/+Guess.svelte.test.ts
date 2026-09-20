import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Match, type GuessResponse, type PropertyResult } from '$lib/types/guess';
import Guess from './+Guess.svelte';
import type { GameSessionStatus } from '$lib/types/supabasetables';

describe('Welcome.svelte', () => {
    it('renders guess content text correctly', async () => {
        render(Guess, { guess: getFullGuessResponse() });

        // We should see title as a heading
        await expect
            .element(page.getByRole('heading', { level: 3 }))
            .toHaveTextContent('Example');
            
        // We should see release year
        await expect
            .element(page.getByTitle('Release Year'))
            .toHaveTextContent('2026');
            
        // We should see rating
        await expect
            .element(page.getByTitle('Rating Score'))
            .toHaveTextContent('Rating: 78/100');
            
        // We should see age rating
        await expect
            .element(page.getByTitle('Age Rating / Certification'))
            .toHaveTextContent('Cert: 12A');

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
        render(Guess, { guess: getGuessResponseWithMatch(Match.Exact) });
        await assertMatchFields('badge-success', '');
    });
    
    it('renders high match values correctly', async () => {
        render(Guess, { guess: getGuessResponseWithMatch(Match.Higher) });
        await assertMatchFields('badge-neutral', '↑');
    });
    
    it('renders close-high match values correctly', async () => {
        render(Guess, { guess: getGuessResponseWithMatch(Match.HigherClose) });
        await assertMatchFields('badge-warning', '↑');
    });
    
    it('renders low match values correctly', async () => {
        render(Guess, { guess: getGuessResponseWithMatch(Match.Lower) });
        await assertMatchFields('badge-neutral', '↓');
    });
    
    it('renders close-low match values correctly', async () => {
        render(Guess, { guess: getGuessResponseWithMatch(Match.LowerClose) });
        await assertMatchFields('badge-warning', '↓');
    });
    
});

async function assertMatchFields(expectedClass: string, arrow: string) {
    const expectations = [
        { title: 'Release Year', text: `2026 ${arrow}`.trim() },
        { title: 'Box Office Revenue', text: `Box Office: $2.5M ${arrow}`.trim() },
        { title: 'Rating Score', text: `Rating: 78/100 ${arrow}`.trim() },
        { title: 'Age Rating / Certification', text: `Cert: 12A ${arrow}`.trim() }
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

function getGuessResponseWithMatch(match: Match): GuessResponse {
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
            },
        ],
        { 
            value: '$2.5M',
            match
        },
        { 
            value: '78/100',
            match
        },
        [
            { 
                value: 'John Smith',
                match
            },
            { 
                value: 'Jane Smith',
                match
            },
        ],
        { 
            value: '12A',
            match
        },
        false,
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
    castMembersResult: PropertyResult[],
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
      castMembersResult: castMembersResult,
      ageRatingResult: ageRatingResult,
      isCorrect: isCorrect,
      status: status
    }
}
