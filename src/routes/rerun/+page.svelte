<script lang="ts">
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
</script>

<section class="mx-auto w-full max-w-2xl p-4">
    <ul class="grid grid-cols-3 gap-2 sm:gap-4">
        {#each data.rerunDays as day (day.playDate)}
            <li>
                <a href="/{day.playDate}"
                    class="card card-sm transition-transform hover:scale-105
                        {day.status === 'won' ? 'border-2 border-success bg-success' : day.status === 'lost' ? 'border-2 border-error bg-error' : 'bg-base-200'}">
                    <figure class="aspect-2/3 bg-base-300">
                        {#if day.poster}
                            <img src={day.poster} alt="Poster for {day.playDate}" class="h-full w-full object-cover" />
                        {/if}
                    </figure>
                    <div class="card-body items-center p-2 text-center">
                        <time datetime={day.playDate} class="text-xs sm:text-sm">{day.playDate}</time>
                    </div>
                </a>
            </li>
        {/each}
    </ul>
</section>
