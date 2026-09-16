<script lang="ts">
	import type { SearchResult } from "../../routes/movies/search/+server";

    let { 
        searchResult,
        onResultClicked, 
        ...props 
    } 
    : { 
        searchResult: SearchResult;
        onResultClicked: (guess: SearchResult) => void;
    } = $props();

</script>

<button class="list-row" onclick={() => onResultClicked(searchResult)}>
    <div>
        {#if searchResult.imagePath}
            <img class="w-s rounded-md" 
                src={searchResult.imagePath} 
                alt={`Poster for ${searchResult.title}`}/>
        {/if}
    </div> 
    <div>     
        <div class="text-lg font-semibold opacity-60">{searchResult.title}</div>
        <div class="text-md opacity-45">{new Date(searchResult.releaseDate).getFullYear()}</div>
    </div>
</button>