<script lang="ts">
    import { onMount } from 'svelte';

    let lightMode: boolean = $state(false);

    // Sync the toggle with whatever the inline script in app.html already applied
    onMount(() => {
        lightMode = document.documentElement.getAttribute('data-theme') === 'light';
    });

    function onLightDarkModeToggled(): void {
        lightMode = !lightMode;
        const theme = lightMode ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }
</script>
<div class="navbar bg-base-100 shadow-sm">

  <div class="flex-none">
    <button class="btn btn-square btn-ghost" aria-label="Hamburger Menu">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block h-5 w-5 stroke-current"> 
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path> 
        </svg>
    </button>
  </div>

  <a class="link link-hover text-xl font-semibold flex-1" href="/">Guessing Game</a>

   <div class="flex-none">
    <span class="mr-2">{lightMode ? "Light" : "Dark"} Mode</span>
    <input type="checkbox" checked={lightMode} onchange={onLightDarkModeToggled} class="toggle" />
  </div>
</div>