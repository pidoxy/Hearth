import type { ExtractedItem } from "../types";
import { claudeAvailable, extractWithClaude } from "./claude";
import { extractWithFallback } from "./fallback";

export interface ExtractInput {
  text: string | null;
  file: { data: Buffer; mime: string } | null;
  docDate: string; // YYYY-MM-DD in household tz
  timezone: string;
  people: string[];
  subject?: string | null;
  from?: string | null;
}

export interface ExtractResult {
  summary: string | null;
  items: ExtractedItem[];
  extractor: string;
}

export const SUPPORTED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function extract(input: ExtractInput): Promise<ExtractResult> {
  if (claudeAvailable()) {
    try {
      return await extractWithClaude(input);
    } catch (err) {
      // Fall back for text; files can't be read offline.
      if (!input.text) throw err;
      console.error("[extract] Claude failed, using fallback parser:", err);
    }
  } else if (input.file && !input.text) {
    throw new Error("Reading photos and PDFs needs an Anthropic API key (set ANTHROPIC_API_KEY).");
  }
  return extractWithFallback(input);
}
