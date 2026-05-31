export type SearchEntityType = "movie" | "tv" | "person" | "collection" | "keyword" | "company" | "network";

export type SearchEntity = {
  id: number;
  type: SearchEntityType;
  title: string;
  subtitle?: string | null;
  imagePath?: string | null;
  imageType?: "poster" | "profile";
  year?: string | null;
  rating?: string | null;
  votes?: string | null;
  awards?: string | null;
  popularity?: number | null;
  knownFor?: string[];
  role?: string | null;
};

export type SearchGroup = {
  type: SearchEntityType;
  label: string;
  results: SearchEntity[];
  total: number;
};

export type UniversalSearchResponse = {
  query: string;
  page: number;
  pageSize: number;
  hasMore: boolean;
  groups: SearchGroup[];
  totals: Record<SearchEntityType, number>;
};
