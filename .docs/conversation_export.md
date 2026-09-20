# Movie Guessing Game - Search Implementation Discussion

**User:**
We're facing an issue with the implementation:

The search query can return results which do not have the criteria we need to compare the guess to the target.

The best way to handle this would be remove any such movies from the search result so the user cannot select them.

However, I have looked at the TMDB /search and /discover APIs and neither provide the option to both filter by the title and include additional criteria.

***

**AI:**
You have run into a notorious limitation of the TMDB API: `/search/movie` does not support metric filtering (like revenue or vote count), and `/discover/movie` does not support free-text query searches. 

Since your game evaluates strict metrics like Box Office, Age Rating, and Score, allowing users to select obscure movies or unreleased indie shorts will break the comparison logic. Here are the three best ways to handle this in your SvelteKit/Supabase architecture, ranging from a quick patch to a robust architectural fix.

### 1. The Quick Fix: SvelteKit Post-Filtering
While `/search/movie` doesn't return full details like Box Office or Cast, it *does* return `vote_count` and `popularity` in its basic payload. Obscure movies with low vote counts are almost always the ones missing revenue and age ratings. 

You can filter the search results in your SvelteKit BFF before caching them in Upstash Redis. 

*   **How it works:** When `/api/search` fetches from TMDB, filter the raw results for `vote_count > 100` (or a higher threshold) before trimming the array to your top 8 suggestions. 
*   **Pros:** Very easy to implement in your current `/api/search` route.
*   **Cons:** It's an approximation. A movie might have 500 votes but still be missing box office data, meaning bad data could still slip through.

### 2. The Robust Fix: A Supabase "Valid Guesses" Dictionary
Wordle doesn't let users guess made-up words; it checks against a static dictionary. Movie guessing games usually adopt the same pattern rather than querying an open-ended database of 900,000+ films.

Instead of hitting TMDB live on every search, build a local dictionary of valid movies in Supabase.

*   **How it works:** 
    1. Write a one-off script using `/discover/movie` with strict filters (`vote_count.gte=500`, `revenue.gte=1000000`, etc.) to pull the top 5,000–10,000 most popular movies.
    2. Store these in a new `valid_movies` table in your Supabase PostgreSQL database. 
    3. Update your `/api/search` endpoint to query this Supabase table directly using `ilike` or Full Text Search, instead of proxying to TMDB.
*   **Pros:** Guarantees 100% data integrity for your feedback metrics. It also completely eliminates TMDB latency from your search endpoint.
*   **Cons:** Requires a new table and a script to populate/maintain the data.

### 3. The Fallback: Graceful Rejection on Submit
If you keep the live TMDB search, you must handle the scenario where a user successfully searches for and submits a movie that lacks the required comparison data.

*   **How it works:** When a user submits a guess, your SvelteKit form action in `+page.server.ts` fetches the full TMDB metrics to calculate the feedback. If you detect that `revenue` or `age_rating` is missing or `0`, immediately return an error using SvelteKit's `fail()` function (e.g., "This movie lacks sufficient data to be used as a guess"). 
*   **Rule:** Do not increment the user's `guess_count` or insert a record into the `guesses` table for these rejected attempts.

**Recommendation:** Implement **Option 1** immediately to clean up the search UI, and add **Option 3** as a fail-safe in your form action. If you find that users are still getting frustrated by selecting movies that get rejected upon submission, migrate to **Option 2** for a flawless Wordle-style dictionary.

***

**User:**
1 + 3 seems like a degraded user experience. A good application should never show the user invalid options.

2 is the best option although it poses two problems:

1. We need to start maintaining a list of movies. This includes frequently updating this list in the background.
2. We now have more DB traffic.

***

**AI:**
You are spot on—allowing users to select invalid options and then punishing them for it is a hallmark of a rushed app. Option 2 is how you build a premium, frictionless game, and both of your concerns can be cleanly neutralized using the infrastructure you already have in place.

## 1. Zero-Maintenance Dictionary
You don't actually need to update the list frequently. Wordle's dictionary is entirely static. A one-time snapshot of the top 10,000 most popular movies will cover almost every realistic guess your users attempt. 

If you do want to keep it fresh without manual work, you can piggyback on your existing ingestion architecture:
*   You already utilize a private AWS Lambda function triggered by an AWS EventBridge (CRON) rule. 
*   You can configure a secondary weekly EventBridge trigger for this Lambda to query the TMDB `/movie/popular` endpoint.
*   The Lambda can use your existing Supabase Admin client to bypass Row Level Security and cleanly upsert these new releases into your `valid_movies` table.

## 2. Neutralizing Database Traffic
Moving the search from TMDB to Supabase does not mean your Postgres database takes the hit for every user keystroke. 

You can keep your exact existing search architecture to shield the database:
*   Maintain your Cache-Aside pattern using your Upstash Redis instance.
*   When a user types, your SvelteKit backend continues to check Redis for the `search:movie:[query]` key. 
*   On a cache hit, the suggestions are returned in milliseconds without touching Supabase.
*   On a cache miss, SvelteKit queries your new Supabase `valid_movies` table instead of the TMDB proxy, grabs the top 8 results, and writes them to Redis with your existing 24 to 48 hour TTL.

By utilizing Redis, Supabase only handles the initial unique queries, effectively eliminating any risk of database throttling.