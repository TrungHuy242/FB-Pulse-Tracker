/**
 * Rule-based Sentiment Analysis for Vietnamese Facebook comments.
 *
 * Phương pháp: lexicon scoring + emoji weighting.
 * Không cần API bên ngoài — chạy hoàn toàn client-side.
 *
 * Score range: -1.0 (very negative) → +1.0 (very positive)
 * Threshold: score >= 0.15 → positive, score <= -0.15 → negative, else neutral.
 */

export type Sentiment = "positive" | "neutral" | "negative";

export interface SentimentResult {
  sentiment: Sentiment;
  score: number; // -1.0 to +1.0
}

// ── Positive signals ─────────────────────────────────────────────────────────

const POSITIVE_EMOJIS = new Set([
  // Include both with and without variation selectors (U+FE0F)
  "❤️","❤","😍","🥰","😊","😄","😁","🥳","🎉","🎊","👍","💪","🙌","👏","✨","💯",
  "🔥","💚","💙","💛","🧡","💜","😂","🤣","☺️","☺","😌","😏","🤩","😎",
  "🌟","⭐","💫","🌈","🎶","🎵","🏆","🥇","👑","💎","💰","❣️","❣","💕","💞",
  "💓","💗","💖","💝","🤗","🥹","😇","🤑","😋","😉","😃","😀","🤭",
]);

const NEGATIVE_EMOJIS = new Set([
  "😢","😭","😞","😔","😟","😠","😡","🤬","💔","😤","😣","😖","😩","😫",
  "🙁","☹️","😓","😰","😨","😱","🤮","🤢","😒","🙄","😾","👎","💀","☠️",
  "😈","👿","😗","🥺","😬","😑","😐","🤦","🤷","🫠","😮‍💨","😤","🫤",
]);

const POSITIVE_WORDS_VI: Record<string, number> = {
  "tốt": 0.6, "tuyệt": 0.8, "tuyệt vời": 1.0, "đẹp": 0.6, "hay": 0.5,
  "thích": 0.6, "yêu": 0.8, "cảm ơn": 0.7, "hữu ích": 0.6, "chất": 0.6,
  "xuất sắc": 0.9, "tốt lắm": 0.8, "ổn": 0.3, "ok": 0.2, "oke": 0.2,
  "được": 0.3, "hay quá": 0.8, "đẹp quá": 0.8, "tuyệt quá": 0.9,
  "chuẩn": 0.5, "pro": 0.6, "đỉnh": 0.7, "xịn": 0.6, "ngon": 0.6,
  "ủng hộ": 0.7, "tiếp tục": 0.4, "cố lên": 0.5, "bravo": 0.7,
  "haha": 0.3, "hihi": 0.3, "hohoho": 0.3, "huhu": -0.2,
  "chất lượng": 0.6, "đáng": 0.4, "xứng đáng": 0.5, "phù hợp": 0.3,
  "thành công": 0.6, "giỏi": 0.6, "tài": 0.5, "sáng tạo": 0.5,
  "thú vị": 0.5, "vui": 0.6, "hạnh phúc": 0.7, "cực kỳ": 0.3,
  "rất hay": 0.8, "rất đẹp": 0.8, "rất tốt": 0.8, "siêu": 0.7,
};

const NEGATIVE_WORDS_VI: Record<string, number> = {
  "tệ": -0.7, "xấu": -0.5, "kém": -0.6, "dở": -0.6, "thất vọng": -0.8,
  "chán": -0.5, "ghét": -0.8, "tức": -0.6, "giận": -0.6, "bực": -0.5,
  "lừa đảo": -1.0, "scam": -1.0, "spam": -0.7, "rác": -0.6,
  "không tốt": -0.6, "không hay": -0.5, "không đẹp": -0.5,
  "khó chịu": -0.6, "phiền": -0.5, "chậm": -0.4, "trễ": -0.4,
  "sai": -0.5, "lỗi": -0.4, "hỏng": -0.6, "vô dụng": -0.8,
  "quá tệ": -0.9, "quá kém": -0.9, "thật tệ": -0.9,
  "không được": -0.5, "không ổn": -0.5, "không chất": -0.5,
  "mất tiền": -0.7, "phí": -0.4, "lãng phí": -0.5,
  "buồn": -0.5, "đau": -0.5, "khóc": -0.6,
};

