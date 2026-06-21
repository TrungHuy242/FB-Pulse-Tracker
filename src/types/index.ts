import type { Timestamp } from "firebase/firestore";

export interface ImportRecord {
  id: string;
  accountName: string;
  commentsCount: number;
  reactionsCount: number;
  totalFiles: number;
  status: "processing" | "completed";
  importedAt: Timestamp;
}

export interface CommentItem {
  id?: string;
  authorName: string;
  content: string;
  commentTime: number; // Unix timestamp (seconds)
  title: string;
  postUrl?: string; // URL of the Facebook post
  group: string;
  intent?: string;
  intentConfidence?: "high" | "medium" | "low";
}

export interface ReactionItem {
  id?: string;
  reaction: string;
  linkPost: string;
  commentAuthorName: string;
  ownerName: string;
  reactionTime: number; // Unix timestamp (seconds)
  fbid: string;
  accountName?: string;
}

export interface AllowedAccount {
  id: string;
  email: string;
  displayName: string;
  role: 0 | 1; // 0 = read-only, 1 = admin
}

export interface ChunkDocument<T> {
  index: number;
  items: T[];
  count: number;
}

export interface StatsFilter {
  from?: Date;
  to?: Date;
  name?: string | string[];
  minLikes?: number;
  minComments?: number;
}
