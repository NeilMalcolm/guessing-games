<script lang="ts">
	import type { PropertyResult } from "$lib/types/guess";
    import { getArrowForMatch, getBgForMatch, getTextColorForMatch } from "$lib/types/guess";
	import type { HTMLAttributes, HTMLBaseAttributes, HTMLParamAttributes } from "svelte/elements";

    interface DataMatchProps extends HTMLBaseAttributes {
        title: string,
        propertyResult: PropertyResult,
        showArrow?: boolean,
        animate: boolean,
        success: boolean
    }

    let { 
        title,
        propertyResult,
        showArrow = true,
        animate = false,
        success = false,
        ...props
    }: DataMatchProps = $props();

</script>
<div class={`${props.class ?? ''} ${animate ? 'animate-(--animate-flip-in)' : ''} [backface-visibility:hidden] flex flex-col items-center pt-2 pb-2 pl-9 pr-9 justify-center rounded-md ` + (getBgForMatch(propertyResult.match, success))} title="{title}">
    <div class={"uppercase text-xs font-semibold opacity-60 opacity-70 mb-1 " + (getTextColorForMatch(propertyResult.match))}>
        {title}
    </div>
    <div class={"text-xl opacity-90 font-semibold " + (getTextColorForMatch(propertyResult.match))}>
        {propertyResult.value} {#if showArrow}<span class="opacity-70">{getArrowForMatch(propertyResult.match)}</span>{/if}
    </div>
</div>