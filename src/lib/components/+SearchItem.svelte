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

<button class="flex w-full items-center gap-4 p-4 text-left cursor-pointer hover:bg-base-200" onclick={() => onResultClicked(searchResult)}>
    <div>
        {#if searchResult.imagePath}
            <img class="w-s rounded-md" 
                src={searchResult.imagePath} 
                alt={`Poster for ${searchResult.title}`}/>
        {/if}
    </div> 
    <div>     
        <div class="text-lg font-semibold opacity-60">{searchResult.title}</div>
    </div>
</button>