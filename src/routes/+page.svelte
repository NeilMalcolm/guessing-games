<script lang="ts">
	import Searchbar from '$lib/components/+Searchbar.svelte';
	import type { SearchResponse, SearchResult } from './movies/search/+server';
	import SearchItem from '$lib/components/+SearchItem.svelte';
	import Guess from '$lib/components/+Guess.svelte';
	import type { GuessResponse } from '$lib/types/guess';

    let searchQuery = $state('')
    let searchResults: SearchResponse | null = $state(null);
    let guesses: GuessResponse[] = $state([]);

    /**
     * Handles search from the searchbar.
     * @param searchTerm
     */
    async function onSearch(searchTerm: String) {
		const response = await fetch(`/movies/search?title=${searchTerm}`);

        if (!response.ok)
        {
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
    }

    /**
     * Makes a guess from the given search result.
     * @param guess
     */
	async function makeGuess(guess: SearchResult) {
        const response = await fetch('/movies/guess', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                guessedMovieId: guess.id
            })
        });

        let guessRseponse: GuessResponse = await response.json() as GuessResponse;
        
        guesses.unshift(guessRseponse);
    };
</script>

<main>
    <div class="flex justify-center-safe">
        <div>
            <div class="dropdown dropdown-bottom dropdown-open">
                <div class="flex gap-2">
                    <Searchbar 
                                bind:value={searchQuery}
                                {onSearch}
                                {onClear}
                                minCharacters={2} />
                    <button class="btn btn-outline btn-accent">Give Up</button>
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
            <div class="mt-5">
                <ul>
                    {#each guesses as guess}
                    <li>
                        <Guess {guess}/>
                    </li>
                    {/each}
                </ul>
            </div>
        </div>
    </div>
</main>