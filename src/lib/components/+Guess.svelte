<script lang="ts">
	import { Match, type GuessResponse } from "$lib/types/guess";

    let {
         guess, 
         ...props 
    } 
    : {
         guess: 
         GuessResponse 
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
<div class="card card-side bg-base-200 shadow-md mb-3 p-3 gap-4 items-center">
    {#if guess.image}
        <figure class="w-16 h-24 flex-shrink-0 overflow-hidden rounded-md">
            <img src={guess.image} alt={`Poster for ${guess.title}`} class="w-full h-full object-cover" />
        </figure>
    {/if}

    <div class="flex-1 flex flex-col gap-2">
        <div class="flex items-center justify-between">
            <h3 class="font-bold text-lg">{guess.title}</h3>
        </div>

        <div class="flex flex-wrap gap-2 items-center text-sm">
            <div class={getBadgeClassForMatch(guess.yearResult.match)} title="Release Year">
                {guess.yearResult.value} {getArrowForMatch(guess.yearResult.match)}
            </div>

            {#if guess.boxOfficeResult}
                <div class={getBadgeClassForMatch(guess.boxOfficeResult.match)} title="Box Office Revenue">
                    Box Office: {guess.boxOfficeResult.value} {getArrowForMatch(guess.boxOfficeResult.match)}
                </div>
            {/if}

            {#if guess.ratingResult}
                <div class={getBadgeClassForMatch(guess.ratingResult.match)} title="Rating Score">
                    Rating: {guess.ratingResult.value} {getArrowForMatch(guess.ratingResult.match)}
                </div>
            {/if}

            {#if guess.ageRatingResult}
                <div class={getBadgeClassForMatch(guess.ageRatingResult.match)} title="Age Rating / Certification">
                    Cert: {guess.ageRatingResult.value} {getArrowForMatch(guess.ageRatingResult.match)}
                </div>
            {/if}
        </div>

        {#if guess.genresResult && guess.genresResult.length > 0}
            <div class="flex flex-wrap gap-1 items-center" title="Genres">
                {#each guess.genresResult as genreResult}
                    <span class={`${getBadgeClassForMatch(genreResult.match)} badge-sm`}>{genreResult.value}</span>
                {/each}
            </div>
        {/if}

        {#if guess.castMembersResult && guess.castMembersResult.length > 0}
            <div class="text-xs uppercase opacity-70 mr-1">Cast</div>
            <div class="flex flex-wrap gap-1 items-center" title="Cast">
                {#each guess.castMembersResult as castResult}
                    <span class={`${getBadgeClassForMatch(castResult.match)} badge-sm`}>{castResult.value}</span>
                {/each}
            </div>
        {/if}
    </div>
</div>