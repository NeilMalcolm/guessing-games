<script lang="ts">
	import type { GuessResponse, TargetMovie } from '$lib/types/guess';
	import { formatShareText, getResultRows } from '$lib/utils/resultSquares';

	const copyResultsTimeoutMs: number = 2000;

	interface ResultsModalProps {
		open: boolean;
		guesses: GuessResponse[];
		won: boolean;
		playDate: string;
		targetMovie: TargetMovie | null | undefined
	}

	let { open = $bindable(false), guesses, won, playDate, targetMovie }: ResultsModalProps = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let copied = $state(false);

	const rows = $derived(getResultRows(guesses));

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	async function copyResults() {
		await navigator.clipboard.writeText(formatShareText(guesses, playDate));
		copied = true;
		setTimeout(() => (copied = false), copyResultsTimeoutMs);
	}
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
	<div class="modal-box text-center flex flex-col gap-4">
		<div>
			<h2 class="text-2xl font-bold mb-1">{won ? 'You got it!' : 'Better luck next time'}</h2>
			The movie was <span class="font-semibold">{targetMovie?.title}</span>
		</div>
		<div class="bg-base-300 rounded-box pt-2 pb-3">
			<p class="opacity-70 mb-4">
				You took {guesses.length} {guesses.length === 1 ? 'guess' : 'guesses'}
			</p>

			<ol class="text-2xl leading-relaxed mb-4" aria-label="Your guesses">
				{#each rows as row, i}
					<li class="whitespace-nowrap text-xs">
						{row}
					</li>
				{/each}
			</ol>
			<div class="modal-action justify-center">
				<button class="btn btn-primary" onclick={copyResults}>
					{copied ? 'Copied!' : 'Copy results'}
				</button>
			</div>
		</div>

		{#if targetMovie?.videoUrl}
		<div class="rounded-box">
			<iframe width="100%" 
					height="280" 
					src={targetMovie.videoUrl} 
					title="Embed videos and playlists" 
					frameborder="0" 
					class="rounded-box"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
					referrerpolicy="strict-origin-when-cross-origin" 
					allowfullscreen></iframe>

		</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close">close</button>
	</form>
</dialog>

