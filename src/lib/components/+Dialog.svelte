<script lang="ts">
    interface DialogProps {
        id: string,
        title: string,
        bodyText: string,
        acceptText: string,
        closeText: string,
        show?: boolean;
        acceptAction?: () => void,
        closeAction?: () => void
    }

    let { 
        title, 
        bodyText, 
        acceptText = "OK", 
        closeText = "Close", 
        show = $bindable(false),
        acceptAction, 
        closeAction
    }: DialogProps = $props();

    let dialog: HTMLDialogElement | undefined = $state();

    $effect(() => {
        if (!dialog) return;
        if (show && !dialog.open) dialog.showModal();
        else if (!show && dialog.open) dialog.close();
    });
</script>
<dialog bind:this={dialog}
        onclose={() => {
            show = false;
        }}
        class="modal">
    <div class="modal-box">
        <h3 class="text-lg font-bold">{title}</h3>
        <p class="py-4">{bodyText}</p>
        <div class="modal-action">
        <button class="btn" onclick={() => acceptAction?.()}>{acceptText}</button>
            <button class="btn" onclick={() => {
                dialog?.close();
                closeAction?.();
            }}>{closeText}</button>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button onclick={() => closeAction?.()}>close</button>
    </form>
</dialog>