import admin from "firebase-admin";
import fs from "fs";
import dotenv from "dotenv";
import { GpmClient } from "./gpmClient.js";
import { connectToGpmChrome } from "./browserAgent.js";
import { runSeedingTask, SeedingTaskPayload } from "./taskRunner.js";

// 1. Tải cấu hình biến môi trường
dotenv.config();

const GPM_API_URL = process.env.GPM_API_URL || "http://127.0.0.1:19995";
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json";
const MIN_DELAY = parseInt(process.env.MIN_DELAY_SECONDS || "5");
const MAX_DELAY = parseInt(process.env.MAX_DELAY_SECONDS || "20");

type TaskAction = SeedingTaskPayload["action"];

interface FirestoreTaskData {
  profileId?: string;
  status?: string;
  action?: TaskAction;
  postUrl?: string;
  targetUrl?: string;
  commentText?: string;
  retryCount?: number;
}

interface FirestoreCampaignData {
  name?: string;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

console.log("=========================================================");
console.log("🚀 KHỞI ĐỘNG GPM BRIDGE AGENT - TỰ ĐỘNG HÓA SEEDING");
console.log(`- GPM Login API: ${GPM_API_URL}`);
console.log(`- Firebase Credentials: ${FIREBASE_SERVICE_ACCOUNT_PATH}`);
console.log(`- Cấu hình Delay: ${MIN_DELAY}s - ${MAX_DELAY}s`);
console.log("=========================================================");

// 2. Khởi tạo Firebase Admin SDK
if (!fs.existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
  console.error(`❌ Lỗi: Không tìm thấy file Firebase Service Account tại đường dẫn: ${FIREBASE_SERVICE_ACCOUNT_PATH}`);
  console.error("Vui lòng tải file JSON credentials từ Firebase Console và cấu hình chính xác trong file .env.");
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, "utf8")) as admin.ServiceAccount;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✅ Kết nối Firebase Admin SDK thành công!");
} catch (err: unknown) {
  console.error("❌ Khởi tạo Firebase Admin SDK thất bại:", getErrorMessage(err));
  process.exit(1);
}

const db = admin.firestore();
const gpm = new GpmClient(GPM_API_URL);

/**
 * Đồng bộ danh sách profiles từ GPM Login cục bộ lên Firestore
 */
