# CineIntel API Specifications

This document defines the API endpoints and integration specifications used within CineIntel.

---

## 1. TMDB API Integration

We integrate with the following TMDb v3 endpoints. All requests use the Authorization header with a Read Access Token: `Authorization: Bearer <TMDB_READ_ACCESS_TOKEN>`.

* **Universal Search**: `/3/search/multi` (searches movies, TV series, etc. simultaneously)
* **Movie Detail**: `/3/movie/{movie_id}?append_to_response=credits,alternative_titles,watch/providers`
* **TV Detail**: `/3/tv/{tv_id}?append_to_response=credits,alternative_titles,watch/providers`
* **Trending Content**: `/3/trending/all/day` and `/3/trending/all/week`
* **Recommendations**: `/3/movie/{movie_id}/recommendations` and `/3/tv/{tv_id}/recommendations`

---

## 2. Next.js API Routes (BFF - Backend-For-Frontend)

To keep API keys secure and structure data payloads, we implement proxy endpoints under `src/app/api/`.

### 2.1 Search & Discovery

#### `GET /api/search`
Proxies search requests directly to TMDb.
* **Query Parameters**:
  - `q`: Search query string
  - `page`: Page index (default: 1)
  - `type`: Optional filter (`movie` or `tv`)
* **Response**: Simplified TMDB search payload.

#### `GET /api/trending`
Retrieves daily or weekly trending titles.
* **Query Parameters**:
  - `timeWindow`: `day` or `week` (default: `day`)
* **Response**: List of trending items.

---

### 2.2 Media Management & Caching

#### `POST /api/media/register`
Saves or updates movie metadata in the local PostgreSQL database cache (`media_items` table). Called whenever a user tracks or rates a movie.
* **Request Body**:
  - `tmdbId`: TMDb ID
  - `mediaType`: `'movie'` or `'tv'`
* **Backend logic**:
  1. Checks if the item is already cached in `media_items` table.
  2. If not, fetches full details (credits, alternative titles, etc.) from TMDB.
  3. Formats and writes the item into `media_items`, building the search `tsvector`.
* **Response**: The registered/cached `media_item` record.

---

### 2.3 User Inventory

These routes interact with the `user_inventory` table. Since they require user authentication, they parse the bearer token via Supabase server-side client helpers.

#### `GET /api/inventory`
Lists all media items tracked by the authenticated user.
* **Response**: Array of tracked items containing status, personal rating, watch dates, tags, and cached title/poster.

#### `POST /api/inventory`
Adds a media item to the user's inventory. Automatically triggers `POST /api/media/register` to cache metadata first.
* **Request Body**:
  - `mediaItemId`: String (`{tmdb_id}_{media_type}`)
  - `status`: `'completed' | 'dropped' | 'on_hold' | 'plan_to_watch'`
  - `rating`: Optional number (0-10)
  - `watchDates`: Optional array of date strings
* **Response**: The new inventory record.

#### `PATCH /api/inventory/[id]`
Updates tracking details (rating, review, watch status, favorite flag, rewatch logs).
* **Request Body**: Fields to update.
* **Response**: The updated record.

#### `DELETE /api/inventory/[id]`
Removes the item from the user's inventory.

---

### 2.4 Custom Tags

#### `GET /api/tags`
Retrieves all tags created by the authenticated user.

#### `POST /api/tags`
Creates a new custom tag.
* **Request Body**: `{ name: string }`

---

### 2.5 Power Search Engine

#### `POST /api/search/power`
Executes custom advanced search syntax.
* **Request Body**: `{ query: string }` (e.g. `genre:thriller language:korean rating>8`)
* **Backend logic**:
  1. Lex/parse the query to build filter AST.
  2. Map field queries (e.g. `genre`) and text clauses into dynamic SQL filters.
  3. Query local database `media_items` tables joined with user inventory data.
* **Response**: Matching filtered media list.
