<script lang="ts">
	import Searchbar from '$lib/components/+Searchbar.svelte';
	import type { SearchResponse, SearchResult } from '../movies/search/+server';
	import SearchItem from '$lib/components/+SearchItem.svelte';
	import Guess from '$lib/components/+Guess.svelte';
	import ResultsModal from '$lib/components/+ResultsModal.svelte';
	import type { GameSessionClientResponse, GuessResponse } from '$lib/types/guess';
	import type { PageData } from './$types';
	import { untrack } from 'svelte';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let searchResults: SearchResponse | null = $state(null);
	let gameStatus: string = $derived(data.gameStatus);
	let isGameFinished: boolean = $derived(gameStatus !== 'in_progress');
	let newestGuessNumber: Number = $state(-1);
	let showResults = $state(false);
	
	let guesses: GuessResponse[] = $state(untrack(() => data.guesses ?? []));

	$effect(() => {
		guesses = data.guesses ?? [];
		gameStatus = data.gameStatus ?? 'in_progress';
	});

	/**
	 * Handles search from the searchbar.
	 * @param searchTerm
	 */
	async function onSearch(searchTerm: String) {
		if (isGameFinished) {
            console.log('game is finished');
			return;
		}

		console.log(`searching ${searchTerm}`);
		const response = await fetch(`/movies/search?title=${searchTerm}`);

		if (!response.ok) {
			throw new Error("Failed to get search data");	
		}

		let json = await response.json();
		searchResults = json as SearchResponse;
	}

	/**
	 * Invoked when clearing the text from the search bar.
	 */
	function onClear() {
		searchQuery = '';
		searchResults = null;
	}

	/**
	 * Handles the result.
	 * @param guess the search result being guessed.
	 */
	async function onResultClicked(guess: SearchResult) {
		if (isGameFinished) {
            console.log('game is finished');
			return;
		}

		onClear();
		
		await makeGuess(guess);
		// ensure the search results clear, even if a debounce happened.
		onClear();
	}

	/**
	 * Makes a guess from the given search result.
	 * @param guess
	 */
	async function makeGuess(guess: SearchResult) {
		if (isGameFinished) {
            console.log('game is finished');
			return;
		}

		const response = await fetch('/movies/guess', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				guessedMovieId: guess.id,
					date: data.playDate
			})
		});

		if (!response.ok) {
			console.error('Failed to submit guess');
			return;
		}

		const sessionData: GameSessionClientResponse = await response.json();

		newestGuessNumber = 0;
        guesses = sessionData.guesses;
		gameStatus = sessionData.gameStatus;

		showResults = sessionData.gameStatus !== 'in_progress';
	}; 

</script>

<main>
    <div class="flex justify-center-safe">
        <div>
            <div class="dropdown dropdown-bottom dropdown-open flex mt-2">
                <div class="flex flex-1 gap-3">
                    <Searchbar bind:value={searchQuery}
                               {onSearch}
                               {onClear}
                               minCharacters={2}
							   disabled={isGameFinished}/>
                    <button class="btn btn-outline btn-warning w-24"
							disabled={isGameFinished}>
                        Give Up
                    </button>
                </div>

                {#if searchResults}
                <ul class="dropdown-content z-50 list bg-base-100 rounded-box shadow-xl border border-base-300 mt-2 max-h-[500px] overflow-y-auto w-full">
                    {#each searchResults.results as searchResult}
                    <li class="w-full">
                        <SearchItem {searchResult} 
                                    {onResultClicked}/>
                    </li>
                    {/each}
                </ul>
                {/if}
            </div>
            {#if isGameFinished}
                {@const won = gameStatus === 'won'}
                <div class="flex flex-col items-center gap-3 mt-4">
                    <p class="text-lg font-semibold text-center">
                        {won ? 'Well done, you guessed right!' : 'Sorry, better luck next time'}
                    </p>
                    <button class="btn btn-soft {won ? 'btn-success' : 'btn-error'}"
                            onclick={() => (showResults = true)}>
                        View Results
                    </button>
                </div>
            {/if}
            <div class="mt-2">
                <ul>
                    {#each guesses as guess, index (guess.title)}
                    <li>
                        <Guess {guess} 
							   index={guesses.length - index} 
							   animate={index == newestGuessNumber}/>
                    </li>
                    {/each}
                </ul>
            </div>
        </div>
    </div>
</main>


<!-- 
<ResultsModal bind:open={showResults}
              {guesses}
              won={gameStatus === 'won'}
              playDate={data.playDate} /> -->