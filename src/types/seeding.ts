/**
 * Seeding Manager Types
 */

export type SeedingCategory =
  | "tìm khóa học"
  | "tìm trung tâm"
  | "tìm lớp"
  | "tìm gia sư"
  | "học online"
  | "hỏi tài liệu"
  | "hỏi app/web"
  | "hỏi HSK"
  | "hỏi kinh nghiệm học"
  | "tự học";

export type GroupCategory = "review" | "online" | "hsk" | "tailieu" | "all";

export type GroupType = "review_trung_tâm" | "học_online" | "hsk" | "tài_liệu" | "all";

export type CommentTone = "sinh_viên" | "người_đi_làm" | "người_mới" | "mixed" | "redirect";

export type CommentType = "bait" | "redirect";

export type PostStatus = "draft" | "ready" | "used" | "archived";

export type GroupStatus = "active" | "inactive";

// Comment
export interface SeedingComment {
  id: string;
  postId: string;
  content: string;
  tone: CommentTone;
  type: CommentType;
  used: boolean;
  usedAt?: Date;
  createdAt: Date;
}

// Group
export interface SeedingGroup {
  id: string;
  name: string;
  url: string;
  category: GroupCategory;
  status: GroupStatus;
  memberCount?: number;
  createdAt: Date;
  lastUsedAt?: Date;
}

// Post
export interface SeedingPost {
  id: string;
  title: string;
  content: string;
  category: SeedingCategory;
  groupType?: GroupType;
  targetGroup?: string;
  status: PostStatus;
  comments: SeedingComment[];
  goal: string;
  createdAt: Date;
  scheduledAt?: Date;
  usedAt?: Date;
}

// Input
export interface GeneratePostInput {
  sourceContent: string;
  topic: string;
  groupType: SeedingCategory;
  commentCount: number;
}

// AI Results
export interface PostAnalysis {
  category: SeedingCategory;
  userNeed: string;
  psychology: string;
  seedingGoal: string;
  suggestedTone: CommentTone;
  groupType: GroupType;
}

export interface SeedPostResult {
  title: string;
  content: string;
  category: SeedingCategory;
  psychology: string;
  postId: string;
}

export interface BaitCommentsResult {
  postId: string;
  comments: string[];
  commentObjects: SeedingComment[];
}

export interface RedirectEngineResult {
  postId: string;
  originalPost: string;
  detectedCategory: SeedingCategory;
  mappedGroupCategory: GroupCategory;
  targetGroup: SeedingGroup | null;
  redirectComment: string;
  success: boolean;
  errorMessage?: string;
}

// History & Stats
export interface SeedingHistory {
  usedTitles: string[];
  usedComments: string[];
  usedTopics: string[];
  lastGeneratedAt?: Date;
}

export interface DailyStats {
  date: string;
  posts_count: number;
  comments_count: number;
  redirect_count: number;
  categories_used: SeedingCategory[];
  groups_used: string[];
}

export interface PostWithCounts extends SeedingPost {
  commentCount: number;
  baitCount: number;
  redirectCount: number;
  usedCommentCount: number;
}

export interface WeeklyStat {
  date: string;
  posts: number;
  comments: number;
  used: number;
}

export interface CategoryStats {
  category: SeedingCategory;
  count: number;
  comments: number;
  percentage: number;
}
