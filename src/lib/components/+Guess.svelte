<script module lang="ts">
	export const LONGEST_DATA_MATCH_DELAY_MS: number = 1300;
	export const SUCCESS_BACKGROUND_DELAY_MS: number = 1600;
</script>

<script lang="ts">
	import { getBadgeClassForMatch, getTextColorForMatch, type GuessResponse } from '$lib/types/guess';
	import DataMatch from './+DataMatch.svelte';
	import Profile from './+Profile.svelte';
	import { untrack } from 'svelte';

	interface GuessProps {
		guess: GuessResponse;
		index: Number;
		animate?: boolean;
		delay?: number;
		onRevealFinished?: () => void;
	}

	let { 
        guess, 
        index,
         animate = false, 
         delay, 
         onRevealFinished, 
         ...props 
    }: GuessProps = $props();

	function getSchedule() {
		const genresCount = guess.genresResult ? guess.genresResult.length : 0;
		const castCount = guess.castMembersResult ? guess.castMembersResult.length : 0;

		const genreStep = 300;
		const dataMatchStep = 400;
		const directorStep = 500;
		const castStep = 250;
		const cardSuccessStep = 600;

		const genresEnd = genresCount > 0 ? 150 + (genresCount - 1) * genreStep : 0;
		const dataMatchStart = genresCount > 0 ? genresEnd + 350 : 150;
		const lastDataMatchDelay = dataMatchStart + dataMatchStep * 3;
		const directorDelay = lastDataMatchDelay + directorStep;
		const lastCastDelay = directorDelay + 300 + Math.max(0, castCount - 1) * castStep;
		const normalFinalSuccess = lastCastDelay + cardSuccessStep;

		const scale = delay !== undefined ? delay / normalFinalSuccess : 1;

		return {
			genreDelay: (i: number) => Math.round((150 + i * genreStep) * scale),
			yearDelay: Math.round(dataMatchStart * scale),
			boxOfficeDelay: Math.round((dataMatchStart + dataMatchStep) * scale),
			ratingDelay: Math.round((dataMatchStart + dataMatchStep * 2) * scale),
			certDelay: Math.round((dataMatchStart + dataMatchStep * 3) * scale),
			directorDelay: Math.round(directorDelay * scale),
			castDelay: (i: number) => Math.round((directorDelay + 300 + i * castStep) * scale),
			finalSuccessDelay: delay !== undefined ? delay : normalFinalSuccess
		};
	}

	const schedule = $derived(getSchedule());

	let revealedGenres = $state(
		untrack(() =>
			!animate
				? (guess.genresResult ?? []).map(() => true)
				: (guess.genresResult ?? []).map(() => false)
		)
	);
	let isDirectorRevealed = $state(untrack(() => !animate));
	let revealedCast = $state(
		untrack(() =>
			!animate
				? (guess.castMembersResult ?? []).map(() => true)
				: (guess.castMembersResult ?? []).map(() => false)
		)
	);
	let isSuccessBg = $state(untrack(() => !animate && guess.isCorrect));

	$effect(() => {
		const genresCount = guess.genresResult ? guess.genresResult.length : 0;
		const castCount = guess.castMembersResult ? guess.castMembersResult.length : 0;

		if (!animate) {
			revealedGenres = Array(genresCount).fill(true);
			isDirectorRevealed = true;
			revealedCast = Array(castCount).fill(true);
			isSuccessBg = guess.isCorrect;
			return;
		}

		revealedGenres = Array(genresCount).fill(false);
		isDirectorRevealed = false;
		revealedCast = Array(castCount).fill(false);
		isSuccessBg = false;

		const timers: ReturnType<typeof setTimeout>[] = [];

		// 1. Reveal genres one-by-one first
		for (let i = 0; i < genresCount; i++) {
			const d = schedule.genreDelay(i);
			timers.push(
				setTimeout(() => {
					revealedGenres[i] = true;
				}, d)
			);
		}

		// 2. DataMatch rows reveal one-by-one next via DataMatch delay props

		// 3. Reveal Director next
		timers.push(
			setTimeout(() => {
				isDirectorRevealed = true;
			}, schedule.directorDelay)
		);

		// 4. Reveal Cast one-by-one last
		for (let i = 0; i < castCount; i++) {
			const d = schedule.castDelay(i);
			timers.push(
				setTimeout(() => {
					revealedCast[i] = true;
				}, d)
			);
		}

		// 5. Update background colour of Guess card at the end for win state
		timers.push(
			setTimeout(() => {
				if (guess.isCorrect) {
					isSuccessBg = true;
				}
				onRevealFinished?.();
			}, schedule.finalSuccessDelay)
		); 

		return () => {
			timers.forEach(clearTimeout);
		};
	});
</script>

<div
	class="card {isSuccessBg
		? 'bg-success'
		: 'bg-base-200'} transition-colors duration-500 shadow-md mb-3 overflow-hidden"
	data-testid="guess-tile"
>
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
					<h3 class="font-bold text-2xl truncate {isSuccessBg ? 'text-neutral/90' : ''}">
						{guess.title}
					</h3>
				</div>
				{#if guess.genresResult && guess.genresResult.length > 0}
					<div class="flex flex-wrap gap-1 items-center mb-3" title="Genres">
						{#each guess.genresResult as genreResult, i}
							<span
								class={`badge-s pl-4 pr-4 pt-3 pb-4 transition-all duration-500 ${revealedGenres[i] ? 'opacity-100' : 'opacity-0'} ${getTextColorForMatch(genreResult.match)} ${getBadgeClassForMatch(genreResult.match, isSuccessBg)}`}
							>
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
							delay={schedule.yearDelay}
						/>
					{/if}

					{#if guess.boxOfficeResult}
						<DataMatch
							title="Box Office"
							propertyResult={guess.boxOfficeResult}
							{animate}
							success={isSuccessBg}
							delay={schedule.boxOfficeDelay}
						/>
					{/if}

					{#if guess.ratingResult}
						<DataMatch
							title="Rating"
							propertyResult={guess.ratingResult}
							{animate}
							success={isSuccessBg}
							delay={schedule.ratingDelay}
						/>
					{/if}

					{#if guess.ageRatingResult}
						<DataMatch
							title="Certification"
							propertyResult={guess.ageRatingResult}
							showArrow={false}
							{animate}
							success={isSuccessBg}
							delay={schedule.certDelay}
						/>
					{/if}
				</div>
			</div>
		</div>

		<div class="flex items-start justify-center pl-3 pr-3 pb-5">
			{#if guess.directorResult}
				<div class="flex flex-col gap-3">
					<div class="text-xs uppercase mt-1 {isSuccessBg ? 'text-neutral/60' : 'opacity-70'}">
						Director
					</div>
					<div class="flex flex-wrap gap-1 items-center" title="Director">
						<Profile
							castMember={guess.directorResult}
							success={isSuccessBg}
							revealed={isDirectorRevealed}
						/>
					</div>
				</div>
			{/if}
			<div class="mt-10 mb-5 divider divider-horizontal"></div>
			{#if guess.castMembersResult && guess.castMembersResult.length > 0}
				<div class="flex flex-col gap-3">
					<div class="text-xs uppercase mt-1 {isSuccessBg ? 'text-neutral/60' : 'opacity-70'}">
						Cast
					</div>
					<div class="flex flex-wrap gap-2 items-center" title="Cast">
						{#each guess.castMembersResult as castResult, i}
							<Profile castMember={castResult} success={isSuccessBg} revealed={revealedCast[i]} />
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
