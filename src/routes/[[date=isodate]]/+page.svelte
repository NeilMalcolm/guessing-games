<script lang="ts">
	import Searchbar from '$lib/components/+Searchbar.svelte';
	import type { SearchResponse, SearchResult } from '$lib/types/search';
	import SearchItem from '$lib/components/+SearchItem.svelte';
	import Guess from '$lib/components/+Guess.svelte';
	import ResultsModal from '$lib/components/+ResultsModal.svelte';
	import type { AvailableHints, GameSessionClientResponse, GuessResponse, TargetMovie, UsedHint } from '$lib/types/guess';
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import Dialog from '$lib/components/+Dialog.svelte';
	import { logger } from '@sentry/sveltekit';
	import { GAME_STATUS_IN_PROGRESS, HINT_TYPE_KEYWORDS, HINT_TYPE_POSTER, HINT_TYPE_TAGLINE } from '$lib/types/supabasetables';
	import { getInDisplayTextFormat} from '$lib/types/hint';

	let {
		data,
		guessRevealDelay,
		resultModalDelay = 800
	}: {
		data: PageData;
		guessRevealDelay?: number;
		resultModalDelay?: number;
	} = $props();

	let searchQuery = $state('');
	let searchResults: SearchResponse | null = $state(null);
	let gameStatus: string = $state(untrack(() => data.gameStatus ?? GAME_STATUS_IN_PROGRESS));
	let isGameFinished: boolean = $derived(gameStatus !== GAME_STATUS_IN_PROGRESS);
	let newestGuessIndex: number = $state(-1);
	let showResults = $state(false);
	let showViewResults = $state(untrack(() => data.gameStatus !== GAME_STATUS_IN_PROGRESS));

	let guesses: GuessResponse[] = $state(untrack(() => data.guesses ?? []));
	let guessedMovieIds = $derived(guesses.map((g) => g.movieId));

	let availableHints: AvailableHints | undefined = $state(untrack(() => data?.availableHints))
	let usedHints: UsedHint[] = $state(untrack(() => data?.usedHints ?? []));
	
	let targetMovie: TargetMovie | null | undefined = $state(null);
	let isSearching: boolean = $state(false);
	let showSearchDropdown: boolean = $state(true);
	let searchController: AbortController | null = null;

	let showGiveUpModal: boolean = $state(false);
	let showChooseHintModal: boolean = $state(false);

	$effect(() => {
		guesses = data.guesses ?? [];
		gameStatus = data.gameStatus ?? GAME_STATUS_IN_PROGRESS;
		targetMovie = data.targetMovie;
		showViewResults = data.gameStatus !== GAME_STATUS_IN_PROGRESS;
	});

	/**
	 * Triggers when a guess has finished being revealed.
	*/
	async function onGuessRevealed() {
		
		if (!targetMovie) return;

		showViewResults = true;

		setTimeout(() => { showResults = true; }, resultModalDelay);
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
				searchResults = { results: [] };
				return;
			}

			let json = await response.json();
			let results = json as SearchResponse;
			markAnyResultsAsAlreadyGuessed(results);

			searchResults = results;
		} catch (e) { 
			// don't throw for aborted exceptions, we can expect those.
			if (e instanceof DOMException && e.name === 'AbortError') return;
			searchResults = { results: [] };
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

		newestGuessIndex = 0;
		rehydrateSessionData(sessionData);
	}

	/**
	 * Gives up the current game session.
	 */
	async function onGiveUp() {
		if (isGameFinished) {
			return;
		}

		onClear();

		const response = await fetch('/movies/give-up', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				date: data.playDate
			})
		});

		if (!response.ok) {
			console.error('Failed to give up');
			return;
		}

		const sessionData: GameSessionClientResponse = await response.json();
		rehydrateSessionData(sessionData);
		
		showViewResults = true;
		showResults = true;
	}

	/**
	 * Cancels any searches, hides results when the search bar is unfocused.
	 */
	function onSearchBarBlur(): void {  
		showSearchDropdown = false;
		searchController?.abort();
		searchController = null;
		isSearching = false;
	}

	/**
	 * Shows any previously-retrieved results again when the
	 * searchbar is focused.
	 */
	function onSearchBarFocus(): void {
		showSearchDropdown = true;
	}

	/**
	 * Marks any search result already in the guess list as already guessed.
	 * @param searchResponse
	 */
	function markAnyResultsAsAlreadyGuessed(searchResponse: SearchResponse) {
		searchResponse
		.results
		.forEach((sr) => sr.alreadyGuessed = guessedMovieIds.includes(sr.id));
	}

	async function onHintButtonClick() {
		showChooseHintModal = true;
	}

	async function takeHint(hint: string) {
		let response = await fetch('/movies/hint', {
			method: 'POST',
			headers: {
				'Content-Type' : 'application/json'
			},
			body: JSON.stringify({ date: data.playDate, hint: hint.toString() })
		})

		if (!response.ok) {
			logger.error('Error taking a hint {hint}, {response}', { hint: hint, response: response });
			// TODO: show error.
			return;
		}

		const sessionData: GameSessionClientResponse = await response.json();

		rehydrateSessionData(sessionData);

		showChooseHintModal = false;
	}

	function rehydrateSessionData(sessionData: GameSessionClientResponse) { 
		guesses = sessionData.guesses;
		gameStatus = sessionData.gameStatus;
		availableHints = sessionData.availableHints;
		usedHints = sessionData.usedHints ?? [];
		
		// only populated at the end of the game if lost/won
		targetMovie = sessionData.targetMovie;
	}
