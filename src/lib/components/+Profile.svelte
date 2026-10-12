<script lang="ts">
    import { getBadgeClassForMatch, Match, type CastPropertyResult } from "$lib/types/guess";
    
    interface ProfileProps {
        castMember: CastPropertyResult,
        success: boolean
    }

    let 
    {
        castMember,
        success
    }: ProfileProps = $props();

</script>
<div class="flex flex-col items-center">
    <div class="avatar">
        <div class={castMember.match === Match.Exact ? "ring-success ring-offset-base-100 w-15 rounded-full ring-2 ring-offset-2" : "w-15 rounded-full opacity-70"}>
            <img src={castMember.image} alt={`Profile picture for ${castMember.value}`}/>
        </div>
    </div>
    <div>
        <span class={"wrap-break-word text-xs " + (castMember.match === Match.Exact ? (success ? "text-neutral/80" : "text-success") : "opacity-90")}>{castMember.value}</span>
    </div>
</div>