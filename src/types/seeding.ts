import type { Timestamp } from "firebase/firestore";

// ── Enums ─────────────────────────────────────────────────────────────────────

export type SeedingAction   = "like" | "comment" | "share";
export type TaskStatus      = "scheduled" | "pending" | "running" | "success" | "failed" | "skipped";
export type CampaignStatus  = "draft" | "active" | "paused" | "completed" | "scheduled";
export type ProfileStatus   = "active" | "inactive" | "banned";

// ── Firestore documents ───────────────────────────────────────────────────────

export interface SeedingProfile {
  id: string;
  profileId: string;       // GPM profile ID (user-defined string)
  profileName: string;
  status: ProfileStatus;
  note?: string;
  createdAt: Timestamp;
}

export interface SeedingCampaign {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  targetUrl?: string;      // URL mặc định cho tasks trong campaign
  scheduledAt?: Timestamp; // Thời gian hẹn giờ chạy tự động
  isTemplate?: boolean;    // Đánh dấu chiến dịch mẫu
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SeedingTask {
  id: string;
  campaignId: string;
  profileId: string;
  profileName: string;
  action: SeedingAction;
  targetUrl: string;
  commentText?: string;    // Chỉ dùng khi action === "comment"
  shareCaption?: string;   // Chỉ dùng khi action === "share"
  delayMin: number;        // Giây — GPM dùng để randomize delay
  delayMax: number;
  totalFiles?: number;
  status: TaskStatus;
  retryCount?: number;     // Số lần đã tự động chạy lại khi lỗi
  errorMessage?: string;
  finishedAt?: Timestamp;
  exportedAt?: Timestamp;
  createdAt: Timestamp;
}

export interface SeedingComment {
  id: string;
  text: string;
  tags: string[];
  usageCount: number;
  createdAt: Timestamp;
}

// ── Excel/CSV bridge types ────────────────────────────────────────────────────

/** Row xuất ra Excel/CSV cho GPM Automate */
export interface TaskExportRow {
  task_id: string;
  profile_id: string;
  profile_name: string;
  action: string;
  target_url: string;
  comment_text: string;
  share_caption: string;
  delay_min: number;
  delay_max: number;
}

/** Row đọc từ report Excel/CSV của GPM Automate */
export interface TaskReportRow {
  task_id: string;
  profile_id: string;
  action: string;
  target_url: string;
  status: string;
  error_message: string;
  finished_at: string;
}

/** Row import profiles từ Excel/CSV */
export interface ProfileImportRow {
  profile_id: string;
  profile_name: string;
  status?: string;
  note?: string;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface SeedingStats {
  total: number;
  scheduled: number;
  pending: number;
  running: number;
  success: number;
  failed: number;
  skipped: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  successRate: number;   // 0–100, tính trên total đã chạy (loại pending/running)
}
