<script lang="ts">
    import { debounce } from '$lib/utils/debounce';

    const defaultMinCharacterForSearch = 3;

    let 
    { 
        value = $bindable(''),
        onSearch, 
        onClear,
        minCharacters = defaultMinCharacterForSearch, 
        placeholder = "Search...",
        debounceTime = 300,
        ...props
    } : 
    { 
        value?: string;
        onSearch: (query: string) => void; 
        onClear: () => void;
        minCharacters?: number; 
        placeholder?: string; 
        debounceTime?: number;
    } = $props();

    // svelte-ignore state_referenced_locally
    const debouncedSearch = debounce(() => {
        if (!value || value.length === 0)
        {
            onClear();
            return;
        }

        if (value.length < minCharacters){
            return;
        }

        onSearch(value);
    }, debounceTime);


</script>
<label class="input" 
        {...props}>
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
        type="search"
        class="grow"
        bind:value={value}
        oninput={debouncedSearch}
        placeholder={placeholder}>
</label>