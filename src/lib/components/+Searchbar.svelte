<script lang="ts">
    import { debounce } from '$lib/utils/debounce';
	import type { HTMLInputAttributes } from 'svelte/elements';

    let defaultMinCharacterForSearch = 3;
    let searchBar: HTMLInputElement;

    interface SearchBarParams extends HTMLInputAttributes {
        value?: string;
        onSearch: (query: string) => void; 
        onClear: () => void;
        minCharacters?: number; 
        placeholder?: string; 
        debounceTime?: number;
        enabled?: boolean;
    }

    let 
    { 
        value = $bindable(''),
        onSearch, 
        onClear,
        minCharacters = defaultMinCharacterForSearch, 
        placeholder = "Search...",
        debounceTime = 300,
        enabled = true,
        ...props
    }: SearchBarParams = $props();

    // svelte-ignore state_referenced_locally
    const debouncedSearch = debounce(() => {
        if (!enabled) {
             return;
        }
        if (!value || value.length === 0) {
            onClear();
            return;
        }

        if (value.length < minCharacters) {
            return;
        }

        onSearch(value);
    }, debounceTime);

    function onBlur(): void { 
        if (!searchBar) 
        {
             return;
        }

        searchBar
    }


</script>
<div class="flex flex-1">
    <label class="input flex-1">
        <svg class="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <g stroke-linejoin="round"
                stroke-linecap="round"
                stroke-width="2.5"
                fill="none"
                stroke="currentColor">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
            </g>
        </svg>
        <input name="search" 
            {...props}
            type="search"
            bind:value={value}
            bind:this={searchBar}
            oninput={debouncedSearch}
            onblur={onBlur}
            placeholder={placeholder}>
    </label>
</div>