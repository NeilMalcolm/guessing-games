<script lang="ts">
	import type { UsedHint } from "$lib/types/guess";
	import { HINT_TYPE_KEYWORDS, HINT_TYPE_POSTER, HINT_TYPE_TAGLINE } from "$lib/types/supabasetables";
	import Dialog from "./+Dialog.svelte";

    interface HintProps {
        hint: UsedHint;
        showPosterModal: boolean;
    }

    let { 
        hint, 
        showPosterModal = $bindable(),
         ...props 
    }: HintProps = $props();

	function openPosterHint() {
		showPosterModal = true;
	}
</script>
{#if hint.hintType === HINT_TYPE_TAGLINE}
    <div class="bg-base-200/60 rounded-box px-4 py-3 text-center italic">
        "{hint.value as string}"
    </div>
{:else if hint.hintType === HINT_TYPE_KEYWORDS}
    <div class="bg-base-200/60 rounded-box px-4 py-3 flex flex-wrap justify-center gap-2">
        {#each (hint.value as string[]) as keyword}
            <span class="badge badge-soft text-base-content/70   p-3">{keyword}</span>
        {/each}
    </div>
{:else if hint.hintType === HINT_TYPE_POSTER}
    <div>
        <div class="flex justify-center py-1">
            <button
                type="button"
                class="btn btn-outline btn-sm"
                onclick={openPosterHint}>
                View Poster
            </button>
        </div>
        <Dialog
            title="Poster"
            acceptText={null}
            closeText={null}
            bind:open={showPosterModal}>
            {#if hint.value}
                <img
                    src={hint.value as string}
                    alt="Pixelated poster"
                    class="w-96 max-w-full h-auto mx-auto"
                    style="image-rendering: pixelated"
                />
            {/if}
        </Dialog>
    </div>
{/if}