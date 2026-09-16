# Movie Guessing Game 🎬

A daily, Wordle-style movie-guessing web application built with **SvelteKit**, **Supabase**, **Upstash Redis**, and **AWS Lambda**.

Players are presented with a hidden daily movie and have up to 10 attempts to guess it. Each guess provides detailed visual feedback across multiple movie attributes (Release Year, Box Office, Genres, Cast, Crew, Ratings) with directional indicators (↑/↓) and proximity indicators (e.g., box office within $100M).

---

## 🎯 Project Goals & Features

- **Frictionless Entry**: Anonymous user sessions created instantly on page load (`signInAnonymously()`), allowing users to play immediately without initial registration.
- **Progress Preservation**: Frictionless account conversion via Supabase OAuth linking (`linkIdentity()`) to permanently retain play statistics across devices.
- **Daily & Rewatch Modes**:
  - **Daily Mode**: A single global movie updated every day at 00:00 UK time.
  - **Rewatch Mode**: Dynamic routing (`/play/[date]`) allowing users to revisit and play previous days' games.
- **Comprehensive Feedback Engine**:
  - Color-coded matching (Green = exact match, Yellow = close match, e.g., Box Office within $100M).
  - Directional arrows (↑/↓) for numeric attributes: Release Year, Box Office Revenue, and TMDB Score (X/100).
  - Attributes compared: Genres, Release Year, Revenue, Age Rating, Score, Studio, Director, Lead Actor(s), and Supporting Cast.
