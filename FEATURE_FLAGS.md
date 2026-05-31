# CineIntel Feature Flags

This document tracks active feature toggles and their development status.

| Feature Flag | Default State | Phase | Description |
| :--- | :---: | :---: | :--- |
| `NEXT_PUBLIC_ENABLE_OAUTH` | `false` | Phase 2 | Enables Google and GitHub login via Supabase. |
| `NEXT_PUBLIC_ENABLE_MEILISEARCH` | `false` | Phase 6 | Transition from local PostgreSQL Full-Text Search to Meilisearch for typo-tolerant filtering. |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | `false` | Phase 8 | Enables PostHog/Plausible analytics tracking. |
| `NEXT_PUBLIC_ENABLE_AI_RECOMMENDATIONS` | `false` | Phase 13 | Enables AI-driven taste recommendations based on user tags and ratings. |
