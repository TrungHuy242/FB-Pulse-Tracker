/**
 * Seeding Service — Firestore CRUD cho 4 collections seeding.
 *
 * Collections: seedingProfiles · seedingCampaigns · seedingTasks · seedingComments
 * Phân quyền: read = isAllowedUser, write = isAdmin (Firestore Rules)
 *
 * FIX #12: Thêm onSnapshot subscriptions để SeedingPage cập nhật realtime.
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";
import { db } from "@/service/firebase";
import type {
  SeedingProfile,
  SeedingCampaign,
  SeedingTask,
  SeedingComment,
  ProfileStatus,
  CampaignStatus,
  TaskStatus,
} from "@/types/seeding";

// ── Collection refs ───────────────────────────────────────────────────────────

const profilesRef  = () => collection(db, "seedingProfiles");
const campaignsRef = () => collection(db, "seedingCampaigns");
const tasksRef     = () => collection(db, "seedingTasks");
const commentsRef  = () => collection(db, "seedingComments");

type CampaignUpdateData = Partial<Omit<SeedingCampaign, "id" | "createdAt" | "scheduledAt">> & {
  scheduledAt?: SeedingCampaign["scheduledAt"] | FieldValue;
};

// ── Realtime subscriptions ────────────────────────────────────────────────────

/**
 * Subscribe realtime vào campaigns collection.
 * Trả về unsubscribe function — gọi trong useEffect cleanup.
 */
export function subscribeCampaigns(
  callback: (campaigns: SeedingCampaign[]) => void
): () => void {
  const q = query(campaignsRef(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeedingCampaign)));
  });
}

/**
 * Subscribe realtime vào profiles collection.
 */
export function subscribeProfiles(
  callback: (profiles: SeedingProfile[]) => void
): () => void {
  const q = query(profilesRef(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeedingProfile)));
  });
}

/**
 * Subscribe realtime vào comments library.
 */
export function subscribeCommentLibrary(
  callback: (comments: SeedingComment[]) => void
): () => void {
  const q = query(commentsRef(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeedingComment)));
  });
}

/**
 * Subscribe realtime vào tất cả tasks collection.
 */
export function subscribeAllTasks(
  callback: (tasks: SeedingTask[]) => void
): () => void {
  const q = query(tasksRef(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeedingTask)));
  });
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function getProfiles(): Promise<SeedingProfile[]> {
  const snap = await getDocs(query(profilesRef(), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeedingProfile));
}

export async function createProfile(
  data: Omit<SeedingProfile, "id" | "createdAt">
): Promise<SeedingProfile> {
  const ref = await addDoc(profilesRef(), {
    ...data,
    createdAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...snap.data() } as SeedingProfile;
}

export async function updateProfile(
  id: string,
  data: Partial<Omit<SeedingProfile, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "seedingProfiles", id), { ...data });
}

export async function deleteProfile(id: string): Promise<void> {
  await deleteDoc(doc(db, "seedingProfiles", id));
}

/** Batch upsert profiles từ CSV — tạo mới nếu profileId chưa có, cập nhật nếu đã có */
export async function upsertProfiles(
  rows: Array<{
    profileId: string;
    profileName: string;
    status?: ProfileStatus;
    note?: string;
  }>
): Promise<number> {
  const existing = await getProfiles();
  const existingMap = new Map(existing.map((p) => [p.profileId, p]));

  const batch = writeBatch(db);
  let upserted = 0;

  for (const row of rows) {
    const trimmed = row.profileId.trim();
    if (!trimmed) continue;

    const existing_ = existingMap.get(trimmed);
    if (existing_) {
      batch.update(doc(db, "seedingProfiles", existing_.id), {
        profileName: row.profileName.trim(),
        status: row.status ?? existing_.status,
        ...(row.note !== undefined && { note: row.note }),
      });
    } else {
      const newRef = doc(profilesRef());
      batch.set(newRef, {
        profileId: trimmed,
        profileName: row.profileName.trim(),
        status: row.status ?? "active",
        note: row.note ?? "",
        createdAt: serverTimestamp(),
      });
    }
    upserted++;
  }

  await batch.commit();
  return upserted;
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export async function getCampaigns(): Promise<SeedingCampaign[]> {
  const snap = await getDocs(query(campaignsRef(), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeedingCampaign));
}

export async function createCampaign(
  data: Omit<SeedingCampaign, "id" | "createdAt" | "updatedAt">
): Promise<SeedingCampaign> {
  const now = serverTimestamp();
  const ref = await addDoc(campaignsRef(), { ...data, createdAt: now, updatedAt: now });
  const snap = await getDoc(ref);
  return { id: snap.id, ...snap.data() } as SeedingCampaign;
}

export async function updateCampaign(
  id: string,
  data: CampaignUpdateData
): Promise<void> {
  await updateDoc(doc(db, "seedingCampaigns", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  // Xóa campaign và tất cả tasks liên quan
  const taskSnap = await getDocs(
    query(tasksRef(), where("campaignId", "==", id))
  );
  const batch = writeBatch(db);
  taskSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "seedingCampaigns", id));
  await batch.commit();
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasksByCampaign(campaignId: string): Promise<SeedingTask[]> {
  const snap = await getDocs(
    query(tasksRef(), where("campaignId", "==", campaignId))
  );
  const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeedingTask));
  // Sắp xếp client-side theo thời gian tạo tăng dần
  return tasks.sort((a, b) => {
    const timeA = a.createdAt?.seconds || 0;
    const timeB = b.createdAt?.seconds || 0;
    return timeA - timeB;
  });
}

