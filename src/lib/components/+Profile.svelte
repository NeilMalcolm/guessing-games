<script lang="ts">
	import { getBadgeClassForMatch, Match, type CastPropertyResult } from '$lib/types/guess';

	interface ProfileProps {
		castMember: CastPropertyResult;
		success: boolean;
		revealed?: boolean;
	}

	let { castMember, success, revealed = true }: ProfileProps = $props();
</script>

<div class="flex flex-col items-center">
	<div class="avatar">
		<div
			class={`w-15 rounded-full transition-all duration-500 ` +
				(revealed && castMember.match === Match.Exact
					? 'ring-success ring-offset-base-100 ring-2 ring-offset-2'
					: 'opacity-70')}
		>
			<img src={castMember.image} alt={`Profile picture for ${castMember.value}`} />
		</div>
	</div>
	<div>
		<span
			class={'wrap-break-word text-xs transition-colors duration-500 ' +
				(revealed && castMember.match === Match.Exact
					? success
						? 'text-neutral/80'
						: 'text-success'
					: 'opacity-90')}>{castMember.value}</span
		>
	</div>
</div>
