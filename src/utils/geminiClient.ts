/**
 * Gemini client factory — tách riêng để dễ mock trong tests.
 * Đọc VITE_GEMINI_API_KEY và VITE_GEMINI_MODEL từ .env.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

type GeminiModel = ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

function resolveGeminiModelName(modelName?: string): string {
  const trimmed = modelName?.trim();
  if (!trimmed) return DEFAULT_GEMINI_MODEL;

  // Gemini 1.5 Flash is no longer returned by models.list for this API key.
  // Keep older local .env files from breaking every AI feature.
  if (trimmed === "gemini-1.5-flash" || trimmed.startsWith("gemini-1.5-flash-")) {
    console.warn(
      `[geminiClient] Model "${trimmed}" is no longer available for this project. Falling back to ${DEFAULT_GEMINI_MODEL}.`
    );
    return DEFAULT_GEMINI_MODEL;
  }

  return trimmed;
}

/**
 * Trả về Gemini model instance, hoặc null nếu VITE_GEMINI_API_KEY chưa set.
 */
export function createGeminiModel(): GeminiModel | null {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;
  const modelName = resolveGeminiModelName(import.meta.env.VITE_GEMINI_MODEL as string | undefined);
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName });
}
