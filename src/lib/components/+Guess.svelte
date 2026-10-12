<script module lang="ts">
	export const LONGEST_DATA_MATCH_DELAY_MS: number = 1300;
	export const SUCCESS_BACKGROUND_DELAY_MS: number = 1600;
</script>

<script lang="ts">
	import { getArrowForMatch, getBadgeClassForMatch, type GuessResponse } from '$lib/types/guess';
	import DataMatch from './+DataMatch.svelte';
	import Profile from './+Profile.svelte';
	import { untrack } from 'svelte';

	interface GuessProps {
		guess: GuessResponse;
		index: Number;
		animate?: boolean;
		delay?: number;
	}

	let { 
        guess, 
        index, 
        animate = false, 
        delay, 
        ...props 
    }: GuessProps = $props();

	let isSuccessBg = $state(untrack(() => !animate && guess.isCorrect));

	$effect(() => {
		if (!guess.isCorrect) {
			isSuccessBg = false;
			return;
		}

		if (!animate) {
			isSuccessBg = true;
			return;
		}

		isSuccessBg = false;
		const delayMs = delay ?? SUCCESS_BACKGROUND_DELAY_MS + 500;
		const timer = setTimeout(() => {
			isSuccessBg = true;
		}, delayMs);

		return () => clearTimeout(timer);
	});
</script>

<div
	class="card {isSuccessBg
		? 'bg-success'
		: 'bg-base-300'} transition-colors duration-500 shadow-md mb-3 overflow-hidden"
	data-testid="guess-tile">
	<div>
		<div class="flex flex-1 p-5 gap-4 justify-stretch shrink-0">
			{#if guess.image}
				<figure class="w-34 self-stretch shrink-0 overflow-hidden rounded-md">
					<img
						src={guess.image}
						alt={`Poster for ${guess.title}`}
						class="w-full h-full object-cover"
					/>
				</figure>
			{/if}

			<div class="flex-1 min-w-0">
				<div class="flex items-center mb-2">
					<h3 class="font-bold text-2xl truncate {isSuccessBg ? "text-neutral/90" : ""}">{guess.title}</h3>
				</div>
				{#if guess.genresResult && guess.genresResult.length > 0}
					<div class="flex flex-wrap gap-1 items-center mb-3" title="Genres">
						{#each guess.genresResult as genreResult}
							<span class={`${getBadgeClassForMatch(genreResult.match, isSuccessBg)} badge-s`}>
								{genreResult.value}
							</span>
						{/each}
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-2">
					{#if guess.yearResult}
						<DataMatch
							title="Year"
							propertyResult={guess.yearResult}
							{animate}
                            success={isSuccessBg}
							class="[animation-delay:150ms]"
						/>
					{/if}

					{#if guess.boxOfficeResult}
						<DataMatch
							title="Box Office"
							propertyResult={guess.boxOfficeResult}
							{animate}
                            success={isSuccessBg}
							class="[animation-delay:600ms]"
						/>
					{/if}

					{#if guess.ratingResult}
						<DataMatch
							title="Rating"
							propertyResult={guess.ratingResult}
							{animate}
                            success={isSuccessBg}
							class="[animation-delay:900ms]"
						/>
					{/if}

					{#if guess.ageRatingResult}
						<DataMatch
							title="Certification"
							propertyResult={guess.ageRatingResult}
							showArrow={false}
							{animate}
                            success={isSuccessBg}
							class="[animation-delay:1300ms]"
						/>
					{/if}
				</div>
			</div>
		</div>

		<div class="flex items-start justify-center pl-3 pr-3 pb-5">
			{#if guess.directorResult}
				<div class="flex flex-col gap-3">
					<div class="text-xs uppercase mt-1 {isSuccessBg ? "text-neutral/60" : "opacity-70"}">Director</div>
					<div class="flex flex-wrap gap-1 items-center" title="Director">
						<Profile castMember={guess.directorResult}
                                 success={isSuccessBg} />
					</div>
				</div>
			{/if}
			<div class="mt-10 mb-5 divider divider-horizontal"></div>
			{#if guess.castMembersResult && guess.castMembersResult.length > 0}
				<div class="flex flex-col gap-3">
					<div class="text-xs uppercase mt-1 {isSuccessBg ? "text-neutral/60" : "opacity-70"}">Cast</div>
					<div class="flex flex-wrap gap-2 items-center" title="Cast">
						{#each guess.castMembersResult as castResult}
							<Profile castMember={castResult}
                                     success={isSuccessBg} />
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
