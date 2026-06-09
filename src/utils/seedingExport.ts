/**
 * Seeding Export/Import utilities — Excel/CSV bridge với GPM Automate.
 *
 * Export: SeedingTask[] → Excel (task_id, profile_id, ..., delay_max)
 * Import Report: Excel/CSV → TaskReportRow[] → batch update Firestore
 * Import Profiles: Excel/CSV → ProfileImportRow[]
 *
 * Pure functions — testable độc lập với Firestore.
 */
import type {
  SeedingTask,
  TaskExportRow,
  TaskReportRow,
  ProfileImportRow,
  TaskStatus,
} from "@/types/seeding";
import { Timestamp } from "firebase/firestore";

// ── Export tasks → Excel ──────────────────────────────────────────────────────

/**
 * Chuyển SeedingTask[] thành rows cho GPM Automate.
 * Pure function — testable.
 */
export function buildTaskExportRows(tasks: SeedingTask[]): TaskExportRow[] {
  return tasks.map((t) => ({
    task_id:       t.id,
    profile_id:    t.profileId,
    profile_name:  t.profileName,
    action:        t.action,
    target_url:    t.targetUrl,
    comment_text:  t.commentText ?? "",
    share_caption: t.shareCaption ?? "",
    delay_min:     t.delayMin,
    delay_max:     t.delayMax,
  }));
}

/**
 * Xuất tasks ra file Excel (.xlsx) và trigger download.
 * @returns danh sách task_id đã export (để gọi markTasksExported)
 */
export async function exportTasksToExcel(
  tasks: SeedingTask[],
  campaignName: string
): Promise<string[]> {
  if (tasks.length === 0) return [];

  const XLSX = await import("xlsx");
  const rows = buildTaskExportRows(tasks);
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 24 }, // task_id
    { wch: 20 }, // profile_id
    { wch: 22 }, // profile_name
    { wch: 10 }, // action
    { wch: 50 }, // target_url
    { wch: 60 }, // comment_text
    { wch: 40 }, // share_caption
    { wch: 10 }, // delay_min
    { wch: 10 }, // delay_max
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");
  const filename = `gpm_tasks_${campaignName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);

  return tasks.map((t) => t.id);
}

/**
 * Xuất tasks ra CSV và trigger download.
 */
export function exportTasksToCSV(tasks: SeedingTask[], campaignName: string): string[] {
  if (tasks.length === 0) return [];

  const rows = buildTaskExportRows(tasks);
  const BOM = "﻿";
  const headers = Object.keys(rows[0]) as (keyof TaskExportRow)[];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(",")
    ),
  ];
  const csv = BOM + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gpm_tasks_${campaignName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  return tasks.map((t) => t.id);
}

// ── Parse report từ GPM ───────────────────────────────────────────────────────

const VALID_STATUSES = new Set<string>(["scheduled", "pending", "running", "success", "failed", "skipped"]);

/**
 * Parse raw rows từ Excel/CSV thành TaskReportRow[].
 * Bỏ qua rows thiếu task_id. Normalize status về lowercase.
 * Pure function.
 */
export function parseReportRows(rawRows: Record<string, unknown>[]): TaskReportRow[] {
  return rawRows
    .filter((r): r is Record<string, string | number> => {
      const id = String(r["task_id"] ?? r["Task ID"] ?? r["TASK_ID"] ?? "").trim();
      return id.length > 0;
    })
    .map((r) => ({
      task_id:       String(r["task_id"]       ?? r["Task ID"]      ?? "").trim(),
      profile_id:    String(r["profile_id"]    ?? r["Profile ID"]   ?? "").trim(),
      action:        String(r["action"]        ?? r["Action"]       ?? "").trim().toLowerCase(),
      target_url:    String(r["target_url"]    ?? r["Target URL"]   ?? "").trim(),
      status:        String(r["status"]        ?? r["Status"]       ?? "").trim().toLowerCase(),
      error_message: String(r["error_message"] ?? r["Error Message"]?? "").trim(),
      finished_at:   String(r["finished_at"]   ?? r["Finished At"]  ?? "").trim(),
    }));
}

/**
 * Normalize status string từ GPM về TaskStatus hợp lệ.
 * GPM có thể xuất "Success", "FAILED", "Done", v.v.
 */
export function normalizeTaskStatus(raw: string): TaskStatus {
  const s = raw.toLowerCase().trim();
  if (s === "success" || s === "done" || s === "completed" || s === "ok") return "success";
  if (s === "failed" || s === "error" || s === "fail")                     return "failed";
  if (s === "running" || s === "processing" || s === "in_progress")        return "running";
  if (s === "skipped" || s === "skip" || s === "ignored")                  return "skipped";
  if (VALID_STATUSES.has(s)) return s as TaskStatus;
  return "failed"; // unknown → treat as failed
}

/**
 * Chuyển chuỗi finished_at thành Timestamp (nếu parse được).
 */
export function parseFinishedAt(raw: string): Timestamp | undefined {
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  if (isNaN(ms)) return undefined;
  return Timestamp.fromMillis(ms);
}

/**
 * Đọc file Excel/CSV (File object) và trả về parsed rows.
 * Async — dùng FileReader.
 */
export async function readReportFile(file: File): Promise<TaskReportRow[]> {
  const XLSX = await import("xlsx");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) { resolve([]); return; }
        const wb = XLSX.read(data, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        });
        resolve(parseReportRows(rows));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Không đọc được file"));
    reader.readAsBinaryString(file);
  });
}

// ── Parse profile CSV/Excel ───────────────────────────────────────────────────

/**
 * Parse raw rows từ file CSV/Excel thành ProfileImportRow[].
 * Bỏ qua rows thiếu profile_id hoặc profile_name.
 */
export function parseProfileRows(rawRows: Record<string, unknown>[]): ProfileImportRow[] {
  return rawRows
    .map((r) => ({
      profile_id:   String(r["profile_id"]   ?? r["Profile ID"]   ?? r["ID"]   ?? "").trim(),
      profile_name: String(r["profile_name"] ?? r["Profile Name"] ?? r["Name"] ?? "").trim(),
      status:       String(r["status"]       ?? r["Status"]       ?? "").trim().toLowerCase() || undefined,
      note:         String(r["note"]         ?? r["Note"]         ?? "").trim() || undefined,
    }))
    .filter((r) => r.profile_id && r.profile_name);
}

/**
 * Đọc file Excel/CSV cho profiles.
 */
export async function readProfileFile(file: File): Promise<ProfileImportRow[]> {
  const XLSX = await import("xlsx");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) { resolve([]); return; }
        const wb = XLSX.read(data, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        });
        resolve(parseProfileRows(rows));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Không đọc được file"));
    reader.readAsBinaryString(file);
  });
}

/**
 * Xuất template Excel cho profiles (user điền vào).
 */
export async function exportProfileTemplate(): Promise<void> {
  const sample: ProfileImportRow[] = [
    { profile_id: "profile_001", profile_name: "Nguyễn Văn A", status: "active", note: "Tài khoản chính" },
    { profile_id: "profile_002", profile_name: "Trần Thị B",   status: "active", note: "" },
  ];
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(sample);
  ws["!cols"] = [{ wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Profiles");
  XLSX.writeFile(wb, "gpm_profiles_template.xlsx");
}
