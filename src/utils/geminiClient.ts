/**
 * Gemini client factory — tách riêng để dễ mock trong tests.
 * Đọc VITE_GEMINI_API_KEY và VITE_GEMINI_MODEL từ .env.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

type GeminiModel = ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

/**
 * Trả về Gemini model instance, hoặc null nếu VITE_GEMINI_API_KEY chưa set.
 */
export function createGeminiModel(): GeminiModel | null {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;
  const modelName =
    (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? "gemini-2.0-flash";
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName });
}
