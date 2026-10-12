<script lang="ts">
	import type { GuessResponse } from '$lib/types/guess';
	import { formatShareText, getResultRows } from '$lib/utils/resultSquares';

	const copyResultsTimeoutMs: number = 2000;

	interface ResultsModalProps {
		open: boolean;
		guesses: GuessResponse[];
		won: boolean;
		playDate: string;
	}

	let { open = $bindable(false), guesses, won, playDate }: ResultsModalProps = $props();

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
	<div class="modal-box text-center">
		<h2 class="text-2xl font-bold mb-1">{won ? 'You got it!' : 'Better luck next time'}</h2>
		<p class="opacity-70 mb-4">
			{guesses.length} {guesses.length === 1 ? 'guess' : 'guesses'}
		</p>

		<ol class="text-2xl leading-relaxed mb-4" aria-label="Your guesses">
			{#each rows as row, i}
				<li class="whitespace-nowrap">
					{row}
				</li>
			{/each}
		</ol>

		<div class="modal-action justify-center">
			<button class="btn btn-primary" onclick={copyResults}>
				{copied ? 'Copied!' : 'Copy results'}
			</button>
			<form method="dialog">
				<button class="btn">Close</button>
			</form>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close">close</button>
	</form>
</dialog>

