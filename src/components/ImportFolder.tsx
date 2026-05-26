import {
  Button,
  Modal,
  Upload,
  message,
  Progress,
  Steps,
  Table,
  Input,
  Typography,
  Tag,
  Tooltip,
} from "antd";
import { UploadOutlined, DeleteOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import JSZip from "jszip";
import { forwardRef, useImperativeHandle, useState } from "react";
import "../styles/header.scss";
import { useLoading } from "@/contexts/LoadingContext";
import { decodeFacebookObject } from "@/utils/encoding";
import { chunkArray } from "@/utils/array";
import {
  createImport,
  addCommentChunk,
  addReactionChunk,
  finalizeImport,
} from "@/service/importService";
import {
  requestNotificationPermission,
  fireNotification,
} from "@/utils/notification";

const COMMENT_CHUNK_SIZE = 700;
const REACTION_CHUNK_SIZE = 2000;

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedFile {
  name: string;
  data: unknown;
  size: number;
}

/**
 * Một ZIP file đã parse — chứa thông tin preview và dữ liệu thực tế.
 * Nhiều ZipJob = batch import.
 */
interface ZipJob {
  /** Key duy nhất (fileName + timestamp) */
  id: string;
  /** Tên file .zip gốc */
  fileName: string;
  /** Tên tài khoản — do user chỉnh sửa hoặc lấy từ root folder */
  accountName: string;
  /** Tên folder gốc trong ZIP (không thể sửa) */
  originalFolderName: string;
  /** JSON files đã parse từ ZIP */
  parsedFiles: ParsedFile[];
  /** Tên các inner folders (dùng để nhóm khi upload) */
  innerFolderNames: string[];
  /** Số bình luận ước tính (preview) */
  commentsPreview: number;
  /** Số cảm xúc ước tính (preview) */
  reactionsPreview: number;
}

export interface FormDrawerHandle {
  open: () => void;
  close: () => void;
}

interface ImportZipProps {
  onImportSuccess?: () => void;
}

interface CommentRawItem {
  comment?: {
    author?: string;
    comment?: string;
    timestamp?: number;
    group?: string;
  };
}

interface CommentEventItem {
  data?: CommentRawItem[];
  title?: string;
  author?: string;
  comment?: string;
  timestamp?: number;
  group?: string;
}

interface ReactionLabelValue {
  label: string;
  value?: string;
  href?: string;
  dict?: ReactionLabelValue[];
}

interface ReactionRawItem {
  label_values?: ReactionLabelValue[];
  timestamp?: number;
  fbid?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export const ImportZip = forwardRef<FormDrawerHandle, ImportZipProps>(
  ({ onImportSuccess }, ref) => {
    const [open, setOpen] = useState(false);
    /** Danh sách ZIP jobs (batch import) */
    const [zipJobs, setZipJobs] = useState<ZipJob[]>([]);
    /** File list cho antd Upload component */
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [progress, setProgress] = useState(0);
    const [importStep, setImportStep] = useState<number>(-1); // -1 = idle

    const { showLoading, closeLoading } = useLoading();

    /* ========================= REACTION HELPERS ========================= */
    const isReactionItem = (item: unknown): item is ReactionRawItem =>
      !!item &&
      typeof item === "object" &&
      Array.isArray((item as ReactionRawItem).label_values) &&
      ((item as ReactionRawItem).label_values ?? []).some((lv) =>
        ["Cảm xúc", "URL", "Tên"].includes(lv?.label)
      );

    const getNameFromDict = (arr: ReactionLabelValue[]): string => {
      for (const i of arr) {
        if (i.label === "Tên" && i.value) return i.value;
        if (Array.isArray(i.dict)) {
          const nested = getNameFromDict(i.dict);
          if (nested) return nested;
        }
      }
      return "";
    };

    const mapReactionItem = (item: ReactionRawItem) => {
      const lvs = item.label_values ?? [];
      const getByLabel = (label: string) => lvs.find((lv) => lv.label === label);
      return {
        reaction: getByLabel("Cảm xúc")?.value ?? "",
        linkPost: getByLabel("URL")?.href ?? "",
        commentAuthorName: getNameFromDict(lvs) || "Chưa xác định",
        ownerName: getByLabel("Tên")?.value ?? "Chưa xác định",
        reactionTime: item.timestamp ?? 0,
        fbid: item.fbid ?? "",
      };
    };

    /* ========================= PREVIEW COUNTER ========================= */
    /**
     * Tính trước số lượng comments/reactions từ parsedFiles.
     * Dùng để hiển thị preview TRƯỚC khi upload lên Firestore.
     */
    const computePreviewCounts = (
      files: ParsedFile[]
    ): { commentsPreview: number; reactionsPreview: number } => {
      let commentsPreview = 0;
      let reactionsPreview = 0;

      for (const file of files) {
        const data = file.data;
        if (!data || typeof data !== "object") continue;

        const d = data as Record<string, unknown>;
        const commentSource =
          (Array.isArray(d.comments_v2) ? d.comments_v2 : null) ??
          (Array.isArray(d.group_comments_v2) ? d.group_comments_v2 : null);

        if (commentSource) {
          commentsPreview += buildCommentItems(
            commentSource as CommentEventItem[]
          ).length;
          continue;
        }

        if (Array.isArray(data)) {
          reactionsPreview += (data as unknown[]).filter(isReactionItem).length;
        }
      }

      return { commentsPreview, reactionsPreview };
    };

    /* ========================= ZIP UPLOAD HANDLER ========================= */
    /**
     * Xử lý từng file ZIP được chọn.
     * Được gọi cho mỗi file khi Upload ở chế độ multiple.
     */
    const handleZipUpload = async (file: File) => {
      if (!file.name.endsWith(".zip")) {
        message.error(`${file.name}: chỉ hỗ trợ file .zip`);
        return Upload.LIST_IGNORE;
      }

      // Kiểm tra duplicate (cùng tên file)
      const isDuplicate = fileList.some((f) => f.uid === file.name);
      if (isDuplicate) {
        message.warning(`${file.name} đã được thêm`);
        return Upload.LIST_IGNORE;
      }

      showLoading(`reading-zip-${file.name}`);
      try {
        const zip = await JSZip.loadAsync(file);
        const collected: { name: string; content: string }[] = [];
        const collectedDirs: string[] = [];

        // ── Đệ quy đọc ZIP (kể cả nested ZIP) ──
        const collectFromZip = async (z: JSZip, prefix = "") => {
          const files = Object.values(z.files);
          for (const f of files) {
            const fullPath = (prefix + f.name).replace(/\/$/, "");
            const parts = fullPath.split("/").filter(Boolean);

            if (parts[0]?.toLowerCase() === "__macosx") continue;

            if (f.dir) {
              collectedDirs.push(fullPath);
              continue;
            }

            const lname = fullPath.toLowerCase();
            if (lname.endsWith(".json")) {
              try {
                const content = await f.async("string");
                collected.push({ name: fullPath, content });
              } catch {
                console.warn(`Skip invalid JSON: ${fullPath}`);
              }
            } else if (lname.endsWith(".zip")) {
              try {
                const blob = await f.async("arraybuffer");
                const inner = await JSZip.loadAsync(blob);
                await collectFromZip(inner, prefix + f.name + "/");
              } catch {
                console.warn(`Skip invalid nested zip: ${prefix + f.name}`);
              }
            }
          }
        };

        await collectFromZip(zip);

        if (!collected.length && !collectedDirs.length) {
          message.error(`${file.name}: ZIP không chứa file JSON`);
          return Upload.LIST_IGNORE;
        }

        // ── Xác định tên folder gốc ──
        const rootFolderName = collected.length
          ? collected[0].name.includes("/")
            ? collected[0].name.split("/")[0]
            : file.name.replace(/\.zip$/i, "")
          : collectedDirs[0]?.includes("/")
          ? collectedDirs[0].split("/")[0]
          : file.name.replace(/\.zip$/i, "");

        // ── Inner folders (dùng để nhóm khi upload) ──
        const innerSet = new Set<string>();
        for (const c of collected) {
          const parts = c.name.split("/").filter(Boolean);
          if (parts.length >= 2) innerSet.add(parts[1]);
        }
        for (const d of collectedDirs) {
          const parts = d.split("/").filter(Boolean);
          if (parts.length >= 2) innerSet.add(parts[1]);
        }

        // ── Parse JSON files ──
        let parseProgress = 0;
        const parsedFiles: ParsedFile[] = [];
        for (const entry of collected) {
          try {
            const parsed = decodeFacebookObject(
              JSON.parse(entry.content)
            ) as unknown;
            parsedFiles.push({
              name: entry.name,
              data: parsed,
              size: entry.content.length,
            });
          } catch {
            console.warn(`Skip invalid JSON: ${entry.name}`);
          }
          parseProgress++;
          setProgress(Math.round((parseProgress / collected.length) * 100));
        }

        // ── Tính preview counts ──
        const { commentsPreview, reactionsPreview } =
          computePreviewCounts(parsedFiles);

        // ── Tạo ZipJob và thêm vào danh sách ──
        const newJob: ZipJob = {
          id: `${file.name}-${Date.now()}`,
          fileName: file.name,
          accountName: rootFolderName,
          originalFolderName: rootFolderName,
          parsedFiles,
          innerFolderNames: Array.from(innerSet),
          commentsPreview,
          reactionsPreview,
        };

        setZipJobs((prev) => [...prev, newJob]);
        setFileList((prev) => [
          ...prev,
          {
            uid: file.name,
            name: file.name,
            status: "done",
            size: file.size,
          },
        ]);

        message.success(
          `${file.name}: ${commentsPreview} bình luận, ${reactionsPreview} cảm xúc`
        );
        return false;
      } catch (err) {
        console.error("Lỗi đọc ZIP:", err);
        message.error(`${file.name}: lỗi đọc file`);
        return Upload.LIST_IGNORE;
      } finally {
        closeLoading(`reading-zip-${file.name}`);
        setProgress(0);
      }
    };

    /* ========================= CONFIRM IMPORT ========================= */
    const handleConfirm = async () => {
      if (!zipJobs.length) return;

      // Yêu cầu quyền thông báo (chỉ hỏi một lần)
      await requestNotificationPermission();

      try {
        showLoading("import-data");
        setImportStep(0); // step 0: bắt đầu

        for (let jobIdx = 0; jobIdx < zipJobs.length; jobIdx++) {
          const job = zipJobs[jobIdx];
          setImportStep(1); // step 1: Phân tích (đã xong ở parse phase, chỉ hiển thị)

          // ── Nhóm files theo inner folder ──
          const groupMap: Record<string, ParsedFile[]> = {};

          for (const f of job.parsedFiles) {
            const parts = f.name.split("/").filter(Boolean);
            const groupName =
              parts.length >= 2
                ? parts[1]
                : job.accountName?.trim() || job.originalFolderName || "Unknown";

            if (!groupMap[groupName]) groupMap[groupName] = [];
            groupMap[groupName].push(f);
          }

          for (const name of job.innerFolderNames) {
            if (!groupMap[name]) groupMap[name] = [];
          }

          setImportStep(2); // step 2: Tải lên Firestore

          for (const [groupName, files] of Object.entries(groupMap)) {
            // Tạo import document qua service layer
            const importRef = await createImport({
              totalFiles: files.length,
              status: "processing",
            });

            let commentsCount = 0;
            let reactionsCount = 0;
            const allComments: ReturnType<typeof buildCommentItems> = [];
            const allReactions: ReturnType<typeof mapReactionItem>[] = [];

            for (const file of files) {
              const data = file.data;
              if (!data || typeof data !== "object") continue;

              const d = data as Record<string, unknown>;
              const commentSource =
                (Array.isArray(d.comments_v2) ? d.comments_v2 : null) ??
                (Array.isArray(d.group_comments_v2) ? d.group_comments_v2 : null);

              if (commentSource) {
                const comments = buildCommentItems(
                  commentSource as CommentEventItem[]
                );
                allComments.push(...comments);
                commentsCount += comments.length;
                continue;
              }

              if (Array.isArray(data)) {
                const reactions = (data as unknown[])
                  .filter(isReactionItem)
                  .map(mapReactionItem);
                if (!reactions.length) continue;
                allReactions.push(...reactions);
                reactionsCount += reactions.length;
              }
            }

            // Lưu comment chunks qua service layer
            const commentChunks = chunkArray(allComments, COMMENT_CHUNK_SIZE);
            if (commentChunks.length === 0) {
              await addCommentChunk(importRef.id, { index: 0, items: [], count: 0 });
            } else {
              for (let i = 0; i < commentChunks.length; i++) {
                await addCommentChunk(importRef.id, {
                  index: i,
                  items: commentChunks[i],
                  count: commentChunks[i].length,
                });
              }
            }

            // Lưu reaction chunks qua service layer
            const reactionChunks = chunkArray(allReactions, REACTION_CHUNK_SIZE);
            if (reactionChunks.length === 0) {
              await addReactionChunk(importRef.id, { index: 0, items: [], count: 0 });
            } else {
              for (let i = 0; i < reactionChunks.length; i++) {
                await addReactionChunk(importRef.id, {
                  index: i,
                  items: reactionChunks[i],
                  count: reactionChunks[i].length,
                });
              }
            }

            // Hoàn tất import — dùng accountName của job (do user đã chỉnh)
            // groupName chỉ là sub-folder name, nhưng accountName là tên chính
            await finalizeImport(importRef.id, {
              accountName: job.accountName?.trim() || groupName,
              commentsCount,
              reactionsCount,
              status: "completed",
            });
          }
        }

        setImportStep(3); // step 3: Hoàn tất

        // Brief pause so user sees "Hoàn tất" before modal closes
        await new Promise((r) => setTimeout(r, 800));

        // Thông báo trình duyệt khi import hoàn thành
        const totalJobs = zipJobs.length;
        const totalComments = zipJobs.reduce(
          (sum, j) => sum + j.commentsPreview,
          0
        );
        const totalReactions = zipJobs.reduce(
          (sum, j) => sum + j.reactionsPreview,
          0
        );
        fireNotification("Import hoàn tất", {
          body:
            totalJobs === 1
              ? `${zipJobs[0].accountName}: ${totalComments} bình luận, ${totalReactions} cảm xúc`
              : `${totalJobs} tài khoản — ${totalComments} bình luận, ${totalReactions} cảm xúc`,
          tag: "import-success",
        });

        resetState();
        message.success(
          `Import thành công ${totalJobs} tài khoản`
        );
        onImportSuccess?.();
      } catch (error) {
        setImportStep(-1);
        console.error(error);
        message.error("Import thất bại");
      } finally {
        closeLoading("import-data");
      }
    };

    /* ========================= STATE HELPERS ========================= */
    const resetState = () => {
      setZipJobs([]);
      setFileList([]);
      setProgress(0);
      setImportStep(-1);
      setOpen(false);
    };

    const removeJob = (jobId: string) => {
      const job = zipJobs.find((j) => j.id === jobId);
      if (job) {
        setZipJobs((prev) => prev.filter((j) => j.id !== jobId));
        setFileList((prev) => prev.filter((f) => f.uid !== job.fileName));
      }
    };

    const updateJobName = (jobId: string, newName: string) => {
      setZipJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, accountName: newName } : j))
      );
    };

    /* ========================= MODAL CONTROL ========================= */
    const handleModalClose = () => {
      resetState();
    };

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: () => handleModalClose(),
    }));

    /* ========================= PREVIEW TABLE ========================= */
    const previewColumns = [
      {
        title: "Tên tài khoản",
        dataIndex: "accountName",
        key: "accountName",
        render: (name: string, record: ZipJob) => (
          <Input
            size="small"
            value={name}
            onChange={(e) => updateJobName(record.id, e.target.value)}
            placeholder={record.originalFolderName}
            style={{ minWidth: 140 }}
          />
        ),
      },
      {
        title: "File ZIP",
        dataIndex: "fileName",
        key: "fileName",
        render: (name: string) => (
          <Typography.Text
            type="secondary"
            ellipsis={{ tooltip: name }}
            style={{ fontSize: 12, maxWidth: 140 }}
          >
            {name}
          </Typography.Text>
        ),
      },
      {
        title: "Bình luận",
        dataIndex: "commentsPreview",
        key: "commentsPreview",
        align: "center" as const,
        render: (n: number) => (
          <Tag color={n > 0 ? "blue" : "default"}>{n.toLocaleString("vi-VN")}</Tag>
        ),
      },
      {
        title: "Cảm xúc",
        dataIndex: "reactionsPreview",
        key: "reactionsPreview",
        align: "center" as const,
        render: (n: number) => (
          <Tag color={n > 0 ? "green" : "default"}>{n.toLocaleString("vi-VN")}</Tag>
        ),
      },
      {
        title: "",
        key: "remove",
        width: 40,
        render: (_: unknown, record: ZipJob) => (
          <Tooltip title="Bỏ khỏi danh sách">
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => removeJob(record.id)}
            />
          </Tooltip>
        ),
      },
    ];

    const totalComments = zipJobs.reduce((s, j) => s + j.commentsPreview, 0);
    const totalReactions = zipJobs.reduce((s, j) => s + j.reactionsPreview, 0);

    return (
      <Modal
        title="Import ZIP dữ liệu Facebook"
        open={open}
        onCancel={handleModalClose}
        onOk={handleConfirm}
        okText={`Import${zipJobs.length > 1 ? ` (${zipJobs.length} tài khoản)` : ""}`}
        cancelText="Hủy"
        width={680}
        okButtonProps={{ disabled: !zipJobs.length }}
        centered
      >
        {/* ── Upload area ── */}
        <div className="upload-dragger-ui">
          <div className="ant-upload ant-upload-drag">
            <div className="ant-upload ant-upload-btn">
              <Upload
                accept=".zip"
                beforeUpload={handleZipUpload}
                fileList={fileList}
                multiple
                showUploadList={false}
                onRemove={(file) => {
                  const job = zipJobs.find((j) => j.fileName === file.uid);
                  if (job) removeJob(job.id);
                }}
              >
                <Button icon={<UploadOutlined />}>Chọn file ZIP</Button>
              </Upload>
            </div>
            <p className="ant-upload-text">Nhấn để chọn một hoặc nhiều file ZIP</p>
            <p className="ant-upload-hint">
              Hỗ trợ batch import — chọn nhiều file ZIP cùng lúc
            </p>
          </div>
        </div>

        {/* ── Parse progress (chỉ hiện khi đang đọc ZIP) ── */}
        {progress > 0 && importStep === -1 && (
          <Progress
            percent={progress}
            size="small"
            style={{ marginTop: 8 }}
            strokeColor="#3ecf8e"
          />
        )}

        {/* ── Preview table — hiện sau khi có ít nhất 1 ZIP ── */}
        {zipJobs.length > 0 && importStep === -1 && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text
              strong
              style={{ display: "block", marginBottom: 8, fontSize: 13 }}
            >
              Preview import ({zipJobs.length} tài khoản —{" "}
              {totalComments.toLocaleString("vi-VN")} bình luận,{" "}
              {totalReactions.toLocaleString("vi-VN")} cảm xúc)
            </Typography.Text>
            <Table
              columns={previewColumns}
              dataSource={zipJobs}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ y: 200 }}
            />
          </div>
        )}

        {/* ── Import progress steps — only visible during active import ── */}
        {importStep >= 0 && (
          <div style={{ marginTop: 16 }}>
            <Steps
              current={importStep}
              size="small"
              status={importStep === 3 ? "finish" : "process"}
              items={[
                { title: "Chuẩn bị" },
                { title: "Phân tích" },
                { title: "Tải lên" },
                { title: "Hoàn tất" },
              ]}
            />
          </div>
        )}
      </Modal>
    );
  }
);

/* ========================= HELPERS ========================= */

function buildCommentItems(source: CommentEventItem[]) {
  return source.flatMap((item) => {
    if (Array.isArray(item.data)) {
      return item.data.map((cmt: CommentRawItem) => ({
        authorName: cmt.comment?.author ?? "",
        content: cmt.comment?.comment ?? "",
        commentTime: cmt.comment?.timestamp ?? 0,
        title: (item.title ?? "").replace(/\.+$/, ""),
        group: cmt.comment?.group ?? "",
      }));
    }
    return [
      {
        authorName: item.author ?? "",
        content: item.comment ?? "",
        commentTime: item.timestamp ?? 0,
        title: (item.title ?? "").replace(/\.+$/, ""),
        group: item.group ?? "",
      },
    ];
  });
}
