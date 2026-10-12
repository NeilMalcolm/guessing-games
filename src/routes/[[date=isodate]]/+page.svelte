<script lang="ts">
	import Searchbar from '$lib/components/+Searchbar.svelte';
	import type { SearchResponse, SearchResult } from '../movies/search/+server';
	import SearchItem from '$lib/components/+SearchItem.svelte';
	import Guess from '$lib/components/+Guess.svelte';
	import ResultsModal from '$lib/components/+ResultsModal.svelte';
	import { Match, type GameSessionClientResponse, type GuessResponse } from '$lib/types/guess';
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

	$effect(() => {
		guesses = data.guesses ?? [];
		gameStatus = data.gameStatus ?? 'in_progress';
		showViewResults = data.gameStatus !== 'in_progress';
	});

	async function onGuessSuccess() {
		showViewResults = true;

		setTimeout(() => { showResults = true; }, 800);
	}

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
			throw new Error('Failed to get search data');
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

		showViewResults = sessionData.gameStatus === 'lost';
	}

	let replayKey = $state(0);

	/**
	 * Testing helper to make the latest card successful and replay animation.
	 */
	function makeLatestSuccessful() {
		newestGuessNumber = 0;
		gameStatus = 'won';
		showViewResults = false;
		if (guesses.length === 0) {
			guesses = [
				{
					title: 'The Matrix',
					image: null,
					yearResult: { value: '1999', match: Match.Exact },
					genresResult: [
						{ value: 'Action', match: Match.Exact },
						{ value: 'Sci-Fi', match: Match.Exact }
					],
					boxOfficeResult: { value: '$467.2M', match: Match.Exact },
					ratingResult: { value: '87/100', match: Match.Exact },
					directorResult: { value: 'Lana Wachowski', image: '', match: Match.Exact },
					castMembersResult: [
						{ value: 'Keanu Reeves', image: '', match: Match.Exact },
						{ value: 'Laurence Fishburne', image: '', match: Match.Exact }
					],
					ageRatingResult: { value: '15', match: Match.Exact },
					isCorrect: true,
					status: 'won'
				}
			];
		} else {
			const latest = {
				...guesses[0],
				isCorrect: true,
				yearResult: guesses[0].yearResult
					? { ...guesses[0].yearResult, match: Match.Exact }
					: guesses[0].yearResult,
				boxOfficeResult: guesses[0].boxOfficeResult
					? { ...guesses[0].boxOfficeResult, match: Match.Exact }
					: guesses[0].boxOfficeResult,
				ratingResult: guesses[0].ratingResult
					? { ...guesses[0].ratingResult, match: Match.Exact }
					: guesses[0].ratingResult,
				ageRatingResult: guesses[0].ageRatingResult
					? { ...guesses[0].ageRatingResult, match: Match.Exact }
					: guesses[0].ageRatingResult,
				directorResult: guesses[0].directorResult
					? { ...guesses[0].directorResult, match: Match.Exact }
					: guesses[0].directorResult,
				castMembersResult: guesses[0].castMembersResult
					? guesses[0].castMembersResult.map((c) => ({ ...c, match: Match.Exact }))
					: [],
				genresResult: guesses[0].genresResult
					? guesses[0].genresResult.map((g) => ({ ...g, match: Match.Exact }))
					: []
			};
			guesses = [latest, ...guesses.slice(1)];
		}
		replayKey++;
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
						minCharacters={2}
						disabled={isGameFinished}
					/>
					<button class="btn btn-outline btn-warning w-24" disabled={isGameFinished}>
						Give Up
					</button>
					<button type="button" class="btn btn-outline btn-success" onclick={makeLatestSuccessful}>
						Test Win
					</button>
				</div>

				{#if searchResults}
					<ul
						class="dropdown-content z-50 list bg-base-100 rounded-box shadow-xl border border-base-300 mt-2 max-h-[500px] overflow-y-auto w-full"
					>
						{#each searchResults.results as searchResult}
							<li class="w-full">
								<SearchItem {searchResult} {onResultClicked} />
							</li>
						{/each}
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
						onclick={() => (showResults = true)}
					>
						View Results
					</button>
				</div>
			{/if}
			<div class="mt-2">
				<ul>
					{#each guesses as guess, index (guess.title + (index === 0 ? `-${replayKey}` : ''))}
						<li>
							<Guess
								{guess}
								index={guesses.length - index}
								animate={index == newestGuessNumber}
								onSuccess={onGuessSuccess}
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
	won={gameStatus === 'won'}
	playDate={data.playDate}
/>
