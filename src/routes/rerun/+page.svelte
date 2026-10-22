<script lang="ts">
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    const filters = [
        { value: 'all', label: 'All' },
        { value: 'unplayed', label: 'Unplayed' },
        { value: 'played', label: 'Played' }
    ] as const;

    let filter = $state<(typeof filters)[number]['value']>('all');

    // Play dates are UTC ISO dates (yyyy-MM-dd), so format/compare in UTC.
    const dayMonthFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    function formatPlayDate(playDate: string): string {
        return playDate === yesterday ? 'Yesterday' : dayMonthFormat.format(new Date(playDate));
    }

    // A day counts as played once the game is won, lost or given up.
    const filteredDays = $derived(
        data.rerunDays.filter((day) => {
            const played = day.status === 'won' || day.status === 'lost' || day.status === 'gave_up';
            return filter === 'all' || (filter === 'played' ? played : !played);
        })
    );
</script>

<section class="mx-auto w-full max-w-2xl p-4">
    <div class="mb-5">
        <div class="gap-1 mb-8">
            <h1 class="prose prose-2xl">Reruns</h1>
            <span class="prose">Play any previous day's game</span>
        </div>
        <div class="join mb-4 flex justify-center" role="radiogroup" aria-label="Filter days">
            {#each filters as f (f.value)}
                <input class="join-item btn" type="radio" name="rerun-filter" aria-label={f.label} value={f.value} bind:group={filter} />
            {/each}
        </div>
    </div>
    <div>
        <ul class="grid grid-cols-3 gap-2 sm:gap-4">
            {#each filteredDays as day (day.playDate)}
                <li>
                    <a href="/{day.playDate}"
                        class="card card-sm transition-transform hover:scale-105
                            {day.status === 'won' ? 'border-2 border-success bg-success' : day.status === 'lost' || day.status === 'gave_up' ? 'border-2 border-error bg-error' : 'bg-base-200'}">
                        <figure class="aspect-2/3 bg-base-300">
                            {#if day.poster}
                                <img src={day.poster} alt="Poster for {day.playDate}" class="h-full w-full object-cover" />
                            {/if}
                        </figure>
                        <div class="card-body items-center p-2 text-center">
                            <time datetime={day.playDate} class="text-xs sm:text-sm">{formatPlayDate(day.playDate)}</time>
                        </div>
                    </a>
                </li>
            {/each}
        </ul>
    </div>
</section>
