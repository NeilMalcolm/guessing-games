<script lang="ts">
	import type { SearchResponse, SearchResult } from "$lib/types/search";
	import SearchItem from "./+SearchItem.svelte";


    interface SearchResultsProps {
        isActive: boolean;
        isSearching: boolean;
        searchResults: SearchResponse | null;
        onResultClicked: (result: SearchResult) => void;
    }

    let {
        isActive,
        isSearching,
        searchResults,
        onResultClicked
    } : SearchResultsProps = $props();

</script>

{#if isActive && (isSearching || searchResults)}
    <!-- preventDefault on mousedown keeps focus in the input so the list isn't hidden before a click lands. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions: the handler only prevents focus loss, it adds no interaction -->
    <ul
        onmousedown={(e) => e.preventDefault()}
        class="dropdown-content z-50 list bg-base-100 rounded-box shadow-xl border border-base-300 mt-2 max-h-[500px] overflow-y-auto w-full">
        {#if searchResults}
            {#if searchResults.results.length > 0}
                {#each searchResults.results as searchResult}
                    <li class="w-full">
                        <SearchItem {searchResult} 
                                    {onResultClicked} />
                    </li>
                {/each}
            {:else}
                <li class="text-base-content/20 pl-5 pr-5 pt-3 pb-4">No results found</li>
            {/if}
        {:else}
            <span class="skeleton skeleton-text pl-5 pr-5 pt-3 pb-4">Thumbing through film reels...</span>
        {/if}
    </ul>
{/if}