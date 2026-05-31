# Filter Logic Reference

This document maps the current filtering logic in the app, where each filter is parsed, and where it is applied.

## Search Flow

Universal search is driven by the search page and the API route:

- [src/app/search/page.tsx](src/app/search/page.tsx)
- [src/app/api/search/universal/route.ts](src/app/api/search/universal/route.ts)
- [src/lib/search/filter-schema.ts](src/lib/search/filter-schema.ts)
- [src/lib/search/query-parser.ts](src/lib/search/query-parser.ts)
- [src/lib/search/language-map.ts](src/lib/search/language-map.ts)

The basic flow is:

1. The UI stores filter state in `FilterState`.
2. The search page requires a single content type before search can run.
3. The search page serializes the filters into URL params.
4. The universal search API reads the params and decides whether to use TMDb search or TMDb discover.
5. The API applies additional local filtering where TMDb alone is not enough.

## Inventory Flow

Inventory filtering is separate and runs on the client against cached local inventory data.

- [src/app/inventory/page.tsx](src/app/inventory/page.tsx)
- [src/app/api/inventory/route.ts](src/app/api/inventory/route.ts)
- [src/lib/search/filter-schema.ts](src/lib/search/filter-schema.ts)
- [src/lib/search/query-parser.ts](src/lib/search/query-parser.ts)

The inventory page filters watched titles using local `media_item` fields such as genres, languages, countries, cast, directors, studios, runtime, and rating.

## Shared Filter Schema

The shared filter model is defined in:

- [src/lib/search/filter-schema.ts](src/lib/search/filter-schema.ts)

Key fields:

- `query` for text search and advanced syntax input
- `contentType` for the required universal search media mode
- `types` for movie/tv selection
- `genres` for genre filters
- `yearMin`, `yearMax`, `decade`
- `language`
- `countries`
- `runtimeMin`, `runtimeMax`
- `imdbMin`, `tmdbMin`
- `releaseStatus`
- `tvSubtype`
- `sort`
- `director`, `actor`, `studio`, `keywords`, `franchise`
- `awardsOnly`
- `personalRatingMin`
- `favoritesOnly`
- `inventorySort`

This file also contains:

- `parseFiltersFromParams`
- `serializeFiltersToParams`
- `normalizeGenres`
- `normalizeFilterState`

For the universal search page, `contentType` is the required selector and the other filters act as AND-combined criteria.

## Advanced Query Parser

Advanced query syntax is parsed in:

- [src/lib/search/query-parser.ts](src/lib/search/query-parser.ts)

Supported clause forms:

- `director:nolan`
- `actor:jake`
- `studio:A24`
- `genre:thriller`
- `keyword:time travel`
- `franchise:MCU`
- `language:korean`
- `country:South Korea`
- `rating>8`
- `year>2015`

The parser currently:

- tokenizes quoted and unquoted input
- extracts field clauses
- stores join operators (`AND`, `OR`)
- stores negation markers (`NOT`, `-`)

Important note:

- The parser records boolean intent, but the search page now treats advanced clauses as part of the required filter set rather than as a standalone search mode.
- The universal search route still uses local detail checks for filters that TMDb cannot express directly.

## Universal Search Backend Logic

The main filtering logic for universal media search is in:

- [src/app/api/search/universal/route.ts](src/app/api/search/universal/route.ts)

### What the API uses as its basis

The route reads query params and builds a `FilterState`.

If `contentType` is provided, the route uses it to resolve the base media types and preset constraints for Anime, Documentary, and Mini-series searches.

Then it decides between:

- TMDb search endpoints when the request is mostly text-driven
- TMDb discover endpoints when filters are active

### TMDb-based fields

These filters are pushed into TMDb discover params when possible:

- Genres -> `with_genres`
- Language -> `with_original_language`
- Year range / decade -> `primary_release_date_gte`, `primary_release_date_lte`, `first_air_date_gte`, `first_air_date_lte`
- Runtime -> `with_runtime_gte`, `with_runtime_lte`
- Sort -> `sort_by`

