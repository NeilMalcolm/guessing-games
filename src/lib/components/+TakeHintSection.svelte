<script lang="ts">
	import type { AvailableHints, UsedHint } from "$lib/types/guess";
	import Dialog from "./+Dialog.svelte";

    interface TakeHintSectionProps {
        availableHints?: AvailableHints;
        usedHints?: UsedHint[];
        onHintButtonClick: () => void;
        getInDisplayTextFormat: (hint: string) => void;
        takeHint: (hint: string) => void;
        showChooseHintModal: boolean;
    }

    let {
        availableHints,
        usedHints,
        onHintButtonClick,
        showChooseHintModal = $bindable(),
        getInDisplayTextFormat,
        takeHint
    } : TakeHintSectionProps = $props();


</script>
<div class="flex flex items-center p-3">
    <p class="flex-grow text-base-content/60">You have unlocked {(availableHints?.unusedHintsCount ?? 0) > 1 ? 'hints' : 'a hint'}.</p>
    <button class="btn"  
            onclick={onHintButtonClick}>Get Hint</button>
    
    <Dialog title="Need a Hint?"
            acceptText={null}
            closeText="No Thanks"
            bind:open={showChooseHintModal}>
            <p class="text-base-content/60">Choose from the following hint options:</p> 
            <div class="flex flex-row items-center gap-3 mt-4">
                {#each (availableHints?.hints ?? []) as hint}
                    <button class="btn btn-outline {usedHints?.some(x => x.hintType === hint) ? "disabled" : ""} flex-grow"
                            disabled={usedHints?.some(x => x.hintType === hint)} 
                            onclick={() => takeHint(hint)}>
                        {getInDisplayTextFormat(hint)}
                    </button>
                {/each}
            </div>
    </Dialog>
</div>