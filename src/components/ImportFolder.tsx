import { Button, Modal, Upload, message, Progress, Input } from "antd";
import { UploadOutlined } from "@ant-design/icons";
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

const COMMENT_CHUNK_SIZE = 700;
const REACTION_CHUNK_SIZE = 2000;

interface ParsedFile {
  name: string;
  data: unknown;
  size: number;
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

export const ImportZip = forwardRef<FormDrawerHandle, ImportZipProps>(
  ({ onImportSuccess }, ref) => {
    const [open, setOpen] = useState(false);
    const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
    const [innerFolderNames, setInnerFolderNames] = useState<string[]>([]);
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [progress, setProgress] = useState(0);
    const [accountNameFolder, setAccountNameFolder] = useState("");
    const [originalFolderName, setOriginalFolderName] = useState("");

    const { showLoading, closeLoading } = useLoading();

    /* ========================= ZIP UPLOAD HANDLER ========================= */
    const handleZipUpload = async (file: File) => {
      if (!file.name.endsWith(".zip")) {
        message.error("Chỉ hỗ trợ file .zip");
        return Upload.LIST_IGNORE;
      }

      showLoading("reading-zip");
      try {
        setParsedFiles([]);
        setProgress(0);

        const zip = await JSZip.loadAsync(file);
        const collected: { name: string; content: string }[] = [];
        const collectedDirs: string[] = [];

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
          message.error("ZIP không chứa file JSON");
          return Upload.LIST_IGNORE;
        }

        const rootFolderName = collected.length
          ? collected[0].name.includes("/")
            ? collected[0].name.split("/")[0]
            : file.name.replace(/\.zip$/i, "")
          : collectedDirs[0].includes("/")
          ? collectedDirs[0].split("/")[0]
          : file.name.replace(/\.zip$/i, "");

        setOriginalFolderName(rootFolderName);
        setAccountNameFolder(rootFolderName);

        const innerSet = new Set<string>();
        for (const c of collected) {
          const parts = c.name.split("/").filter(Boolean);
          if (parts.length >= 2) innerSet.add(parts[1]);
        }
        for (const d of collectedDirs) {
          const parts = d.split("/").filter(Boolean);
          if (parts.length >= 2) innerSet.add(parts[1]);
        }
        setInnerFolderNames(Array.from(innerSet));

        let loaded = 0;
        for (const entry of collected) {
          try {
            const parsed = decodeFacebookObject(
              JSON.parse(entry.content)
            ) as unknown;
            setParsedFiles((prev) => [
              ...prev,
              { name: entry.name, data: parsed, size: entry.content.length },
            ]);
          } catch {
            console.warn(`Skip invalid JSON: ${entry.name}`);
          }
          loaded++;
          setProgress(Math.round((loaded / collected.length) * 100));
        }

        setFileList([
          {
            uid: file.name,
            name: file.name,
            status: "done",
            size: file.size,
          },
        ]);

        message.success(`Đã đọc ${collected.length} file JSON`);
        return false;
      } finally {
        closeLoading("reading-zip");
      }
    };

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

    /* ========================= CONFIRM IMPORT ========================= */
    const handleConfirm = async () => {
      if (!parsedFiles.length) return;

      const groupMap: Record<string, ParsedFile[]> = {};

      for (const f of parsedFiles) {
        const parts = f.name.split("/").filter(Boolean);
        const groupName =
          parts.length >= 2
            ? parts[1]
            : accountNameFolder?.trim() || originalFolderName || "Unknown";

        if (!groupMap[groupName]) groupMap[groupName] = [];
        groupMap[groupName].push(f);
      }

      for (const name of innerFolderNames) {
        if (!groupMap[name]) groupMap[name] = [];
      }

      try {
        showLoading("import-data");

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

          // Hoàn tất import qua service layer
          await finalizeImport(importRef.id, {
            accountName: groupName,
            commentsCount,
            reactionsCount,
            status: "completed",
          });
        }

        setParsedFiles([]);
        setFileList([]);
        setProgress(0);
        setAccountNameFolder("");
        setOriginalFolderName("");
        setOpen(false);

        message.success("Import thành công");
        onImportSuccess?.();
      } catch (error) {
        console.error(error);
        message.error("Import thất bại");
      } finally {
        closeLoading("import-data");
      }
    };

    /* ========================= MODAL CONTROL ========================= */
    const handleModalClose = () => {
      setParsedFiles([]);
      setFileList([]);
      setProgress(0);
      setAccountNameFolder("");
      setOriginalFolderName("");
      setOpen(false);
    };

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: () => handleModalClose(),
    }));

    return (
      <Modal
        title="Import ZIP dữ liệu Facebook"
        open={open}
        onCancel={handleModalClose}
        onOk={handleConfirm}
        okText="Import"
        cancelText="Hủy"
        width={600}
        okButtonProps={{ disabled: !parsedFiles.length }}
        centered
      >
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "#171717",
              marginBottom: 6,
            }}
          >
            Tên tài khoản (tùy chọn)
          </label>
          <Input
            placeholder={originalFolderName || "Tên folder (mặc định)"}
            value={accountNameFolder}
            onChange={(e) => setAccountNameFolder(e.target.value)}
          />
        </div>

        <div className="upload-dragger-ui">
          <div className="ant-upload ant-upload-drag">
            <div className="ant-upload ant-upload-btn">
              <Upload
                accept=".zip"
                beforeUpload={handleZipUpload}
                fileList={fileList}
                maxCount={1}
                onRemove={() => {
                  setParsedFiles([]);
                  setFileList([]);
                  setProgress(0);
                  setAccountNameFolder("");
                  setOriginalFolderName("");
                }}
              >
                <Button icon={<UploadOutlined />}>Chọn file ZIP</Button>
              </Upload>
            </div>
            <p className="ant-upload-text">Nhấn để chọn file ZIP</p>
            <p className="ant-upload-hint">
              Chỉ hỗ trợ 1 file ZIP chứa dữ liệu Facebook Data Export
            </p>
          </div>
        </div>

        {progress > 0 && (
          <Progress percent={progress} style={{ marginTop: 12 }} />
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
