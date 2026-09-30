<script lang="ts">
	import Searchbar from '$lib/components/+Searchbar.svelte';
	import type { SearchResponse, SearchResult } from './movies/search/+server';
	import SearchItem from '$lib/components/+SearchItem.svelte';
	import Guess from '$lib/components/+Guess.svelte';
	import type { GameSessionClientResponse, GuessResponse } from '$lib/types/guess';
	import type { PageData } from './$types';
	import { untrack } from 'svelte';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let searchResults: SearchResponse | null = $state(null);
	let gameStatus = $derived(data.gameStatus);
	let isGameFinished: boolean = $derived(gameStatus !== 'in_progress');
	
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
			return;
		}

		const response = await fetch('/movies/guess', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				guessedMovieId: guess.id
			})
		});

		if (!response.ok) {
			console.error('Failed to submit guess');
			return;
		}

		const sessionData: GameSessionClientResponse = await response.json();

        guesses = sessionData.guesses;
		gameStatus = sessionData.gameStatus;
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
                               class="flex flex-1"/>
                    <button class="btn btn-outline btn-warning w-24">
                        Give Up
                    </button>
                </div>

                {#if searchResults}
                <ul class="dropdown-content z-50 list bg-base-100 rounded-box shadow-xl border border-base-300 mt-3 max-h-[500px] overflow-y-auto">
                    {#each searchResults.results as searchResult}
                    <li>
                        <SearchItem {searchResult} 
                                    {onResultClicked}/>
                    </li>
                    {/each}
                </ul>
                {/if}
            </div>
            <div class="mt-2">
                <ul>
                    {#each guesses as guess, index}
                    <li>
                        <Guess {guess} index={guesses.length - index}/>
                    </li>
                    {/each}
                </ul>
            </div>
        </div>
    </div>
</main>