import type { FilterState } from "@/lib/search/filter-schema";

export type QueryClause = {
  field: string;
  operator: ":" | ">" | "<" | ">=" | "<=";
  value: string;
  join: "and" | "or";
  negated: boolean;
};

function tokenize(input: string) {
  const regex = /"([^"]+)"|(\S+)/g;
  const tokens: string[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(input))) {
    tokens.push(match[1] || match[2]);
  }
  return tokens;
}

export function parseAdvancedQuery(input: string) {
  const tokens = tokenize(input);
  const clauses: QueryClause[] = [];
  let join: "and" | "or" = "and";

  tokens.forEach((raw) => {
    const upper = raw.toUpperCase();
    if (upper === "OR") {
      join = "or";
      return;
    }
    if (upper === "AND") {
      join = "and";
      return;
    }

    let token = raw;
    let negated = false;
    if (token.startsWith("-")) {
      negated = true;
      token = token.slice(1);
    }
    if (token.toUpperCase() === "NOT") {
      negated = true;
      return;
    }

    const match = token.match(/^(\w+)(:|>=|<=|>|<)(.+)$/);
    if (!match) return;
    const [, field, operator, value] = match;

    clauses.push({
      field: field.toLowerCase(),
      operator: operator as QueryClause["operator"],
      value: value.trim(),
      join,
      negated,
    });
    join = "and";
  });

  const cleaned = tokens.filter((token) => !token.match(/^(\w+)(:|>=|<=|>|<).+$/)).join(" ");

  return { text: cleaned.trim(), clauses };
}

export function applyQueryClauses(filters: FilterState, clauses: QueryClause[]) {
  const next = { ...filters };

  clauses.forEach((clause) => {
    const value = clause.value;
    switch (clause.field) {
      case "director":
        next.director = [...new Set([...next.director, value])];
        break;
      case "actor":
      case "cast":
        next.actor = [...new Set([...next.actor, value])];
        break;
      case "studio":
      case "company":
        next.studio = [...new Set([...next.studio, value])];
        break;
      case "genre":
        next.genres = [...new Set([...next.genres, value])];
        break;
      case "keyword":
        next.keywords = [...new Set([...next.keywords, value])];
        break;
      case "franchise":
      case "collection":
        next.franchise = [...new Set([...next.franchise, value])];
        break;
      case "language":
        next.language = value;
        break;
      case "country":
        next.countries = [...new Set([...next.countries, value])];
        break;
      case "rating":
        if (clause.operator.includes(">")) {
          next.tmdbMin = Number(value);
        }
        break;
      case "imdb":
        if (clause.operator.includes(">")) {
          next.imdbMin = Number(value);
        }
        break;
      case "year":
        if (clause.operator.includes(">")) {
          next.yearMin = Number(value);
        } else if (clause.operator.includes("<")) {
          next.yearMax = Number(value);
        } else {
          const yearValue = Number(value);
          if (Number.isFinite(yearValue)) {
            next.yearMin = yearValue;
            next.yearMax = yearValue;
          }
        }
        break;
      default:
        break;
    }
  });

  return next;
}

export function evaluateAdvancedClauses(
  clauses: QueryClause[],
  matchesClause: (clause: QueryClause) => boolean
) {
  if (clauses.length === 0) return true;

  const groups: QueryClause[][] = [];
  let current: QueryClause[] = [];

  clauses.forEach((clause, index) => {
    if (index > 0 && clause.join === "or") {
      groups.push(current);
      current = [clause];
      return;
    }

    current.push(clause);
  });

  if (current.length > 0) groups.push(current);

  return groups.some((group) =>
    group.every((clause) => {
      const matched = matchesClause(clause);
      return clause.negated ? !matched : matched;
    })
  );
}
