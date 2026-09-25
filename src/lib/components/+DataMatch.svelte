<script lang="ts">
	import type { PropertyResult } from "$lib/types/guess";
    import { getArrowForMatch, getBgForMatch, getTextColorForMatch } from "$lib/types/guess";

    interface DataMatchProps {
        title: string,
        propertyResult: PropertyResult,
        showArrow?: Boolean
    }

    let { 
        title,
        propertyResult,
        showArrow = true
    }: DataMatchProps = $props();

</script>
<div class={"flex flex-col items-center pt-2 pb-2 pl-9 pr-9 justify-center rounded-md " + (getBgForMatch(propertyResult.match))} title="Release Year">
    <div class={"uppercase text-xs opacity-20 text-neutral opacity-70 mb-1 " + (getTextColorForMatch(propertyResult.match))}>
        {title}
    </div>
    <div class={"text-xl text-neutral opacity-90 font-semibold " + (getTextColorForMatch(propertyResult.match))}>
        {propertyResult.value} {#if showArrow}<span class="opacity-70">{getArrowForMatch(propertyResult.match)}</span>{/if}
    </div>
</div>