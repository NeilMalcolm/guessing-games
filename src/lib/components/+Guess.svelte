<script lang="ts">
	import { getArrowForMatch, getBadgeClassForMatch, type GuessResponse } from "$lib/types/guess";
	import DataMatch from "./+DataMatch.svelte";
	import Profile from "./+Profile.svelte";

    let {
         guess, 
         index,
         ...props 
    } 
    : {
         guess: GuessResponse,
         index: number 
    } = $props();

</script>
<div class="card bg-base-300 shadow-md mb-3 overflow-hidden">
    <!-- Main content area -->
     
    <div>

        <div class="flex flex-1 p-5 gap-4 justify-stretch shrink-0">
            {#if guess.image}
                <figure class="w-34 self-stretch shrink-0 overflow-hidden rounded-md">
                    <img src={guess.image} alt={`Poster for ${guess.title}`} class="w-full h-full object-cover" />
                </figure>
            {/if}

            <div class="flex-1 min-w-0">
                <div class="flex items-center mb-2">
                    <h3 class="font-bold text-2xl truncate">{guess.title}</h3>
                </div>
                {#if guess.genresResult && guess.genresResult.length > 0}
                    <div class="flex flex-wrap gap-1 items-center  mb-3" title="Genres">
                        {#each guess.genresResult as genreResult}
                            <span class={`${getBadgeClassForMatch(genreResult.match)} badge-s`}>
                                {genreResult.value}
                            </span>
                        {/each}
                    </div>
                {/if}

                <div class="grid grid-cols-2 gap-2">
                    {#if guess.yearResult}
                        <DataMatch title="Year" 
                                   propertyResult={guess.yearResult}/>
                    {/if}

                    {#if guess.boxOfficeResult}
                        <DataMatch title="Box Office"
                                   propertyResult={guess.boxOfficeResult}/>
                    {/if}

                    {#if guess.ratingResult}
                        <DataMatch title="Rating" 
                                   propertyResult={guess.ratingResult}/>
                    {/if}

                    {#if guess.ageRatingResult}
                        <DataMatch title="Certification" 
                                   propertyResult={guess.ageRatingResult} 
                                   showArrow={false}/>
                    {/if}
                </div>
                
            </div>
        </div>

        
        <!-- <div class="flex-1 flex flex-col gap-2 min-w-0" title="Director and Cast"> -->
         
            <div class="flex items-start justify-center pl-3 pr-3 pb-5">
                {#if guess.directorResult}
                    <div class="flex flex-col gap-3">
                        <div class="text-xs uppercase opacity-70 mt-1">Director</div>
                        <div class="flex flex-wrap gap-1 items-center" title="Director">
                            <Profile castMember={guess.directorResult} />
                        </div>
                    </div>
                {/if}
                <div class="mt-10 mb-5 divider divider-horizontal"></div>
                {#if guess.castMembersResult && guess.castMembersResult.length > 0}
                    <div class="flex flex-col gap-3">
                        <div class="text-xs uppercase opacity-70 mt-1">Cast</div>
                        <div class="flex flex-wrap gap-2 items-center" title="Cast">
                            {#each guess.castMembersResult as castResult}
                                <Profile castMember={castResult} />
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
    </div>
</div>