### Local post-filtering

The API also applies local checks after TMDb returns results:

- release status
- TV mini-series subtype
- runtime constraints
- production country match
- franchise membership
- text query match when filters are active
- IMDb rating / awards after OMDb enrichment

### Current limitation

Some advanced filters still require local post-processing after TMDb returns results:

- director
- actor
- studio
- keyword
- franchise text matching beyond collection membership

Those filters are evaluated consistently, but they still depend on TMDb detail fetches and parser-derived clauses.

These are the main reasons filter behavior can feel partial or inconsistent.

## Search UI Logic

The search page controls the filter UI and submission flow:

- [src/app/search/page.tsx](src/app/search/page.tsx)

This file handles:

- persistent left sidebar filters
- applying filters via the `Apply Filters` button
- URL synchronization for shareable search state
- mandatory content-type selection before search runs
- active filter chips above the result list
- validation messages when the content type or additional criteria are missing
- rendering search groups
- hiding non-movie/tv groups in the UI

## Inventory UI Logic

The inventory page controls local filtering and sorting:

- [src/app/inventory/page.tsx](src/app/inventory/page.tsx)

This file handles:

- compact top filter bar
- advanced filter drawer
- local filtering of inventory records
- sorting by inventory-specific modes
- pagination for the full inventory view

## TMDb Service Layer

TMDb helper functions are defined in:

- [src/services/tmdb.ts](src/services/tmdb.ts)

Important helpers:

- `searchMovies`
- `searchTV`
- `discoverMovies`
- `discoverTV`
- `getMovieDetails`
- `getTVDetails`
- `getExternalIds`

These helpers determine what the app can ask TMDb for directly and what must be filtered later in the app.

## Media Metadata Types

Genre and media type mappings are defined in:

- [src/types/media.ts](src/types/media.ts)

Important parts:

- `MediaType`
- `TMDbSearchResult`
- `TMDbMovieDetail`
- `TMDbTVDetail`
- `GENRE_MAP`

`GENRE_MAP` is the source of truth for genre labels used by the app.

## Summary of What Works Where

### Search page

- Content type selector: yes, required
- Genre filters: yes, through TMDb discover
- Language filters: yes, original language only
- Country filters: yes, via detail metadata
- Year / decade: yes
- Runtime: yes, with discover plus detail checks
- TMDb rating: yes
- IMDb rating / awards: partial, via OMDb enrichment
- Advanced parser clauses: partial
- Boolean logic in clauses: not fully implemented

### Inventory page

- Type filters: yes
- Genre filters: yes
- Language filters: yes
- Country filters: yes
- Year / decade: yes
- Runtime: yes
- Personal rating: yes
- Favorites: yes
- Inventory sorting: yes
- Advanced parser clauses: partial
- Boolean logic in clauses: not fully implemented

## Files to Review First When Changing Filters

If you want to change filter behavior, start here:

1. [src/lib/search/filter-schema.ts](src/lib/search/filter-schema.ts)
2. [src/lib/search/query-parser.ts](src/lib/search/query-parser.ts)
3. [src/app/api/search/universal/route.ts](src/app/api/search/universal/route.ts)
4. [src/app/search/page.tsx](src/app/search/page.tsx)
5. [src/app/inventory/page.tsx](src/app/inventory/page.tsx)
6. [src/services/tmdb.ts](src/services/tmdb.ts)
7. [src/types/media.ts](src/types/media.ts)

## Practical Note

If a filter appears in the UI but does not behave as expected, the issue is usually one of these:

- the filter is parsed but not applied in the backend
- the filter is applied only on the client inventory page, not the universal search API
- TMDb does not expose the exact matching field directly, so the app has to approximate it with local checks
- boolean parser intent is present, but the logic is still treated like simple filter merging
