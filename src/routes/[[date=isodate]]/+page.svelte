<script lang="ts">
	import Searchbar from '$lib/components/+Searchbar.svelte';
	import type { SearchResponse, SearchResult } from '../movies/search/+server';
	import SearchItem from '$lib/components/+SearchItem.svelte';
	import Guess from '$lib/components/+Guess.svelte';
	import ResultsModal from '$lib/components/+ResultsModal.svelte';
	import type { GameSessionClientResponse, GuessResponse, TargetMovie } from '$lib/types/guess';
	import type { PageData } from './$types';
	import { untrack } from 'svelte';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let searchResults: SearchResponse | null = $state(null);
	let gameStatus: string = $state(untrack(() => data.gameStatus ?? 'in_progress'));
	let isGameFinished: boolean = $derived(gameStatus !== 'in_progress');
	let newestGuessNumber: Number = $state(-1);
	let showResults = $state(false);
	let showViewResults = $state(untrack(() => data.gameStatus !== 'in_progress'));

	let guesses: GuessResponse[] = $state(untrack(() => data.guesses ?? []));
	let targetMovie: TargetMovie | null | undefined = $state(null);
	let isSearching: boolean = $state(false);
	let searchController: AbortController | null = null;

	$effect(() => {
		guesses = data.guesses ?? [];
		gameStatus = data.gameStatus ?? 'in_progress';
		targetMovie = data.targetMovie;
		showViewResults = data.gameStatus !== 'in_progress';
	});

	/**
	 * Triggers when a guess has finished being revealed.
	*/
	async function onGuessRevealed() {
		showViewResults = true;

		setTimeout(() => { showResults = true; }, 800);
	}

	/**
	 * Handles search from the searchbar.
	 * @param searchTerm
	 */
	async function onSearch(searchTerm: string) {
		if (isGameFinished) {
			return;
		}

		searchController?.abort();
		searchController = new AbortController();
		const { signal } = searchController;

		try {
			isSearching = true;
			const response = await fetch(`/movies/search?title=${encodeURIComponent(searchTerm)}`, 
				{ signal });	// need to abort if another search request comes in.

			if (!response.ok) {
				throw new Error('Failed to get search data');
			}

			let json = await response.json();
			searchResults = json as SearchResponse;
		} catch (e) { 
			// don't throw for aborted exceptions, we can expect those.
			if (e instanceof DOMException && e.name === 'AbortError') return;
			throw e;	
		} finally {
			if (!signal.aborted)
				isSearching = false;
		}
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
		targetMovie = sessionData.targetMovie;	
	}


	function onSearchBarBlur(): void {  
		searchResults = null;
		searchController?.abort();
		searchController = null;
		isSearching = false;
	}
</script>

<main>
	<div class="flex justify-center-safe">
		<div>
			<div class="dropdown dropdown-bottom dropdown-open flex mt-2">
				<div class="flex flex-1 gap-3">
					<Searchbar
						bind:value={searchQuery}
						{onSearch}
						{onClear}
						onBlur={onSearchBarBlur}
						minCharacters={2}
						class="text-md"
						disabled={isGameFinished}
					/>
					<button class="btn btn-outline btn-warning w-24" disabled={isGameFinished}>
						Give Up
					</button>
				</div>

				{#if isSearching || searchResults}
					<ul
						class="dropdown-content z-50 list bg-base-100 rounded-box shadow-xl border border-base-300 mt-2 max-h-[500px] overflow-y-auto w-full">
						{#if searchResults}
								{#each searchResults.results as searchResult}
									<li class="w-full">
										<SearchItem {searchResult} {onResultClicked} />
									</li>
								{/each}
						{:else}
							<span class="skeleton skeleton-text pl-5 pr-5 pt-3 pb-4">Thumbing through film reels...</span>
						{/if}
					</ul>
				{/if}
			</div>
			{#if showViewResults}
				{@const won = gameStatus === 'won'}
				<div class="flex flex-col items-center gap-3 mt-4">
					<p class="text-lg font-semibold text-center">
						{won ? 'Well done, you guessed right!' : 'Sorry, better luck next time'}
					</p>
					<button
						class="btn btn-soft {won ? 'btn-success' : 'btn-error'}"
						onclick={() => (showResults = true)}>
						View Results
					</button>
				</div>
			{/if}
			<div class="mt-2">
				<ul>
					{#each guesses as guess, index (guess.title)}
						<li>
							<Guess
								{guess}
								index={guesses.length - index}
								animate={index == newestGuessNumber}
								onRevealFinished={onGuessRevealed}
							/>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
</main>

<ResultsModal
	bind:open={showResults}
	{guesses}
	{targetMovie}
	won={gameStatus === 'won'}
	playDate={data.playDate}
/>
