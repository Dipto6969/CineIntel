# CineIntel Project Roadmap

This document outlines the roadmap and timeline for building the CineIntel Personal Media Operating System.

---

## Phase 0: Planning & Architecture (Current)
* **Goal**: Establish architectural definitions, database schema mapping, and API interface plans.
* **Deliverables**:
  - `docs/architecture.md`
  - `docs/database.md`
  - `docs/roadmap.md`
  - `docs/api.md`
  - `docs/ui-guidelines.md`
  - `FEATURE_FLAGS.md`

## Phase 1: Project Setup & Core Configuration
* **Goal**: Prepare environment variables, initialize styling systems, and build layout wrappers.
* **Deliverables**:
  - `.env.example` setup
  - Global Next.js app configuration and directory structure setup
  - Custom Tailwind CSS v4 variables setup for the glassmorphic dark design system

## Phase 2: Supabase Authentication
* **Goal**: Enable user authentication so that inventory tracking is secure.
* **Deliverables**:
  - Email/Password Signup & Sign-in
  - OAuth setup guidelines (Google, GitHub)
  - Auth context provider and Protected Routes helper middleware

## Phase 3: TMDb Search Wrapper & Local Caching
* **Goal**: Set up Next.js API Routes proxying queries to TMDb and automatically register metadata of movies into the local PostgreSQL cache.
* **Deliverables**:
  - TMDb client wrapper class
  - `/api/search` proxy route
  - `/api/media/register` caching mechanism (inserts to `media_items` table)

## Phase 4: Media Inventory System
* **Goal**: Allow users to add titles to watch lists, add custom tags, rates, log watch dates (rewatches).
* **Deliverables**:
  - Inventory management controls (Watch status, Rating Slider/Stars, Watch dates log, Notes/Reviews, Favorite flag)
  - Custom Tag management interface (assigning custom tags like `slow-burn` or `mind-bending`)

## Phase 5: Detail Pages
* **Goal**: Visual detailing of individual movies, series, or documentaries.
* **Deliverables**:
  - Rich glassmorphic background backdrops
  - Media specs (Cast, Crew, Studios, Alternative Titles, Rating benchmarks)
  - Dynamic user-centric workspace (user's diary, lists featuring this item, tags, recommendations)

## Phase 6: Google-like Advanced Power Search
* **Goal**: Implement CineIntel's most important differentiator: power query parsing.
* **Deliverables**:
  - AST Parser for search queries (e.g. `genre:thriller rating>8`)
  - Full-Text Search integration on the `media_items` table
  - Advanced dynamic filtering dashboard with toggles, sliders, and query inputs

## Phase 7: Personal Lists & Collections
* **Goal**: Enable custom watchlists, collection curating, and sharing options.
* **Deliverables**:
  - Custom collection creator
  - Reorderable list cards (sort orders, custom notes per entry)
  - Public share pages for collections (read-only views bypassing Auth)

## Phase 8: Analytics Dashboard
* **Goal**: Build an addictive visual analytics workspace summarizing user's media consumption habits.
* **Deliverables**:
  - Metrics cards: Total watch hours, total movies, average rating
  - Recharts integration: Heatmaps, pie charts of genres/languages, monthly watch distributions, top actor/director/studio frequency
  - "Wrapped" style review cards for yearly summaries

## Phase 9: Recommendation Engine
* **Goal**: Provide automated discovery sections on the homepage.
* **Deliverables**:
  - "Hidden Gems" list (high ratings + low popularity)
  - "Underrated Thrillers" (tailored to liked genres)
  - Taste matching based on top-rated actors/directors in inventory

## Phase 10: Performance Optimization & UI Polish
* **Goal**: Optimize navigation speed, accessibility, and animations.
* **Deliverables**:
  - Next.js 16 `unstable_instant` navigation configuration for sub-second page transitions
  - Responsive validation across Mobile, Tablet, and Desktop screen sizes
