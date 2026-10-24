<script lang="ts">
	import type { SearchResult } from "$lib/types/search";

    interface SearchItemProps {
        searchResult: SearchResult,
        onResultClicked: (guess: SearchResult) => void
    };

    let { 
        searchResult,
        onResultClicked, 
        ...props 
    } 
    : SearchItemProps = $props();

</script>

<button class="flex w-full items-center gap-4 p-4 text-left cursor-pointer hover:bg-base-200" onclick={() => { 
        if (searchResult.alreadyGuessed) {
            return; 
        }

        onResultClicked(searchResult);
    }}>
    <div class="w-16 shrink-0 aspect-2/3 rounded-md bg-base-300 overflow-hidden">
        {#if searchResult.imagePath}
            <img class="size-full object-cover {searchResult.alreadyGuessed ? "opacity-50" : ""}"
                src={searchResult.imagePath}
                alt={`Poster for ${searchResult.title}`}/>
        {/if}
    </div>
    <div>     
        <div class="text-lg text-base-content {searchResult.alreadyGuessed ? "italic opacity-40" : "font-semibold"}">{searchResult.title}</div>
        {#if searchResult.alreadyGuessed}
            <div class="italic text-base-content opacity-20">Already guessed...</div>
        {/if}
    </div>
</button>
