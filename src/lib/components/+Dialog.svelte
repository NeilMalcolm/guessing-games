<script lang="ts">
	import type { Snippet } from "svelte";

    interface DialogProps {
        title: string,
        bodyText?: string,
        children?: Snippet,
        acceptText?: string,
        closeText?: string,
        open?: boolean;
        acceptAction?: () => void,
        closeAction?: () => void
    }

    let { 
        title, 
        bodyText, 
        children,
        acceptText = "OK", 
        closeText = "Close", 
        open = $bindable(false),
        acceptAction, 
        closeAction
    }: DialogProps = $props();

    let dialog: HTMLDialogElement | undefined = $state();

    $effect(() => {
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        else if (!open && dialog.open) dialog.close();
    });
</script>
<dialog bind:this={dialog}
        onclose={() => {
            open = false;
        }}
        class="modal">
    <div class="modal-box">
        <h3 class="text-2xl font-bold mb-5">{title}</h3>
            {#if children}
                {@render children()}
            {:else if bodyText}
                <p class="py-4">{bodyText}</p>
            {/if}
        <div class="modal-action flex gap-2">
            <button class="btn btn-error" onclick={() => {
                dialog?.close();
                acceptAction?.();
            }}>
                {acceptText}
            </button>
            <button class="btn btn-ghost" onclick={() => {
                dialog?.close();
                closeAction?.();
            }}>
                {closeText}
            </button>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button onclick={() => closeAction?.()}>close</button>
    </form>
</dialog>