export async function createTasksBulk(
  tasks: Array<Omit<SeedingTask, "id" | "createdAt" | "status" | "finishedAt" | "exportedAt" | "errorMessage">>,
  initialStatus: TaskStatus = "pending"
): Promise<number> {
  const batch = writeBatch(db);
  for (const task of tasks) {
    const ref = doc(tasksRef());
    batch.set(ref, {
      ...task,
      status: initialStatus,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return tasks.length;
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, "seedingTasks", id));
}

export async function deleteTasksByCampaign(campaignId: string): Promise<void> {
  const snap = await getDocs(
    query(tasksRef(), where("campaignId", "==", campaignId))
  );
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/** Mark tasks là đã export (ghi exportedAt) */
export async function markTasksExported(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const batch = writeBatch(db);
  const now = serverTimestamp();
  for (const id of taskIds) {
    batch.update(doc(db, "seedingTasks", id), { exportedAt: now });
  }
  await batch.commit();
}

/** Batch update task statuses từ report import */
export async function applyTaskReport(
  updates: Array<{
    id: string;
    status: TaskStatus;
    errorMessage?: string;
    finishedAt?: Timestamp;
  }>
): Promise<number> {
  if (updates.length === 0) return 0;
  const batch = writeBatch(db);
  for (const u of updates) {
    batch.update(doc(db, "seedingTasks", u.id), {
      status: u.status,
      ...(u.errorMessage !== undefined && { errorMessage: u.errorMessage }),
      ...(u.finishedAt && { finishedAt: u.finishedAt }),
    });
  }
  await batch.commit();
  return updates.length;
}

/** Lấy tasks theo danh sách task_id (để match report) */
export async function getTasksByIds(ids: string[]): Promise<SeedingTask[]> {
  if (ids.length === 0) return [];
  // Firestore where "in" giới hạn 30 items — chunk nếu cần
  const CHUNK = 30;
  const results: SeedingTask[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const snap = await getDocs(
      query(tasksRef(), where("__name__", "in", chunk.map((id) => doc(db, "seedingTasks", id))))
    );
    snap.docs.forEach((d) => results.push({ id: d.id, ...d.data() } as SeedingTask));
  }
  return results;
}

// ── Comment Library ───────────────────────────────────────────────────────────

export async function getSeedingComments(): Promise<SeedingComment[]> {
  const snap = await getDocs(query(commentsRef(), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeedingComment));
}

export async function createSeedingComment(
  data: Omit<SeedingComment, "id" | "createdAt" | "usageCount">
): Promise<SeedingComment> {
  const ref = await addDoc(commentsRef(), {
    ...data,
    usageCount: 0,
    createdAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...snap.data() } as SeedingComment;
}

export async function updateSeedingComment(
  id: string,
  data: Partial<Pick<SeedingComment, "text" | "tags">>
): Promise<void> {
  await updateDoc(doc(db, "seedingComments", id), { ...data });
}

export async function deleteSeedingComment(id: string): Promise<void> {
  await deleteDoc(doc(db, "seedingComments", id));
}

/** Tăng usageCount khi comment được dùng để tạo task */
export async function incrementCommentUsage(ids: string[]): Promise<void> {
  void ids;
  // No-op — usageCount updated separately via direct updateSeedingComment if needed
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Nháp",
  active: "Đang chạy",
  paused: "Tạm dừng",
  completed: "Hoàn thành",
  scheduled: "Đã lên lịch",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  scheduled: "Đã lên lịch",
  pending: "Chờ",
  running: "Đang chạy",
  success: "Thành công",
  failed: "Thất bại",
  skipped: "Bỏ qua",
};

export const ACTION_LABELS: Record<string, string> = {
  like: "Like",
  comment: "Comment",
  share: "Share",
};

export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  active: "Hoạt động",
  inactive: "Không dùng",
  banned: "Bị khóa",
};