async function syncGpmProfiles() {
  console.log("\n[Sync] Đang kiểm tra và đồng bộ danh sách profiles từ GPM Login lên Firestore...");
  try {
    const gpmProfiles = await gpm.getProfiles();
    if (gpmProfiles.length === 0) {
      console.log("[Sync] Không lấy được profile nào từ GPM Login (hoặc GPM đang đóng/không có profiles).");
      return;
    }

    console.log(`[Sync] Lấy thành công ${gpmProfiles.length} profiles từ GPM Login cục bộ.`);

    const profilesColl = db.collection("seedingProfiles");
    const snapshot = await profilesColl.get();

    // Map chứa profile hiện có trên Firestore (Key: profileId)
    const existingMap = new Map<string, { docId: string; name: string }>();
    snapshot.docs.forEach((d) => {
      const data = d.data();
      if (data.profileId) {
        existingMap.set(data.profileId, { docId: d.id, name: data.profileName || "" });
      }
    });

    let createdCount = 0;
    let updatedCount = 0;

    const batch = db.batch();

    for (const gp of gpmProfiles) {
      if (gp.id === "00000000-0000-0000-0000-000000000000") continue; // bỏ qua id mặc định
      
      const existing = existingMap.get(gp.id);
      if (existing) {
        // Nếu tên bị thay đổi ở GPM cục bộ, cập nhật lại trên Firestore
        if (existing.name !== gp.name) {
          batch.update(profilesColl.doc(existing.docId), {
            profileName: gp.name,
          });
          updatedCount++;
        }
      } else {
        // Tạo mới profile chưa có trên Firestore
        const newDoc = profilesColl.doc();
        batch.set(newDoc, {
          profileId: gp.id,
          profileName: gp.name,
          status: "active",
          note: "Được đồng bộ tự động từ GPM Login cục bộ",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        createdCount++;
      }
    }

    if (createdCount > 0 || updatedCount > 0) {
      await batch.commit();
      console.log(`[Sync] Đã đồng bộ xong! Thêm mới: ${createdCount}, cập nhật tên: ${updatedCount} profiles.`);
    } else {
      console.log("[Sync] Tất cả profiles đã khớp với Firestore, không có thay đổi nào cần cập nhật.");
    }
  } catch (err: unknown) {
    console.error("[Sync] Lỗi trong lúc đồng bộ profiles:", getErrorMessage(err));
  }
}

// Đồng bộ ngay khi khởi động
syncGpmProfiles().catch(console.error);

// Đồng bộ định kỳ mỗi 2 phút
setInterval(() => {
  syncGpmProfiles().catch(console.error);
}, 120000);

// 3. Khởi tạo hàng đợi và xử lý tuần tự (Sequential Queue)
const taskQueue: string[] = []; // Chứa danh sách Task ID đang chờ xử lý
let isProcessing = false;

// Tập hợp lưu các task đang chạy để tránh xử lý trùng khi Firestore snapshot bắn cập nhật liên tục
const activeProcessingIds = new Set<string>();

/**
 * Hàm chính xử lý tuần tự hàng đợi task
 */
async function processQueue() {
  if (isProcessing || taskQueue.length === 0) return;
  isProcessing = true;

  // Lấy Task ID đầu tiên trong hàng đợi
  const taskId = taskQueue.shift()!;
  activeProcessingIds.add(taskId);

  console.log(`\n[Queue] ----------------------------------------------------`);
  console.log(`[Queue] Bắt đầu xử lý Task ID: ${taskId}`);
  
  const taskRef = db.collection("seedingTasks").doc(taskId);
  let profileId = "";

  try {
    // Đọc thông tin chi tiết task
    const doc = await taskRef.get();
    if (!doc.exists) {
      throw new Error("Task không tồn tại trên Firestore.");
    }

    const taskData = doc.data() as FirestoreTaskData;
    profileId = taskData.profileId ?? "";

    if (taskData.status !== "pending") {
      console.log(`[Queue] Bỏ qua Task vì trạng thái hiện tại là: ${taskData.status}`);
      activeProcessingIds.delete(taskId);
      isProcessing = false;
      processQueue();
      return;
    }

    if (!taskData.action) {
      throw new Error("Task thiếu thông tin action.");
    }

    const targetUrl = taskData.postUrl ?? taskData.targetUrl ?? "";
    if (!targetUrl) {
      throw new Error("Task thiếu targetUrl/postUrl.");
    }

    // Bước 1: Khóa task sang trạng thái "running" ngay lập tức để tránh instance khác tranh chấp
    console.log(`[Queue] Bước 1: Đổi trạng thái Task -> running...`);
    await taskRef.update({
      status: "running",
    });

    if (!profileId) {
      throw new Error("Task thiếu thông tin profileId.");
    }

    // Bước 2: Gọi GPM Login để mở Profile và lấy cổng debug
    console.log(`[Queue] Bước 2: Khởi động Chrome profile qua GPM...`);
    const debugPort = await gpm.startProfile(profileId);

    // Bước 3: Kết nối Puppeteer vào trình duyệt
    console.log(`[Queue] Bước 3: Kết nối Puppeteer vào Chrome...`);
    const browser = await connectToGpmChrome(debugPort);

    // Bước 4: Thực thi hành động trên Facebook
    console.log(`[Queue] Bước 4: Thực thi hành động trên trình duyệt...`);
    const runnerPayload: SeedingTaskPayload = {
      id: taskId,
      action: taskData.action,
      postUrl: targetUrl,
      commentText: taskData.commentText,
      profileId,
    };

    await runSeedingTask(browser, runnerPayload, MIN_DELAY, MAX_DELAY);

    // Đóng browser connection trước khi ngắt kết nối
    try {
      await browser.disconnect();
    } catch {
      // Ignore disconnect errors after the task has already finished.
    }

    // Bước 5: Cập nhật thành công lên Firestore
    console.log(`[Queue] Bước 5: Cập nhật Firestore -> success`);
    await taskRef.update({
      status: "success",
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      errorMessage: admin.firestore.FieldValue.delete(), // Xóa thông báo lỗi cũ nếu có
    });

    console.log(`🎉 Task ${taskId} hoàn thành thành công!`);

  } catch (err: unknown) {
    const errorMsg = getErrorMessage(err);
    console.error(`❌ Task ${taskId} bị lỗi:`, errorMsg);

    try {
      // Đọc thông tin retry hiện tại từ Firestore
      const docSnap = await taskRef.get();
      const currentRetry = docSnap.exists ? (docSnap.data()?.retryCount || 0) : 0;
      const nextRetry = currentRetry + 1;

      if (nextRetry <= 3) {
        console.log(`[Queue] ⚠️ [Retry] Thử lại task ${taskId} lần ${nextRetry}/3 sau 10 giây...`);
        // Đặt timeout 10 giây rồi đưa về pending để tránh chạy lại quá nhanh
        setTimeout(async () => {
          try {
            await taskRef.update({
              status: "pending",
              retryCount: nextRetry,
              errorMessage: `Thử lại lần ${nextRetry}: ${errorMsg}`,
            });
            console.log(`[Queue] Đã chuyển task ${taskId} trở lại trạng thái 'pending' để chạy lại.`);
          } catch (updateErr: unknown) {
            console.error(`[Queue] Lỗi cập nhật retry task ${taskId}:`, getErrorMessage(updateErr));
          }
        }, 10000);
      } else {
        console.log(`[Queue] ❌ Task ${taskId} đã thử lại tối đa 3 lần và thất bại hoàn toàn.`);
        await taskRef.update({
          status: "failed",
          errorMessage: `Đã thử lại 3 lần thất bại. Lỗi cuối: ${errorMsg}`,
          finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[Queue] Cập nhật trạng thái thất bại cuối cùng lên Firestore.`);
      }
    } catch (dbErr: unknown) {
      console.error("[Queue] Không thể cập nhật trạng thái lỗi / retry lên Firestore:", getErrorMessage(dbErr));
    }

  } finally {
    // Bước 6: Đóng profile GPM (luôn chạy bất kể thành công hay lỗi)
    if (profileId) {
      console.log(`[Queue] Bước 6: Đóng Chrome profile...`);
      await gpm.closeProfile(profileId);
    }

    activeProcessingIds.delete(taskId);
    isProcessing = false;
    console.log(`[Queue] Hoàn thành xử lý Task ID: ${taskId}`);
    console.log(`[Queue] ----------------------------------------------------`);

    // Tiếp tục xử lý task tiếp theo trong hàng đợi
    processQueue();
  }
}

// 4. Lắng nghe Firestore Seeding Tasks có trạng thái "pending"
console.log("\n[Firestore] Đang thiết lập listener lắng nghe các tasks có trạng thái 'pending'...");

const unsubscribe = db
  .collection("seedingTasks")
  .where("status", "==", "pending")
  .onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const taskId = change.doc.id;
          
          // Chỉ đưa vào hàng đợi nếu chưa có trong hàng đợi và chưa được xử lý
          if (!taskQueue.includes(taskId) && !activeProcessingIds.has(taskId)) {
            console.log(`[Firestore] Phát hiện task 'pending' mới: ${taskId}. Đang đưa vào hàng đợi...`);
            taskQueue.push(taskId);
          }
        }
      });

      // Kích hoạt xử lý hàng đợi
      processQueue();
    },
    (error) => {
      console.error("[Firestore] Lỗi lắng nghe realtime snapshot:", error);
    }
  );

// Đăng ký dọn dẹp khi nhận tín hiệu kết thúc
process.on("SIGINT", () => {
  console.log("\n👋 Đang tắt Bridge Agent...");
  unsubscribe();
  process.exit(0);
});

/**
 * Quét định kỳ và kích hoạt các chiến dịch đã đến lịch chạy hẹn giờ (scheduled)
 */
async function checkAndRunScheduledCampaigns() {
  const now = admin.firestore.Timestamp.now();
  console.log(`[Schedule] Đang kiểm tra lịch chạy chiến dịch tại: ${new Date().toLocaleTimeString()}...`);
  try {
    const campaignsSnap = await db
      .collection("seedingCampaigns")
      .where("status", "==", "scheduled")
      .where("scheduledAt", "<=", now)
      .get();

    if (campaignsSnap.empty) return;

    for (const doc of campaignsSnap.docs) {
      const campaignId = doc.id;
      const campaignData = doc.data() as FirestoreCampaignData;
      console.log(`⏱️ [Schedule] Phát hiện chiến dịch hẹn giờ đến lượt chạy: ${campaignData.name}`);

      // 1. Cập nhật campaign status sang active
      await db.collection("seedingCampaigns").doc(campaignId).update({
        status: "active",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 2. Lấy tất cả tasks chưa thành công của campaign và đưa về pending
      const tasksSnap = await db
        .collection("seedingTasks")
        .where("campaignId", "==", campaignId)
        .get();

      if (!tasksSnap.empty) {
        const batch = db.batch();
        let count = 0;
        tasksSnap.docs.forEach((tDoc) => {
          const tData = tDoc.data();
          if (tData.status !== "success") {
            batch.update(tDoc.ref, {
              status: "pending",
              retryCount: 0,
              errorMessage: admin.firestore.FieldValue.delete(),
            });
            count++;
          }
        });
        if (count > 0) {
          await batch.commit();
          console.log(`⏱️ [Schedule] Đã cập nhật ${count} tasks của chiến dịch sang 'pending' để GPM chạy.`);
        }
      }
    }
  } catch (err: unknown) {
    console.error("[Schedule] Lỗi quét chiến dịch hẹn giờ:", getErrorMessage(err));
  }
}

// Bắt đầu loop kiểm tra hẹn giờ chạy chiến dịch mỗi 30 giây
setInterval(checkAndRunScheduledCampaigns, 30000);
