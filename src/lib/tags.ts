const RAW_TAG_SUGGESTIONS = [
  "Time Travel",
  "Alternate Timeline",
  "Simulation",
  "Space Exploration",
  "Post-Apocalyptic",
  "Survival",
  "Revenge",
  "Courtroom",
  "Court Room",
  "Serial Killer",
  "LGBTQ",
  "Mind Bending",
  "Spy",
  "Plot Twist",
  "Psychological",
  "Tragic",
  "Masterpiece",
];

export function normalizeTagKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

export function formatTagLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export const CUSTOM_TAG_SUGGESTIONS = Array.from(
  new Map(
    RAW_TAG_SUGGESTIONS.map((tag) => [normalizeTagKey(tag), formatTagLabel(tag)])
  ).values()
);
