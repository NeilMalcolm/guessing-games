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
    <div class="w-16 shrink-0 aspect-2/3 rounded-md bg-base-300 overflow-hidden">
        {#if searchResult.imagePath}
            <img class="size-full object-cover"
                
                src={searchResult.imagePath}
                alt={`Poster for ${searchResult.title}`}/>
        {/if}
    </div>
    <div>     
        <div class="text-lg font-semibold opacity-60">{searchResult.title}</div>
    </div>
</button>