</script>

<main>
	<div class="flex justify-center">
		<div class="w-full px-[15px] sm:max-w-xl md:max-w-2xl">
			<div class="dropdown dropdown-bottom dropdown-open flex mt-2">
				<div class="flex flex-1 gap-3">
					<Searchbar
						bind:value={searchQuery}
						{onSearch}
						{onClear}
						onBlur={onSearchBarBlur}
						onFocus={onSearchBarFocus}
						minCharacters={2}
						class="text-md"
						disabled={isGameFinished} />
					<button class="btn btn-outline btn-warning w-24" 
							disabled={isGameFinished || guesses.length < 1} 
							onclick={() => showGiveUpModal = true}>
						Give Up
					</button>
					<Dialog title="Give up on Guessing the Movie?"
							acceptText="Give Up" 
							closeText="Keep Guessing"
							acceptAction={onGiveUp}
							bind:open={showGiveUpModal}>
							<p class="text-base-content/60">Ready to admit defeat? This will end the game and reveal the movie. You won't be able to make any more guesses and this will count as a loss.</p> 
							
							<p class="text-base-content/60 mt-3">Are you sure you want to give up?</p>
					</Dialog>
				</div>

				{#if showSearchDropdown && (isSearching || searchResults)}
					<!-- preventDefault on mousedown keeps focus in the input so the list isn't hidden before a click lands. -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions: the handler only prevents focus loss, it adds no interaction -->
					<ul
						onmousedown={(e) => e.preventDefault()}
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
					{#if (usedHints ?? []).length > 0}
						{#each usedHints as hint}
							{#if hint.hintType === HINT_TYPE_POSTER}
								<img src="{hint.value as string}" alt="" class="w-130 h-200" style="image-rendering: pixelated">
							{/if}
							{#if hint.hintType === HINT_TYPE_TAGLINE}
								<p>"{hint.value as string}"</p>
							{/if}
							{#if hint.hintType === HINT_TYPE_KEYWORDS}
								<div class="flex flex-row gap-2">
									{#each (hint.value as string[]) as keyword}
										<div class="badge badge-outline badge-red  p-4">{keyword}</div>
									{/each}
								</div>
							{/if}
						{/each}
					{/if}
					{#if !isGameFinished && (availableHints?.unusedHintsCount ?? 0) > 0}
						
						<div class="flex flex items-center p-3">
							<p class="flex-grow text-base-content/60">You have unlocked a hint</p>
							<button class="btn"  
									onclick={onHintButtonClick}>Get Hint</button>
							
							<Dialog title="Need a Hint?"
									acceptText={null}
									closeText="No Thanks"
									bind:open={showChooseHintModal}>
									<p class="text-base-content/60">Choose from the following hint options:</p> 
									<div class="flex flex-row items-center gap-3 mt-4">
										{#each (availableHints?.hints ?? []) as hint}
											<button class="btn btn-outline {usedHints?.some(x => x.hintType === hint) ? "disabled" : ""} flex-grow" 
													onclick={() => takeHint(hint)}>
												{getInDisplayTextFormat(hint)}
											</button>
										{/each}
									</div>
							</Dialog>
						</div>
					{/if}
					{#each guesses as guess, index (`${guess.title}_${guesses.length - index}`)}
						<li>
							<Guess
								{guess}
								index={guesses.length - index}
								animate={index === newestGuessIndex}
								delay={guessRevealDelay}
								onRevealFinished={onGuessRevealed}
							/>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
</main>

{#if isGameFinished}
<ResultsModal
	bind:open={showResults}
	{guesses}
	{targetMovie}
	won={gameStatus === 'won'}
	playDate={data.playDate}/>
{/if}