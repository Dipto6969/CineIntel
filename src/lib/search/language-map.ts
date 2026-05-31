const LANGUAGE_MAP: Record<string, string> = {
  english: "en",
  korean: "ko",
  japanese: "ja",
  hindi: "hi",
  bengali: "bn",
  bangla: "bn",
  french: "fr",
  spanish: "es",
  german: "de",
  italian: "it",
  portuguese: "pt",
  russian: "ru",
  chinese: "zh",
  mandarin: "zh",
  thai: "th",
  turkish: "tr",
  arabic: "ar",
};

export function toLanguageCode(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return LANGUAGE_MAP[normalized] || normalized;
}
