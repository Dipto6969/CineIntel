# CineIntel Database Schema

This document details the PostgreSQL schema designed for Supabase. It includes definitions for local tables, full-text search config, indexes, and Row-Level Security (RLS) rules.

---

## Database Schema (DDL)

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'en-US'
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-access to profiles"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Allow users to update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Media Items Table (Metadata Cache)
CREATE TABLE public.media_items (
  id TEXT PRIMARY KEY, -- Format: '{tmdb_id}_{media_type}' e.g., '12345_movie'
  tmdb_id INTEGER NOT NULL,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('movie', 'tv', 'documentary', 'short', 'web_series')),
  title TEXT NOT NULL,
  original_title TEXT,
  alternative_titles JSONB DEFAULT '[]'::jsonb, -- Multilingual aliases
  release_date DATE,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  genres TEXT[] DEFAULT '{}'::text[],
  languages TEXT[] DEFAULT '{}'::text[],
  countries TEXT[] DEFAULT '{}'::text[],
  runtime INTEGER, -- in minutes
  popularity NUMERIC,
  vote_average NUMERIC,
  cast_list TEXT[] DEFAULT '{}'::text[], -- Top 10 actors/actresses
  directors TEXT[] DEFAULT '{}'::text[],
  studios TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  fts_tsvector TSVECTOR -- Full-text search vector
);

-- Full-Text Search Trigger for Media Items
CREATE OR REPLACE FUNCTION media_items_fts_trigger() RETURNS trigger AS $$
BEGIN
  new.fts_tsvector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.original_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.overview, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.alternative_titles::text, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(new.directors, ' ')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(new.cast_list, ' ')), 'C');
  RETURN new;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_items_fts
  BEFORE INSERT OR UPDATE ON public.media_items
  FOR EACH ROW EXECUTE FUNCTION media_items_fts_trigger();

-- Create Indexes for Media Items
CREATE INDEX idx_media_items_fts ON public.media_items USING GIN (fts_tsvector);
CREATE INDEX idx_media_items_genres ON public.media_items USING GIN (genres);


-- 3. User Inventory Table
CREATE TABLE public.user_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  media_item_id TEXT REFERENCES public.media_items(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'dropped', 'on_hold', 'plan_to_watch')),
  rating NUMERIC CHECK (rating >= 0 AND rating <= 10), -- Personal Rating
  watch_dates DATE[] DEFAULT '{}'::date[], -- Support for rewatches (array of dates)
  rewatch_count INTEGER DEFAULT 0 NOT NULL,
  notes TEXT,
  review TEXT,
  language_watched_in VARCHAR(10) DEFAULT 'en',
  is_favorite BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, media_item_id)
);

-- Enable RLS for User Inventory
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read their own inventory"
  ON public.user_inventory FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow users to manage their own inventory"
  ON public.user_inventory FOR ALL USING (auth.uid() = user_id);


-- 4. Custom Tags Table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, name)
);

-- Enable RLS for Tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage their own tags"
  ON public.tags FOR ALL USING (auth.uid() = user_id);


-- 5. Inventory Tags Junction Table
CREATE TABLE public.inventory_tags (
  inventory_id UUID REFERENCES public.user_inventory(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (inventory_id, tag_id)
);

-- Enable RLS for Inventory Tags
ALTER TABLE public.inventory_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage their own inventory tags"
  ON public.inventory_tags FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_inventory
      WHERE id = inventory_tags.inventory_id AND user_id = auth.uid()
    )
  );


-- 6. Lists Table
CREATE TABLE public.lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Lists
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to public lists"
  ON public.lists FOR SELECT USING (is_private = false OR auth.uid() = user_id);

CREATE POLICY "Allow users to manage their own lists"
  ON public.lists FOR ALL USING (auth.uid() = user_id);


-- 7. List Items Table
CREATE TABLE public.list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE NOT NULL,
  media_item_id TEXT REFERENCES public.media_items(id) ON DELETE CASCADE NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for List Items
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow access to list items based on parent list visibility"
  ON public.list_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE id = list_items.list_id AND (is_private = false OR user_id = auth.uid())
    )
  );

CREATE POLICY "Allow users to manage items in their own lists"
  ON public.list_items FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE id = list_items.list_id AND user_id = auth.uid()
    )
  );
```