const POSITIVE_WORDS_EN: Record<string, number> = {
  "good": 0.6, "great": 0.8, "excellent": 0.9, "amazing": 0.9,
  "awesome": 0.8, "love": 0.8, "like": 0.4, "beautiful": 0.7,
  "nice": 0.5, "perfect": 0.9, "wonderful": 0.8, "fantastic": 0.8,
  "thanks": 0.5, "thank": 0.5, "helpful": 0.6, "best": 0.7,
  "cool": 0.5, "interesting": 0.4, "useful": 0.5, "happy": 0.7,
};

const NEGATIVE_WORDS_EN: Record<string, number> = {
  "bad": -0.7, "terrible": -0.9, "awful": -0.9, "hate": -0.8,
  "worst": -0.9, "poor": -0.6, "wrong": -0.5, "broken": -0.6,
  "useless": -0.7, "waste": -0.6, "scam": -1.0, "spam": -0.7,
  "boring": -0.5, "ugly": -0.6, "slow": -0.4, "fake": -0.7,
  "disappointed": -0.8, "frustrating": -0.7, "annoying": -0.6,
};

// Negation words that flip the next word's score
const NEGATIONS = new Set([
  "không", "chẳng", "chả", "đừng", "chưa", "chả",
  "not", "no", "never", "neither", "nor",
]);

/** Classify a single comment text. */
export function classifySentiment(text: string): SentimentResult {
  if (!text || !text.trim()) return { sentiment: "neutral", score: 0 };

  let score = 0;
  let signals = 0;

  // 1. Emoji scoring
  for (const ch of text) {
    const emojiStr = ch;
    if (POSITIVE_EMOJIS.has(emojiStr)) { score += 0.4; signals++; }
    if (NEGATIVE_EMOJIS.has(emojiStr)) { score -= 0.4; signals++; }
  }
  // Multi-char emojis
  const emojiMatches = text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]/gu) ?? [];
  for (const em of emojiMatches) {
    if (POSITIVE_EMOJIS.has(em)) { score += 0.3; signals++; }
    if (NEGATIVE_EMOJIS.has(em)) { score -= 0.3; signals++; }
  }

  // 2. Word lexicon scoring
  const lower = text.toLowerCase();
  const words = lower.split(/[\s,!?.;:。]+/).filter(Boolean);
  let negationActive = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (NEGATIONS.has(word)) {
      negationActive = true;
      continue;
    }

    // Check 2-word phrases first
    const phrase = i < words.length - 1 ? `${word} ${words[i + 1]}` : null;
    let wordScore = 0;

    if (phrase && (POSITIVE_WORDS_VI[phrase] != null || NEGATIVE_WORDS_VI[phrase] != null)) {
      wordScore = (POSITIVE_WORDS_VI[phrase] ?? 0) + (NEGATIVE_WORDS_VI[phrase] ?? 0);
      i++; // skip next word, consumed as phrase
    } else {
      wordScore = (POSITIVE_WORDS_VI[word] ?? 0)
        + (NEGATIVE_WORDS_VI[word] ?? 0)
        + (POSITIVE_WORDS_EN[word] ?? 0)
        + (NEGATIVE_WORDS_EN[word] ?? 0);
    }

    if (wordScore !== 0) {
      score += negationActive ? -wordScore : wordScore;
      signals++;
      negationActive = false;
    } else {
      // Negation carries over only to the immediate next content word
      negationActive = false;
    }
  }

  // Normalise score: avoid wild values, cap at ±1
  const normalised = signals > 0 ? Math.max(-1, Math.min(1, score / signals)) : 0;

  let sentiment: Sentiment;
  if (normalised >= 0.12) sentiment = "positive";
  else if (normalised <= -0.12) sentiment = "negative";
  else sentiment = "neutral";

  return { sentiment, score: normalised };
}

export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

/** Compute distribution over an array of comment strings. */
export function computeSentimentDistribution(
  texts: string[]
): SentimentDistribution {
  let positive = 0;
  let neutral = 0;
  let negative = 0;

  for (const text of texts) {
    const { sentiment } = classifySentiment(text);
    if (sentiment === "positive") positive++;
    else if (sentiment === "negative") negative++;
    else neutral++;
  }

  return { positive, neutral, negative, total: texts.length };
}
