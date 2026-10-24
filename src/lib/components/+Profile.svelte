<script lang="ts">
	import { getBadgeClassForMatch, Match, type CastPropertyResult } from '$lib/types/guess';

	interface ProfileProps {
		castMember: CastPropertyResult;
		success: boolean;
		revealed?: boolean;
	}

	let { castMember, success, revealed = true }: ProfileProps = $props();

    /**
     * Returns the First initial + Last initial if the 
     * @param value
     */
    function getPlaceholderBadge(value: string): string {
        return value
        .replace(/\./g, '')
        .trim()
        .split(/\s+/)
        .map(word => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
</script>

<div
	class={`flex flex-col items-center transition-all duration-500 ${revealed ? 'opacity-100' : 'opacity-0'}`}
	data-testid="profile">
    {#if castMember.image}
	<div class="avatar">
		<div
			class={`w-15 rounded-full transition-all duration-500 ` +
				(revealed && castMember.match === Match.Exact
					? 'ring-success ring-offset-base-100 ring-2 ring-offset-2'
					: 'opacity-70')}>
			<img src={castMember.image} alt={`Profile picture for ${castMember.value}`} />
		</div>
	</div>
    {:else}
	<div class="avatar avatar-placeholder">
        <div class={`w-15 rounded-full bg-neutral text-neutral-content transition-all duration-500 ` +
				(revealed && castMember.match === Match.Exact
					? 'ring-success ring-offset-base-100 ring-2 ring-offset-2'
					: 'opacity-70')}>
            <span class="text-s">{getPlaceholderBadge(castMember.value)}</span>
        </div>
	</div>
    {/if}
	<div>
		<span
			class={'wrap-break-word text-xs transition-colors duration-500 ' +
				(revealed && castMember.match === Match.Exact
					? success
						? 'text-neutral/80'
						: 'text-success'
					: 'opacity-90')}>{castMember.value}
        </span>
	</div>
</div>