- **Unlockable Hint System**:
  - Unlocks optional hints after the 6th and 9th failed guesses (Plot Keywords, Tagline, Cast Member, Director's Other Works, or Franchise Info).
- **High-Performance Search Autocomplete**: Sub-millisecond title search powered by Upstash Redis read-through caching, minimizing TMDB API consumption.

---

## 🏗️ Architecture & Tech Stack

```
                                  +-------------------+
                                  |    TMDB API       |
                                  +---------+---------+
                                            ^
                                            | (Cron Fetch / Search Fallback)
+-------------------+             +---------+---------+             +-------------------+
|   Client Browser  | <=========> |   SvelteKit BFF   | <=========> |   Upstash Redis   |
| (Svelte 5 Runes)  |  (HTTP/SSR) |  (Vercel Hosted)  | (Cache-Aside| (Search Autocomplete|
+-------------------+             +---------+---------+  Lookups)   |     48h TTL)      |
                                            |                       +-------------------+
                                            | (Auth / Session / Guesses)
                                            v
                                  +---------+---------+
                                  | Supabase Postgres |
                                  |  (RLS Enabled)    |
                                  +---------+---------+
                                            ^
                                            | (Daily Ingest 23:50 UK Time)
                                  +---------+---------+
                                  | AWS Lambda CRON   |
                                  | (EventBridge Rule)|
                                  +-------------------+
```

### Stack Components

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend & BFF** | **SvelteKit** (Svelte 5 Runes, SvelteUI) | SSR application, UI components, API routes, and Server Form Actions. |
| **Hosting** | **Vercel** | Edge network deployment for SvelteKit. |
| **Database & Auth** | **Supabase** (PostgreSQL + Auth SSR) | Relational data store with Row-Level Security (RLS) & anonymous session handling. |
| **Search Cache** | **Upstash Redis** | Serverless in-memory cache for search autocomplete queries (Cache-Aside pattern). |
| **Data Ingestion** | **AWS Lambda** + **EventBridge** | Scheduled CRON job running daily at 23:50 UK time to ingest TMDB target movies. |
| **Catalog Source** | **TMDB API** (The Movie Database) | External source for movie metadata, search, and clues. |
| **Observability** | **Sentry** + **Axiom** | Error tracking & distributed APM (Sentry) and consolidated log analytics (Axiom). |

---

## 📊 Database Schema (Supabase PostgreSQL)

The relational schema enforces data integrity, numerical comparison capabilities, and Row-Level Security.

### 1. `movies` Table
Stores daily target movies and extracted numerical metrics for comparison logic.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | Primary Key, Identity | Internal movie identifier. |
| `date` | `DATE` | `UNIQUE`, `NOT NULL` | Game date driving Daily & Rewatch modes. |
| `title` | `TEXT` | `NOT NULL` | Canonical movie title. |
| `release_year` | `SMALLINT` | `NOT NULL` | Year released (for ↑/↓ evaluation). |
| `box_office` | `BIGINT` | `NOT NULL` | Box office revenue in USD (for ↑/↓ and $100M threshold). |
| `score` | `SMALLINT` | `NOT NULL` | Rating score out of 100 (for ↑/↓ evaluation). |
| `age_rating` | `TEXT` | `NOT NULL` | Certification rating (e.g., '12A', '15', 'PG-13'). |
| `studio` | `TEXT` | `NOT NULL` | Primary production studio. |
| `metadata` | `JSONB` | `NOT NULL` | JSON object containing arrays for Genres, Director, Cast, and Hints. |

### 2. `game_sessions` Table
Acts as the state machine for each player's daily attempt.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Unique session identifier. |
| `user_id` | `UUID` | `NOT NULL`, FK (`auth.users`) | Links to Supabase anonymous or OAuth user. |
| `movie_id` | `INT` | `NOT NULL`, FK (`movies.id`) | Reference to the target daily movie. |
| `date` | `DATE` | `NOT NULL` | Date of the game session. |
| `status` | `TEXT` | Default `'playing'` | State: `'playing'`, `'won'`, or `'lost'`. |
| `guess_count` | `SMALLINT` | Default `0` | Number of guesses submitted (max 10). |

- **Table Constraint**: `UNIQUE(user_id, date)` prevents multiple session creation per day.
- **Security**: Row-Level Security (RLS) ensures players can only read/write their own session records.

### 3. `guesses` Table
Stores chronological guess history and evaluated metric snapshots.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | Primary Key, Identity | Unique guess record identifier. |
| `session_id` | `UUID` | `NOT NULL`, FK (`game_sessions.id`) | Parent session reference. |
| `movie_title` | `TEXT` | `NOT NULL` | Title of the guessed movie. |
| `metrics` | `JSONB` | `NOT NULL` | Snapshot of calculated comparison results (colors, arrows). |
| `created_at` | `TIMESTAMPTZ` | Default `now()` | Timestamp for chronological sequence rendering. |

---

## ⚡ Core Workflows & API Endpoints

### 1. Search Autocomplete (`GET /api/search?q={term}`)
Employs a **Cache-Aside pattern** to eliminate excessive TMDB API hits:
1. SvelteKit checks Upstash Redis for key `search:movie:{normalized_query}`.
2. **Cache Hit**: Returns cached JSON array of results in milliseconds with header `X-Cache: HIT`.
3. **Cache Miss**: Queries TMDB `/3/search/movie` API, normalizes the top 8 items (`id`, `title`, `release_year`, `poster_path`), saves payload to Redis with a 48-hour TTL, and returns response (`X-Cache: MISS`).

### 2. Guess Submission (`POST` Form Action in `+page.server.ts`)
1. Resolves player identity from Supabase server session (`locals.safeGetSession()`).
2. Validates session status (`guess_count < 10` and `status == 'playing'`).
3. Fetches metrics for the guessed movie ID from TMDB (or cached lookup).
4. Compares metrics against target movie row in Supabase:
   - Evaluates exact matches (Genres, Studio, Director, Cast).
   - Calculates numeric direction (↑/↓) for Release Year, Box Office, Score.
   - Evaluates closeness flag (`isClose: true` for Box Office within $100M).
5. Writes guess snapshot to `guesses` table and increments `guess_count` in `game_sessions`.
6. Evaluates game outcome: transitions status to `'won'` (all match) or `'lost'` (10 failed attempts reached).

### 3. Automated Ingestion (AWS Lambda)
1. Triggered daily at **23:50 UK time** by an AWS EventBridge Scheduler rule.
2. Selects a curated/popular movie from TMDB API and pulls complete metadata.
3. Inserts row into Supabase `movies` table using Supabase Admin key (`SUPABASE_SERVICE_ROLE_KEY`), bypassing RLS.
4. Ready before the **00:00 UK time** reset.

---

## 🔑 Environment Variables

Create a `.env` file in the project root:

```env
# SvelteKit Public Client Config
PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"

# Supabase Server Side (Private)
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# Upstash Redis Config
UPSTASH_REDIS_REST_URL="https://your-database.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-rest-token"

# TMDB API Access
TMDB_API_READ_ACCESS_TOKEN="your-tmdb-bearer-token"

# Sentry & Axiom Telemetry (Optional)
SENTRY_DSN="https://your-sentry-dsn"
AXIOM_TOKEN="your-axiom-token"
AXIOM_DATASET="your-axiom-dataset-name"
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ or v20+)
- npm / pnpm / yarn
- A Supabase Project
- An Upstash Redis Instance
- A TMDB API Developer Account

### 1. Repository Setup & Dependencies
```bash
# Clone the repository
git clone https://github.com/your-username/movie-guessing-game.git
cd movie-guessing-game

# Install dependencies
npm install
```

### 2. Supabase Database Initialization
Open the **SQL Editor** in your Supabase Dashboard and run the initial migration:

```sql
-- Create movies table
CREATE TABLE public.movies (
  id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE UNIQUE NOT NULL,
  title TEXT NOT NULL,
  release_year SMALLINT NOT NULL,
  box_office BIGINT NOT NULL,
  score SMALLINT NOT NULL,
  age_rating TEXT NOT NULL,
  studio TEXT NOT NULL,
  metadata JSONB NOT NULL
);

-- Create game_sessions table
CREATE TABLE public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id INT NOT NULL REFERENCES public.movies(id),
  date DATE NOT NULL,
  status TEXT DEFAULT 'playing' CHECK (status IN ('playing', 'won', 'lost')),
  guess_count SMALLINT DEFAULT 0,
  CONSTRAINT unique_user_daily_session UNIQUE (user_id, date)
);

-- Create guesses table
CREATE TABLE public.guesses (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  movie_title TEXT NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to movies" ON public.movies FOR SELECT USING (true);

CREATE POLICY "Users can manage their own game sessions" ON public.game_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own guesses" ON public.guesses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.game_sessions
      WHERE game_sessions.id = guesses.session_id
      AND game_sessions.user_id = auth.uid()
    )
  );
```

### 3. Run Development Server
```bash
npm run dev
```
Navigate to `http://localhost:5173` to verify the application.

---

## 🔭 Observability & Monitoring

- **Sentry**: Integrates via `@sentry/sveltekit` to capture client-side runtime errors and server-side API trace spans.
- **Axiom**: Receives server-side structured JSON logs via Vercel Log Drains and AWS Lambda telemetry extension.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
