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
    <label for="page-drawer" class="btn btn-square btn-ghost" aria-label="Hamburger Menu">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block h-5 w-5 stroke-current"> 
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path> 
        </svg>
    </label>
  </div>

  <a class="link link-hover text-xl font-semibold flex-1" href="/">Guessing Game</a>

   <div class="flex-none">
    <span class="mr-2">{lightMode ? "Light" : "Dark"} Mode</span>
    <input type="checkbox" checked={lightMode} onchange={onLightDarkModeToggled} class="toggle" />
  </div>
</div>

<div class="drawer">
  <input id="page-drawer" type="checkbox" class="drawer-toggle" />
  <div class="drawer-side">
    <label for="page-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
    <ul class="menu bg-base-200 min-h-full w-80 p-4">
        <li>
            <a href="/rerun">
                <div>
                    <h1 class="prose prose-xl">Reruns</h1>
                    <span class="text-base-content/60">Play any previous day's game</span>
                </div>
            </a>
        </li>
    </ul>
  </div>
</div>