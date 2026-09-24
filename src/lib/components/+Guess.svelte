<script lang="ts">
	import { Match, type GuessResponse } from "$lib/types/guess";

    let {
         guess, 
         index,
         ...props 
    } 
    : {
         guess: GuessResponse,
         index: number 
    } = $props();

    function getBadgeClassForMatch(match: Match) : string {
        if (match === Match.Exact) return "badge badge-success";
        if (match === Match.HigherClose || match === Match.LowerClose) return "badge badge-warning";

        return "badge badge-neutral";
    }
    
    function getArrowForMatch(match: Match) : string {
        if (match === Match.Exact) return "";
        if (match === Match.HigherClose || match === Match.Higher) return "↑";
        if (match === Match.LowerClose || match === Match.Lower) return "↓";

        return "";
    }
    
</script>
<div class="card card-side bg-base-200 shadow-md mb-3 overflow-hidden">
    <!-- Index section taking full height -->
    <div class="flex flex-col items-center justify-center bg-base-300 w-10 flex-shrink-0">
        <span class="text-xl leading-none opacity-65">#{index}</span>
    </div>

    <!-- Main content area -->
    <div class="flex flex-1 p-3 gap-4 items-center min-w-0">
        {#if guess.image}
            <figure class="w-22 h-32 flex-shrink-0 overflow-hidden rounded-md">
                <img src={guess.image} alt={`Poster for ${guess.title}`} class="w-full h-full object-cover" />
            </figure>
        {/if}

        
        <div class="flex-1 flex flex-col gap-2 min-w-0">
            <div class="flex items-center justify-between">
                <h3 class="font-bold text-lg truncate">{guess.title}</h3>
            </div>
            {#if guess.genresResult && guess.genresResult.length > 0}
                <div class="flex flex-wrap gap-1 items-center" title="Genres">
                    {#each guess.genresResult as genreResult}
                        <span class={`${getBadgeClassForMatch(genreResult.match)} badge-sm`}>
                            {genreResult.value}
                        </span>
                    {/each}
                </div>
            {/if}

            <div class="flex flex-wrap gap-2 items-center text-sm">
                <div>
                    <div class="uppercase text-xs opacity-60 mb-1">
                        YEAR
                    </div>
                    <div class={getBadgeClassForMatch(guess.yearResult.match)} title="Release Year">
                        {guess.yearResult.value} {getArrowForMatch(guess.yearResult.match)}
                    </div>
                </div>

                {#if guess.boxOfficeResult}
                    <div>
                        <div class="uppercase text-xs opacity-60 mb-1">
                            Box Office
                        </div>
                        <div class={getBadgeClassForMatch(guess.boxOfficeResult.match)} title="Box Office Revenue">
                            {guess.boxOfficeResult.value} {getArrowForMatch(guess.boxOfficeResult.match)}
                        </div>
                    </div>
                {/if}

                {#if guess.ratingResult}
                    <div>
                        <div class="uppercase text-xs opacity-60 mb-1">
                            Rating
                        </div>
                        <div class={getBadgeClassForMatch(guess.ratingResult.match)} title="Rating Score">
                            {guess.ratingResult.value} {getArrowForMatch(guess.ratingResult.match)}
                        </div>
                    </div>
                {/if}

                {#if guess.ageRatingResult}
                    <div>
                        <div class="uppercase text-xs opacity-60 mb-1">
                            Certification
                        </div>
                        <div class={getBadgeClassForMatch(guess.ageRatingResult.match)} title="Age Rating / Certification">
                            {guess.ageRatingResult.value} {getArrowForMatch(guess.ageRatingResult.match)}
                        </div>
                    </div>
                {/if}
            </div>

            {#if guess.castMembersResult && guess.castMembersResult.length > 0}
                <div class="text-xs uppercase opacity-70 mr-1 mt-1">Cast</div>
                <div class="flex flex-wrap gap-1 items-center" title="Cast">
                    {#each guess.castMembersResult as castResult}
                        <span class={`${getBadgeClassForMatch(castResult.match)} badge-sm`}>{castResult.value}</span>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>