/**
 * SeedingPage — Quản lý seeding accounts, campaigns, tasks và comment library.
 *
 * Tabs:
 *   1. Chiến dịch — danh sách campaigns, tasks, export/import report
 *   2. Profiles    — quản lý GPM profiles, import CSV
 *   3. Thư viện   — comment library CRUD
 *
 * Bridge với GPM Automate qua Excel/CSV (không gọi Facebook, không gọi GPM API).
 */
import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import {
  Tabs, Table, Button, Modal, Input, Select, Form, Tag, Space,
  message, Tooltip, Upload, Dropdown, Empty, Skeleton, Progress,
  Typography, Popconfirm, DatePicker, Switch, Row, Col, Card, Alert, theme as antdTheme,
} from "antd";
import {
  PlusOutlined, DownloadOutlined, UploadOutlined, DeleteOutlined,
  EditOutlined, CopyOutlined, DownOutlined, FileExcelOutlined,
  PlayCircleOutlined, CheckCircleOutlined, PauseCircleOutlined,
  RobotOutlined, SaveOutlined, DashboardOutlined,
} from "@ant-design/icons";
import { AppLayout } from "@/layouts/AppLayout";
import {
  createCampaign, updateCampaign, deleteCampaign,
  getProfiles, createProfile, updateProfile, deleteProfile, upsertProfiles,
  getTasksByCampaign, createTasksBulk, deleteTask,
  markTasksExported, applyTaskReport,
  createSeedingComment, updateSeedingComment, deleteSeedingComment,
  subscribeCampaigns, subscribeProfiles, subscribeCommentLibrary, subscribeAllTasks,
  CAMPAIGN_STATUS_LABELS, TASK_STATUS_LABELS, ACTION_LABELS, PROFILE_STATUS_LABELS,
} from "@/service/seedingService";
import {
  exportTasksToExcel, exportTasksToCSV,
  readReportFile, readProfileFile, exportProfileTemplate,
  normalizeTaskStatus, parseFinishedAt,
} from "@/utils/seedingExport";
import {
  generateSeedingIdeasWithAI,
  planCampaignWithAI,
  generateCampaignReportWithAI,
} from "@/service/aiExtendedService";
import type { SeedingIdea } from "@/service/aiExtendedService";
import { computeSeedingStats } from "@/hooks/useSeedingStats";
import { useAuth } from "@/contexts/AuthContext";
import { AiSeedingIdeasModal } from "@/components/AiSeedingIdeasModal";
import { AiCampaignReportModal } from "@/components/AiCampaignReportModal";
import { GpmProfilesTab } from "@/components/GpmProfilesTab";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { deleteField, Timestamp } from "firebase/firestore";
import type {
  SeedingCampaign, SeedingTask, SeedingProfile, SeedingComment,
  CampaignStatus, SeedingAction, ProfileStatus, TaskStatus,
} from "@/types/seeding";

const { Text } = Typography;
const { TextArea } = Input;
const useLegacyProfilesTab = import.meta.env.VITE_USE_LEGACY_SEEDING_PROFILES === "true";

const SeedingDashboardPanel = lazy(() =>
  import("@/components/SeedingDashboardPanel").then((module) => ({
    default: module.SeedingDashboardPanel,
  }))
);

// ── Status colours ────────────────────────────────────────────────────────────

const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  scheduled: "purple",
  pending: "default", running: "processing", success: "success",
  failed: "error", skipped: "warning",
};
const CAMPAIGN_STATUS_COLOR: Record<string, string> = {
  draft: "default", active: "processing", paused: "warning", completed: "success", scheduled: "purple",
};
const PROFILE_STATUS_COLOR: Record<string, string> = {
  active: "success", inactive: "default", banned: "error",
};

function getInitialTaskStatusForCampaign(status: CampaignStatus): TaskStatus {
  return status === "active" ? "pending" : "scheduled";
}

type CampaignFormValues = {
  name: string;
  description?: string;
  status: CampaignStatus;
  targetUrl?: string;
  isScheduled?: boolean;
  scheduledAt?: Dayjs;
};

type AiPlannerFormValues = {
  goal: string;
  targetUrl: string;
  profileIds: string[];
  likeCount?: number | string;
  commentCount?: number | string;
  shareCount?: number | string;
};

type SuggestedTask = {
  key: number;
  checked: boolean;
  profileId: string;
  profileName: string;
  action: SeedingAction;
  targetUrl: string;
  commentText?: string;
  shareCaption?: string;
  delayMin: number;
  delayMax: number;
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, accent = false, color,
}: { label: string; value: number | string; accent?: boolean; color?: string }) {
  const { token } = antdTheme.useToken();
  return (
    <div style={{
      background: token.colorBgContainer,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderLeft: `3px solid ${accent ? "#3ecf8e" : (color ?? token.colorBorderSecondary)}`,
      borderRadius: 8, padding: "12px 16px", flex: 1, minWidth: 100,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: token.colorText, letterSpacing: "-0.02em", fontFamily: "ui-monospace, monospace" }}>
        {value}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════════

function CampaignsTab({
  isAdmin,
  profileStatsMap,
}: {
  isAdmin: boolean;
  profileStatsMap: Record<string, { success: number; failed: number; rate: number; total: number }>;
}) {
  const { token } = antdTheme.useToken();
  const [campaigns, setCampaigns] = useState<SeedingCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected campaign for task management
  const [selectedCampaign, setSelectedCampaign] = useState<SeedingCampaign | null>(null);
  const [tasks, setTasks] = useState<SeedingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  // Campaign form modal
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<SeedingCampaign | null>(null);
  const [campaignForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // Bulk task creation modal
  const [bulkTaskOpen, setBulkTaskOpen] = useState(false);
  const [profiles, setProfiles] = useState<SeedingProfile[]>([]);
  const [bulkForm] = Form.useForm();
  const [bulkSaving, setBulkSaving] = useState(false);

  // ── F1: AI gợi ý nội dung bình luận ──────────────────────────────────────
  const [aiModalOpen,  setAiModalOpen]  = useState(false);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiIdeas,      setAiIdeas]      = useState<SeedingIdea[]>([]);
  const [aiTopic,      setAiTopic]      = useState("");
  const [aiSavedIds,   setAiSavedIds]   = useState<Set<string>>(new Set());

  /** Gọi AI tạo ý tưởng seeding dựa trên chủ đề người dùng nhập */
  const handleGenerateIdeas = async () => {
    setAiLoading(true);
    setAiIdeas([]);
    const topic = aiTopic.trim() || bulkForm.getFieldValue("targetUrl") || "nội dung seeding Facebook";
    const fakeComments = [{ id: "ctx", content: topic }];
    try {
      const res = await generateSeedingIdeasWithAI(fakeComments, selectedCampaign?.name);
      if (res.error) {
        message.error(`AI lỗi: ${res.error}`);
      } else {
        setAiIdeas(res.ideas);
        if (res.ideas.length === 0) message.info("AI không tạo được gợi ý. Thử mô tả chi tiết hơn.");
      }
    } catch {
      message.error("Không kết nối được AI. Hãy kiểm tra cấu hình.");
    } finally {
      setAiLoading(false);
    }
  };

  /** Điền text gợi ý vào ô commentText rồi đóng modal AI */
  const handleUseIdea = (idea: SeedingIdea) => {
    bulkForm.setFieldValue("commentText", idea.description);
    setAiModalOpen(false);
    message.success("Đã điền nội dung vào ô bình luận");
  };

  /** Lưu ý tưởng vào thư viện seedingComments */
  const handleSaveIdeaToLibrary = async (idea: SeedingIdea, index: number) => {
    try {
      await createSeedingComment({
        text: idea.description,
        tags: [idea.format, "ai-generated"],
      });
      setAiSavedIds((prev) => new Set(prev).add(String(index)));
      message.success("Đã lưu vào thư viện bình luận ✓");
    } catch {
      message.error("Lưu thư viện thất bại");
    }
  };
  // ────────────────────────────────────────────────────────────────────────────

  // Report import
  const [importReportOpen, setImportReportOpen] = useState(false);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [importingSaving, setImportingSaving] = useState(false);

  // FIX #12: Dùng onSnapshot để subscribe realtime thay vì getDocs one-shot
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeCampaigns((data) => {
      setCampaigns(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openTaskManager = async (campaign: SeedingCampaign) => {
    setSelectedCampaign(campaign);
    setTaskModalOpen(true);
    setTasksLoading(true);
    try {
      setTasks(await getTasksByCampaign(campaign.id));
    } catch { message.error("Không tải được tasks"); }
    finally { setTasksLoading(false); }
  };

  const openBulkTask = async (campaign: SeedingCampaign) => {
    setSelectedCampaign(campaign);
    if (profiles.length === 0) {
      try { setProfiles(await getProfiles()); } catch {/* ignore */}
    }
    setBulkTaskOpen(true);
    window.setTimeout(() => {
      bulkForm.resetFields();
      bulkForm.setFieldsValue({ targetUrl: campaign.targetUrl ?? "", delayMin: 5, delayMax: 15 });
    }, 0);
  };

  const handleBulkCreate = async () => {
    if (!selectedCampaign) return;
    try {
      const values = await bulkForm.validateFields() as {
        profileIds: string[]; action: SeedingAction;
        targetUrl: string; commentText?: string; shareCaption?: string;
        delayMin: number; delayMax: number;
      };
      setBulkSaving(true);
      const selectedProfiles = profiles.filter((p) => values.profileIds.includes(p.id));
      const newTasks = selectedProfiles.map((p) => {
        const task: Omit<SeedingTask, "id" | "createdAt" | "status" | "finishedAt" | "exportedAt" | "errorMessage"> = {
          campaignId:  selectedCampaign.id,
          profileId:   p.profileId,
          profileName: p.profileName,
          action:      values.action,
          targetUrl:   values.targetUrl.trim(),
          delayMin:    Number(values.delayMin),
          delayMax:    Number(values.delayMax),
          totalFiles:  0,
        };
        const commentText = values.commentText?.trim();
        const shareCaption = values.shareCaption?.trim();
        if (values.action === "comment" && commentText) task.commentText = commentText;
        if (values.action === "share" && shareCaption) task.shareCaption = shareCaption;
        return task;
      });
      await createTasksBulk(newTasks, getInitialTaskStatusForCampaign(selectedCampaign.status));
      message.success(`Đã tạo ${newTasks.length} tasks`);
      setBulkTaskOpen(false);
      // Refresh tasks nếu modal đang mở
      if (taskModalOpen && selectedCampaign) {
        setTasks(await getTasksByCampaign(selectedCampaign.id));
      }
    } catch (err) {
      console.error("[SeedingPage] bulk task creation failed:", err);
      message.error("Tạo tasks thất bại. Kiểm tra lại profiles/action/URL và thử lại.");
    }
    finally { setBulkSaving(false); }
  };

  const handleExportExcel = async (campaign: SeedingCampaign) => {
    try {
      const t = await getTasksByCampaign(campaign.id);
      if (t.length === 0) { message.warning("Không có tasks để export"); return; }
      const ids = await exportTasksToExcel(t, campaign.name);
      if (ids.length > 0) await markTasksExported(ids);
      message.success(`Đã export ${ids.length} tasks`);
    } catch { message.error("Export thất bại"); }
  };

  const handleExportCSV = async (campaign: SeedingCampaign) => {
    try {
      const t = await getTasksByCampaign(campaign.id);
      if (t.length === 0) { message.warning("Không có tasks để export"); return; }
      const ids = exportTasksToCSV(t, campaign.name);
      if (ids.length > 0) await markTasksExported(ids);
      message.success(`Đã export ${ids.length} tasks (CSV)`);
    } catch { message.error("Export thất bại"); }
  };

  const openImportReport = (campaign: SeedingCampaign) => {
    setSelectedCampaign(campaign);
    setReportFile(null);
    setImportReportOpen(true);
  };

  const handleImportReport = async () => {
    if (!reportFile || !selectedCampaign) return;
    setImportingSaving(true);
    try {
      const rows = await readReportFile(reportFile);
      if (rows.length === 0) { message.warning("File không có dữ liệu"); return; }

      // Match theo task_id (document ID)
      const updates = rows.map((r) => ({
        id:           r.task_id,
        status:       normalizeTaskStatus(r.status),
        errorMessage: r.error_message || undefined,
        finishedAt:   parseFinishedAt(r.finished_at),
      }));

      const count = await applyTaskReport(updates);
      message.success(`Đã cập nhật ${count} tasks từ report`);
      setImportReportOpen(false);
      // Refresh nếu đang xem tasks
      if (taskModalOpen && selectedCampaign) {
        setTasks(await getTasksByCampaign(selectedCampaign.id));
      }
    } catch (e) {
      message.error(`Import thất bại: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setImportingSaving(false); }
  };

  // Template and AI report states
  const [isScheduledSwitch, setIsScheduledSwitch] = useState(false);
  const [templates, setTemplates] = useState<SeedingCampaign[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportCampaign, setReportCampaign] = useState<SeedingCampaign | null>(null);

  useEffect(() => {
    const tmps = campaigns.filter((c) => c.isTemplate);
    setTemplates(tmps);
  }, [campaigns]);

  const handleTemplateSelect = (val: string) => {
    const t = templates.find((item) => item.id === val);
    if (t) {
      setSelectedTemplateId(t.id);
      campaignForm.setFieldsValue({
        name: `${t.name} (Copy)`,
        description: t.description,
        targetUrl: t.targetUrl,
      });
    }
  };

  const handleSaveAsTemplate = async (campaign: SeedingCampaign) => {
    try {
      await updateCampaign(campaign.id, { isTemplate: true });
      message.success(`Đã lưu chiến dịch "${campaign.name}" thành chiến dịch mẫu (Template)`);
    } catch {
      message.error("Lưu template thất bại");
    }
  };

  const handleOpenAiReport = async (campaign: SeedingCampaign) => {
    setReportCampaign(campaign);
    setReportOpen(true);
    setReportLoading(true);
    setReportText("");
    try {
      const campaignTasks = await getTasksByCampaign(campaign.id);
      if (campaignTasks.length === 0) {
        setReportText("Chiến dịch này chưa có task nào để phân tích.");
        setReportLoading(false);
        return;
      }
      const res = await generateCampaignReportWithAI(campaign.name, campaign.targetUrl || "", campaignTasks);
      if (res.error) {
        message.error(`AI lỗi: ${res.error}`);
        setReportText(`Không thể tạo báo cáo. Lỗi: ${res.error}`);
      } else {
        setReportText(res.report);
      }
    } catch {
      message.error("Không kết nối được AI để lập báo cáo.");
      setReportText("Kết nối AI thất bại. Vui lòng kiểm tra VITE_GEMINI_API_KEY.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleSaveCampaign = async () => {
    const values = await campaignForm.validateFields() as CampaignFormValues;
    setSaving(true);
    try {
      const isScheduledVal = !!values.isScheduled;
      const scheduledTimestamp = isScheduledVal && values.scheduledAt
        ? Timestamp.fromDate(values.scheduledAt.toDate())
        : null;
      const nextStatus: CampaignStatus = isScheduledVal ? "scheduled" : (values.status ?? "draft");
      const campaignPayload = {
        name: values.name,
        description: values.description ?? "",
        status: nextStatus,
        targetUrl: values.targetUrl ?? "",
      };

      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, {
          ...campaignPayload,
          scheduledAt: scheduledTimestamp ?? deleteField(),
        });
        message.success("Đã cập nhật campaign");
      } else {
        const newCampaign = await createCampaign(
          scheduledTimestamp
            ? { ...campaignPayload, scheduledAt: scheduledTimestamp }
            : campaignPayload
        );

        // Copy tasks từ template nếu có chọn
        if (selectedTemplateId) {
          const templateTasks = await getTasksByCampaign(selectedTemplateId);
          if (templateTasks.length > 0) {
            const newTasks = templateTasks.map((t) => ({
              campaignId: newCampaign.id,
              profileId: t.profileId,
              profileName: t.profileName,
              action: t.action,
              targetUrl: newCampaign.targetUrl || t.targetUrl,
              commentText: t.commentText ?? "",
              shareCaption: t.shareCaption ?? "",
              delayMin: t.delayMin,
              delayMax: t.delayMax,
              totalFiles: t.totalFiles || 0,
            }));
            await createTasksBulk(newTasks, getInitialTaskStatusForCampaign(nextStatus));
            message.success(`Đã sao chép ${newTasks.length} tasks mẫu từ Template vào chiến dịch mới`);
          }
        }
        message.success("Đã tạo campaign");
      }
      setCampaignFormOpen(false);
    } catch (err: unknown) {
      console.error(err);
      message.error("Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      await deleteCampaign(id);
      message.success("Đã xóa campaign");
    } catch { message.error("Xóa thất bại"); }
  };

  const handleStartCampaignAuto = async (campaign: SeedingCampaign) => {
    try {
      const campaignTasks = await getTasksByCampaign(campaign.id);
      const pendingTasks = campaignTasks.filter((t) => t.status !== "success");
      
      if (pendingTasks.length === 0) {
        message.warning("Không có tasks nào cần chạy (tất cả đã thành công hoặc chiến dịch trống).");
        return;
      }

      message.loading("Đang kích hoạt chiến dịch và đưa các tasks vào trạng thái chờ...", 0);

      // 1. Cập nhật trạng thái chiến dịch sang active
      await updateCampaign(campaign.id, { status: "active" });

      // 2. Chuyển tất cả các task chưa thành công sang pending để Bridge Agent chạy
      const updates = pendingTasks.map((t) => ({
        id: t.id,
        status: "pending" as TaskStatus,
        errorMessage: "", // Xóa lỗi cũ để chạy sạch
      }));
      await applyTaskReport(updates);

      message.destroy();
      message.success("Chiến dịch đã được kích hoạt chạy tự động qua GPM Bridge!");
    } catch (err) {
      console.error(err);
      message.destroy();
      message.error("Không thể kích hoạt chạy tự động chiến dịch.");
    }
  };

  const handlePauseCampaignAuto = async (campaign: SeedingCampaign) => {
    try {
      message.loading("Đang tạm dừng chiến dịch và thu hồi các tasks đang chờ...", 0);

      // 1. Cập nhật trạng thái chiến dịch sang paused
      await updateCampaign(campaign.id, { status: "paused" });

      // 2. Chuyển tất cả các task đang pending hoặc running sang skipped để GPM Bridge dừng xử lý
      const campaignTasks = await getTasksByCampaign(campaign.id);
      const pendingTasks = campaignTasks.filter((t) => t.status === "pending" || t.status === "running");
      
      const updates = pendingTasks.map((t) => ({
        id: t.id,
        status: "skipped" as TaskStatus,
        errorMessage: "Tạm dừng do người dùng yêu cầu",
      }));
      await applyTaskReport(updates);

      message.destroy();
      message.success("Đã tạm dừng chiến dịch và chuyển các tasks đang chờ sang trạng thái Bỏ qua.");
    } catch (err) {
      console.error(err);
      message.destroy();
      message.error("Không thể tạm dừng chiến dịch.");
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteTask(id);
      if (selectedCampaign) {
        setTasks(await getTasksByCampaign(selectedCampaign.id));
      }
    } catch { message.error("Xóa task thất bại"); }
  };

  // Overall stats across all campaigns
  const allStatsPlaceholder = useMemo(() => ({ total: campaigns.length }), [campaigns]);

  const sortedProfilesForSelect = useMemo(() => {
    return [...profiles]
      .filter((p) => p.status === "active")
      .sort((a, b) => {
        const statsA = profileStatsMap[a.profileId];
        const statsB = profileStatsMap[b.profileId];
        const rateA = statsA?.rate ?? 100;
        const rateB = statsB?.rate ?? 100;
        if (rateB !== rateA) return rateB - rateA;
        const totalA = statsA?.total ?? 0;
        const totalB = statsB?.total ?? 0;
        if (totalB !== totalA) return totalB - totalA;
        return a.profileName.localeCompare(b.profileName, "vi");
      });
  }, [profiles, profileStatsMap]);

  const campaignColumns = [
    {
      title: "Tên chiến dịch",
      dataIndex: "name",
      sorter: (a: SeedingCampaign, b: SeedingCampaign) => a.name.localeCompare(b.name, "vi"),
      render: (name: string, r: SeedingCampaign) => (
        <div>
          <div style={{ fontWeight: 600, color: "#171717", fontSize: 13 }}>{name}</div>
          {r.description && (
            <div style={{ fontSize: 12, color: "#8a8a8a", marginTop: 2 }}>{r.description}</div>
          )}
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 140,
      sorter: (a: SeedingCampaign, b: SeedingCampaign) => a.status.localeCompare(b.status),
      render: (s: CampaignStatus, r: SeedingCampaign) => (
        <Space direction="vertical" size={2}>
          <Tag color={CAMPAIGN_STATUS_COLOR[s]} style={{ fontSize: 11, borderRadius: 4, border: "none", margin: 0 }}>
            {CAMPAIGN_STATUS_LABELS[s]}
          </Tag>
          {s === "scheduled" && r.scheduledAt && (
            <div style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 500 }}>
              ⏱️ {dayjs(r.scheduledAt.seconds * 1000).format("DD/MM HH:mm")}
            </div>
          )}
          {r.isTemplate && (
            <Tag color="gold" style={{ fontSize: 10, borderRadius: 4, border: "none", margin: 0 }}>
              Mẫu
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Target URL",
      dataIndex: "targetUrl",
      width: 200,
      render: (url: string) =>
        url ? (
          <Text ellipsis={{ tooltip: url }} style={{ fontSize: 12, color: "#6b6b6b", maxWidth: 200 }}>
            {url}
          </Text>
        ) : <span style={{ color: "#b2b2b2" }}>—</span>,
    },
    ...(isAdmin ? [{
      title: "",
      key: "actions",
      width: 320,
      render: (_: unknown, r: SeedingCampaign) => {
        const exportMenu = {
          items: [
            { key: "excel", label: "Excel (.xlsx)", icon: <FileExcelOutlined /> },
            { key: "csv",   label: "CSV (.csv)" },
          ],
          onClick: ({ key }: { key: string }) => {
            if (key === "excel") handleExportExcel(r);
            else handleExportCSV(r);
          },
        };
        const isRunActive = r.status === "active";
        const isScheduled = r.status === "scheduled";
        return (
          <Space size={4} wrap>
            {isRunActive ? (
              <Button
                size="small"
                danger
                icon={<PauseCircleOutlined />}
                onClick={() => handlePauseCampaignAuto(r)}
                title="Tạm dừng chạy tự động"
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                Tạm dừng
              </Button>
            ) : (
              r.status !== "completed" && (
                <Popconfirm
                  title={isScheduled ? "Kích hoạt chạy ngay chiến dịch hẹn giờ này?" : "Chạy tự động các tasks chưa hoàn thành của chiến dịch này qua GPM Bridge?"}
                  onConfirm={() => handleStartCampaignAuto(r)}
                  okText="Chạy"
                  cancelText="Hủy"
                >
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    style={{ background: "#10b981", borderColor: "#10b981", display: "inline-flex", alignItems: "center" }}
                    title="Chạy tự động bằng GPM Bridge"
                  >
                    Chạy GPM
                  </Button>
                </Popconfirm>
              )
            )}
            <Button size="small" onClick={() => openTaskManager(r)}>Tasks</Button>
            <Button size="small" icon={<PlusOutlined />} onClick={() => openBulkTask(r)}>Thêm</Button>
            <Dropdown menu={exportMenu} trigger={["click"]}>
              <Button size="small" icon={<DownloadOutlined />}>
                Export <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
            <Button size="small" icon={<UploadOutlined />} onClick={() => openImportReport(r)}>Report</Button>

            <Button
              size="small"
              icon={<RobotOutlined />}
              style={{ background: "#8b5cf6", color: "#fff", borderColor: "#8b5cf6" }}
              onClick={() => handleOpenAiReport(r)}
            >
              Báo cáo AI
            </Button>

            {!r.isTemplate ? (
              <Popconfirm
                title="Lưu chiến dịch này làm Chiến dịch mẫu (Template)?"
                onConfirm={() => handleSaveAsTemplate(r)}
                okText="Lưu"
                cancelText="Hủy"
              >
                <Button size="small" icon={<SaveOutlined />} title="Lưu thành Template" />
              </Popconfirm>
            ) : (
              <Tag color="gold" style={{ fontSize: 10, margin: 0, height: 22, display: "inline-flex", alignItems: "center" }}>Mẫu</Tag>
            )}

            <Tooltip title="Sửa">
              <Button size="small" icon={<EditOutlined />} onClick={() => {
                setEditingCampaign(r);
                setSelectedTemplateId(undefined);
                setIsScheduledSwitch(!!r.scheduledAt);
                campaignForm.setFieldsValue({
                  ...r,
                  scheduledAt: r.scheduledAt ? dayjs(r.scheduledAt.seconds * 1000) : null,
                  isScheduled: !!r.scheduledAt,
                });
                setCampaignFormOpen(true);
              }} />
            </Tooltip>
            <Popconfirm title="Xóa campaign và tất cả tasks?" onConfirm={() => handleDeleteCampaign(r.id)} okType="danger" okText="Xóa" cancelText="Hủy">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    }] : []),
  ];

  const taskColumns = [
    { title: "Profile", dataIndex: "profileName", render: (n: string, r: SeedingTask) =>
      <div><div style={{ fontSize: 12, fontWeight: 500 }}>{n}</div><div style={{ fontSize: 11, color: "#8a8a8a" }}>{r.profileId}</div></div> },
    { title: "Action", dataIndex: "action", width: 90, render: (a: SeedingAction) =>
      <Tag color={a === "like" ? "blue" : a === "comment" ? "green" : "orange"} style={{ fontSize: 11, border: "none", borderRadius: 4 }}>
        {ACTION_LABELS[a]}
      </Tag> },
    { title: "Target URL", dataIndex: "targetUrl", render: (u: string) =>
      <Text ellipsis={{ tooltip: u }} style={{ fontSize: 12, color: "#6b6b6b", maxWidth: 200 }}>{u}</Text> },
    { title: "Status", dataIndex: "status", width: 110, render: (s: TaskStatus) =>
      <Tag color={TASK_STATUS_COLOR[s]} style={{ fontSize: 11, border: "none", borderRadius: 4 }}>
        {TASK_STATUS_LABELS[s]}
      </Tag> },
    { title: "Delay (s)", dataIndex: "delayMin", width: 90, render: (_: number, r: SeedingTask) =>
      <span style={{ fontSize: 12, color: "#6b6b6b" }}>{r.delayMin}–{r.delayMax}</span> },
    ...(isAdmin ? [{
      title: "", key: "del", width: 40,
      render: (_: unknown, r: SeedingTask) => (
        <Popconfirm title="Xóa task?" onConfirm={() => handleDeleteTask(r.id)} okType="danger" okText="Xóa" cancelText="Hủy">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    }] : []),
  ];

  const taskStats = useMemo(() => computeSeedingStats(tasks), [tasks]);

  return (
    <>
      {/* Header actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatCard label="Campaigns" value={allStatsPlaceholder.total} accent />
        </div>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditingCampaign(null);
            campaignForm.resetFields();
            campaignForm.setFieldsValue({ status: "draft" });
            setCampaignFormOpen(true);
          }}>
            Tạo chiến dịch
          </Button>
        )}
      </div>

      {/* Campaign table */}
      <div style={{ background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 4 }} /></div>
        ) : campaigns.length === 0 ? (
          <Empty description="Chưa có chiến dịch nào" style={{ padding: "48px 0" }} />
        ) : (
          <Table columns={campaignColumns} dataSource={campaigns} rowKey="id" size="small" pagination={false} />
        )}
      </div>

      {/* Campaign form modal */}
      <Modal title={editingCampaign ? "Sửa chiến dịch" : "Tạo chiến dịch mới"}
        open={campaignFormOpen} onCancel={() => setCampaignFormOpen(false)}
        onOk={handleSaveCampaign} confirmLoading={saving} centered okText="Lưu" cancelText="Hủy">
        {campaignFormOpen && (
          <Form form={campaignForm} layout="vertical" style={{ marginTop: 8 }}>
            {!editingCampaign && templates.length > 0 && (
              <Form.Item label="Sử dụng Chiến dịch mẫu (Template)">
                <Select
                  placeholder="Chọn template có sẵn..."
                  onChange={handleTemplateSelect}
                  allowClear
                  onClear={() => setSelectedTemplateId(undefined)}
                >
                  {templates.map((t) => (
                    <Select.Option key={t.id} value={t.id}>
                      {t.name} ({t.targetUrl ? "Có Target URL" : "Không Target URL"})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            <Form.Item name="name" label="Tên chiến dịch" rules={[{ required: true, message: "Nhập tên" }]}>
              <Input placeholder="VD: Like bài tháng 6" />
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <Input placeholder="Ghi chú thêm (tuỳ chọn)" />
            </Form.Item>

            <Form.Item name="isScheduled" label="Hẹn giờ chạy tự động" valuePropName="checked">
              <Switch onChange={(checked) => setIsScheduledSwitch(checked)} />
            </Form.Item>

            {isScheduledSwitch ? (
              <Form.Item name="scheduledAt" label="Thời gian hẹn giờ chạy" rules={[{ required: true, message: "Chọn thời gian chạy" }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: "100%" }} />
              </Form.Item>
            ) : (
              <Form.Item name="status" label="Trạng thái">
                <Select>
                  {(Object.entries(CAMPAIGN_STATUS_LABELS) as [CampaignStatus, string][]).filter(([k]) => k !== "scheduled").map(([k, v]) => (
                    <Select.Option key={k} value={k}>{v}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            <Form.Item name="targetUrl" label="Target URL mặc định">
              <Input placeholder="https://facebook.com/..." />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Bulk task creation */}
      <Modal title={`Thêm tasks — ${selectedCampaign?.name ?? ""}`}
        open={bulkTaskOpen} onCancel={() => setBulkTaskOpen(false)}
        onOk={handleBulkCreate} confirmLoading={bulkSaving} centered
        okText="Tạo tasks" cancelText="Hủy" width={560}>
        {bulkTaskOpen && (
          <Form form={bulkForm} layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item name="profileIds" label="Chọn profiles" rules={[{ required: true, message: "Chọn ít nhất 1 profile" }]}>
              <Select mode="multiple" placeholder="Chọn profiles..." allowClear maxTagCount={2} style={{ width: "100%" }}>
                {sortedProfilesForSelect.map((p) => {
                  const stats = profileStatsMap[p.profileId];
                  const efficiencyText = stats && stats.total > 0
                    ? ` (Hiệu quả: ${stats.rate}% — ${stats.success}/${stats.success + stats.failed} OK)`
                    : " (Mới)";
                  return (
                    <Select.Option key={p.id} value={p.id}>
                      {p.profileName} ({p.profileId}){efficiencyText}
                    </Select.Option>
                  );
                })}
              </Select>
            </Form.Item>
            <Form.Item name="action" label="Hành động" rules={[{ required: true }]}>
              <Select placeholder="Chọn action">
                <Select.Option value="like">Like</Select.Option>
                <Select.Option value="comment">Comment</Select.Option>
                <Select.Option value="share">Share</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="targetUrl" label="Target URL" rules={[{ required: true, message: "Nhập URL" }]}>
              <Input placeholder="https://facebook.com/..." />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.action !== cur.action}>
              {({ getFieldValue }) =>
                getFieldValue("action") === "comment" ? (
                  <Form.Item
                    name="commentText"
                    label={
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        Nội dung comment
                        <Button
                          size="small"
                          type="link"
                          style={{ padding: 0, fontSize: 12, color: "#3ecf8e", fontWeight: 600 }}
                          onClick={() => {
                            setAiTopic("");
                            setAiIdeas([]);
                            setAiSavedIds(new Set());
                            setAiModalOpen(true);
                          }}
                        >
                          ✨ AI gợi ý
                        </Button>
                      </span>
                    }
                  >
                    <TextArea rows={2} placeholder="Nhập nội dung hoặc dùng AI gợi ý..." />
                  </Form.Item>
                ) : getFieldValue("action") === "share" ? (
                  <Form.Item name="shareCaption" label="Share caption">
                    <Input placeholder="Caption khi share..." />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
            <div style={{ display: "flex", gap: 12 }}>
              <Form.Item name="delayMin" label="Delay min (s)" style={{ flex: 1 }} rules={[{ required: true }]}>
                <Input type="number" min={1} />
              </Form.Item>
              <Form.Item name="delayMax" label="Delay max (s)" style={{ flex: 1 }} rules={[{ required: true }]}>
                <Input type="number" min={1} />
              </Form.Item>
            </div>
          </Form>
        )}
      </Modal>

      {/* ── F1: AI Gợi ý nội dung bình luận ─────────────────────────────── */}
      <AiSeedingIdeasModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        topic={aiTopic}
        onTopicChange={setAiTopic}
        loading={aiLoading}
        ideas={aiIdeas}
        savedIds={aiSavedIds}
        onGenerate={handleGenerateIdeas}
        onUse={handleUseIdea}
        onSave={handleSaveIdeaToLibrary}
        campaignName={selectedCampaign?.name}
      />
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* Task manager modal */}
      <Modal title={`Tasks — ${selectedCampaign?.name ?? ""}`}
        open={taskModalOpen} onCancel={() => setTaskModalOpen(false)}
        footer={null} centered width={860}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <StatCard label="Total"   value={taskStats.total}       />
          <StatCard label="Pending" value={taskStats.pending}     />
          <StatCard label="Success" value={taskStats.success} accent />
          <StatCard label="Failed"  value={taskStats.failed} color="#dc2626"  />
          <StatCard label="Rate"    value={`${taskStats.successRate}%`} accent={taskStats.successRate >= 70} />
        </div>
        {/* Success rate bar */}
        {taskStats.total > 0 && (
          <Progress
            percent={taskStats.successRate}
            size="small"
            strokeColor={taskStats.successRate >= 70 ? "#3ecf8e" : taskStats.successRate >= 40 ? "#f59e0b" : "#dc2626"}
            style={{ marginBottom: 12 }}
            aria-label="Tỷ lệ thành công của chiến dịch"
          />
        )}
        {tasksLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : tasks.length === 0 ? (
          <Empty description="Chưa có tasks" style={{ padding: "32px 0" }} />
        ) : (
          <Table columns={taskColumns} dataSource={tasks} rowKey="id" size="small"
            pagination={{ pageSize: 10, size: "small" }} scroll={{ x: 640 }} />
        )}
      </Modal>

      {/* Import report modal */}
      <Modal title={`Import Report — ${selectedCampaign?.name ?? ""}`}
        open={importReportOpen} onCancel={() => setImportReportOpen(false)}
        onOk={handleImportReport} confirmLoading={importingSaving}
        centered okText="Import" cancelText="Hủy"
        okButtonProps={{ disabled: !reportFile }}>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: "#6b6b6b", marginBottom: 12 }}>
            Upload file Excel/CSV report từ GPM Automate. Cột bắt buộc: <strong>task_id</strong>, <strong>status</strong>.
          </div>
          <Upload
            accept=".xlsx,.xls,.csv"
            maxCount={1}
            beforeUpload={(file) => { setReportFile(file); return false; }}
            onRemove={() => setReportFile(null)}
          >
            <Button icon={<UploadOutlined />}>Chọn file report</Button>
          </Upload>
          {reportFile && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#3ecf8e" }}>
              Đã chọn: {reportFile.name}
            </div>
          )}
        </div>
      </Modal>

      {/* AI Campaign Report Modal */}
      <AiCampaignReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        loading={reportLoading}
        reportText={reportText}
        campaignName={reportCampaign?.name}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: PROFILES
// ═══════════════════════════════════════════════════════════════════════════════

function ProfilesTab({
  isAdmin,
  profileStatsMap,
}: {
  isAdmin: boolean;
  profileStatsMap: Record<string, { success: number; failed: number; rate: number; total: number }>;
}) {
  const [profiles, setProfiles] = useState<SeedingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SeedingProfile | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");

  const handleSeedData = async () => {
    try {
      message.loading("Đang tạo dữ liệu seeding mẫu...", 0);
      
      // 1. Tạo profiles
      const p1 = await createProfile({ profileId: "profile_001", profileName: "Nguyễn Văn A", status: "active", note: "Profile chuyên nghiệp" });
      const p2 = await createProfile({ profileId: "profile_002", profileName: "Trần Thị B", status: "active", note: "Profile dự phòng" });
      await createProfile({ profileId: "profile_003", profileName: "Lê Văn C", status: "active", note: "Tài khoản mới tinh" });

      // 2. Tạo campaign
      const camp = await createCampaign({ name: "Chiến dịch Seed Data mẫu", status: "active", targetUrl: "https://facebook.com/post/demo_efficiency" });

      // 3. Tạo tasks cho profile 1 (8 success, 2 failed)
      const tasksP1 = Array.from({ length: 10 }).map((_, idx) => ({
        campaignId: camp.id,
        profileId: p1.profileId,
        profileName: p1.profileName,
        action: "like" as const,
        targetUrl: `https://facebook.com/post/demo_efficiency/p1_${idx}`,
        delayMin: 5,
        delayMax: 15,
      }));

      // Tạo tasks cho profile 2 (1 success, 4 failed)
      const tasksP2 = Array.from({ length: 5 }).map((_, idx) => ({
        campaignId: camp.id,
        profileId: p2.profileId,
        profileName: p2.profileName,
        action: "comment" as const,
        targetUrl: `https://facebook.com/post/demo_efficiency/p2_${idx}`,
        commentText: "Dịch vụ quá tuyệt vời!",
        delayMin: 5,
        delayMax: 15,
      }));

      await createTasksBulk([...tasksP1, ...tasksP2]);

      // Lấy tasks của campaign đó để gán status
      const campTasks = await getTasksByCampaign(camp.id);
      const updates: Array<{ id: string; status: TaskStatus; errorMessage?: string }> = [];

      const p1Tasks = campTasks.filter((t) => t.profileId === p1.profileId);
      p1Tasks.slice(0, 8).forEach((t) => updates.push({ id: t.id, status: "success" }));
      p1Tasks.slice(8, 10).forEach((t) => updates.push({ id: t.id, status: "failed", errorMessage: "Lỗi mở trình duyệt" }));

      const p2Tasks = campTasks.filter((t) => t.profileId === p2.profileId);
      p2Tasks.slice(0, 1).forEach((t) => updates.push({ id: t.id, status: "success" }));
      p2Tasks.slice(1, 5).forEach((t) => updates.push({ id: t.id, status: "failed", errorMessage: "Checkpoint tài khoản" }));

      await applyTaskReport(updates);

      message.destroy();
      message.success("Đã tạo thành công dữ liệu seeding mẫu!");
    } catch (err) {
      message.destroy();
      message.error("Lỗi khi seed data: " + String(err));
    }
  };

  // FIX #12: Subscribe realtime
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeProfiles((data) => {
      setProfiles(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = profiles;
    if (q) {
      result = profiles.filter((p) =>
        p.profileName.toLowerCase().includes(q) || p.profileId.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      const statsA = profileStatsMap[a.profileId];
      const statsB = profileStatsMap[b.profileId];
      const rateA = statsA?.rate ?? 100;
      const rateB = statsB?.rate ?? 100;
      if (rateB !== rateA) return rateB - rateA;
      const totalA = statsA?.total ?? 0;
      const totalB = statsB?.total ?? 0;
      if (totalB !== totalA) return totalB - totalA;
      return a.profileName.localeCompare(b.profileName, "vi");
    });
  }, [profiles, search, profileStatsMap]);

  const stats = useMemo(() => ({
    total:    profiles.length,
    active:   profiles.filter((p) => p.status === "active").length,
    inactive: profiles.filter((p) => p.status === "inactive").length,
    banned:   profiles.filter((p) => p.status === "banned").length,
  }), [profiles]);

  const handleSave = async () => {
    const values = await form.validateFields() as {
      profileId: string; profileName: string; status: ProfileStatus; note?: string;
    };
    setSaving(true);
    try {
      if (editingProfile) {
        await updateProfile(editingProfile.id, { ...values });
        message.success("Đã cập nhật");
      } else {
        await createProfile({ ...values });
        message.success("Đã thêm profile");
      }
      setFormOpen(false);
    } catch { message.error("Lưu thất bại"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteProfile(id); message.success("Đã xóa"); }
    catch { message.error("Xóa thất bại"); }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const rows = await readProfileFile(importFile);
      if (rows.length === 0) { message.warning("File không có dữ liệu hợp lệ"); return; }
      const count = await upsertProfiles(rows.map((r) => ({
        profileId:   r.profile_id,
        profileName: r.profile_name,
        status:      (r.status === "active" || r.status === "inactive" || r.status === "banned")
                       ? r.status : "active",
        note:        r.note,
      })));
      message.success(`Đã import/cập nhật ${count} profiles`);
      setImportOpen(false);
    } catch (e) {
      message.error(`Import thất bại: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setImporting(false); }
  };

  const columns = [
    { title: "Profile ID", dataIndex: "profileId", render: (id: string) =>
      <code style={{ fontSize: 12, background: "#f4f4f4", padding: "2px 6px", borderRadius: 4 }}>{id}</code> },
    { title: "Tên", dataIndex: "profileName", render: (n: string) =>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{n}</span> },
    { title: "Trạng thái", dataIndex: "status", width: 110, render: (s: ProfileStatus) =>
      <Tag color={PROFILE_STATUS_COLOR[s]} style={{ fontSize: 11, border: "none", borderRadius: 4 }}>
        {PROFILE_STATUS_LABELS[s]}
      </Tag> },
    {
      title: "Hiệu quả %",
      key: "efficiency",
      width: 180,
      sorter: (a: SeedingProfile, b: SeedingProfile) => {
        const rateA = profileStatsMap[a.profileId]?.rate ?? 100;
        const rateB = profileStatsMap[b.profileId]?.rate ?? 100;
        return rateA - rateB;
      },
      render: (_: unknown, r: SeedingProfile) => {
        const stats = profileStatsMap[r.profileId];
        if (!stats || stats.total === 0) {
          return <span style={{ color: "#b2b2b2", fontSize: 12 }}>Chưa có lịch sử</span>;
        }
        const color = stats.rate >= 80 ? "#3ecf8e" : stats.rate >= 50 ? "#f59e0b" : "#dc2626";
        return (
          <div style={{ width: 140 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
              <span style={{ color, fontWeight: 600 }}>{stats.rate}%</span>
              <span style={{ color: "#8a8a8a" }}>({stats.success}/{stats.success + stats.failed} OK)</span>
            </div>
            <Progress
              percent={stats.rate}
              showInfo={false}
              strokeColor={color}
              size="small"
              style={{ margin: 0 }}
              aria-label={`Hiệu quả ${stats.rate}%`}
            />
          </div>
        );
      },
    },
    { title: "Ghi chú", dataIndex: "note", render: (n: string) =>
      <span style={{ fontSize: 12, color: "#8a8a8a" }}>{n || "—"}</span> },
    ...(isAdmin ? [{
      title: "", key: "actions", width: 80,
      render: (_: unknown, r: SeedingProfile) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditingProfile(r); form.setFieldsValue(r); setFormOpen(true);
          }} />
          <Popconfirm title="Xóa profile?" onConfirm={() => handleDelete(r.id)} okType="danger" okText="Xóa" cancelText="Hủy">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <>
      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Tổng"        value={stats.total}    accent />
        <StatCard label="Hoạt động"   value={stats.active}   color="#3ecf8e" />
        <StatCard label="Không dùng"  value={stats.inactive} />
        <StatCard label="Bị khóa"     value={stats.banned}   color="#dc2626" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Input.Search placeholder="Tìm profile..." value={search}
          onChange={(e) => setSearch(e.target.value)} size="small" style={{ maxWidth: 260 }} allowClear />
        {isAdmin && (
          <>
            <Button size="small" icon={<PlusOutlined />} type="primary" onClick={() => {
              setEditingProfile(null); form.resetFields();
              form.setFieldsValue({ status: "active" }); setFormOpen(true);
            }}>Thêm profile</Button>
            <Button size="small" icon={<UploadOutlined />} onClick={() => { setImportFile(null); setImportOpen(true); }}>
              Import CSV/Excel
            </Button>
            <Tooltip title="Tải template Excel">
              <Button size="small" icon={<DownloadOutlined />} onClick={exportProfileTemplate}>Template</Button>
            </Tooltip>
            <Button size="small" onClick={handleSeedData} style={{ background: "#f5f5f5", color: "#555", border: "1px dashed #d9d9d9" }}>
              Seed Demo Data
            </Button>
          </>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid #dfdfdf", borderRadius: 12, overflow: "hidden" }}>
        {loading ? <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 4 }} /></div>
          : profiles.length === 0 ? <Empty description="Chưa có profiles. Import từ CSV/Excel." style={{ padding: "48px 0" }} />
          : <Table columns={columns} dataSource={filtered} rowKey="id" size="small" pagination={{ pageSize: 20, size: "small" }} />}
      </div>

      {/* Profile form */}
      <Modal title={editingProfile ? "Sửa profile" : "Thêm profile"} open={formOpen}
        onCancel={() => setFormOpen(false)} onOk={handleSave} confirmLoading={saving}
        centered okText="Lưu" cancelText="Hủy">
        {formOpen && (
          <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item name="profileId" label="Profile ID (GPM)" rules={[{ required: true, message: "Nhập ID" }]}>
              <Input placeholder="VD: profile_001" />
            </Form.Item>
            <Form.Item name="profileName" label="Tên hiển thị" rules={[{ required: true, message: "Nhập tên" }]}>
              <Input placeholder="VD: Nguyễn Văn A" />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái">
              <Select>
                {(Object.entries(PROFILE_STATUS_LABELS) as [ProfileStatus, string][]).map(([k, v]) => (
                  <Select.Option key={k} value={k}>{v}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="note" label="Ghi chú">
              <Input placeholder="Ghi chú tuỳ chọn" />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Import modal */}
      <Modal title="Import Profiles từ Excel/CSV" open={importOpen}
        onCancel={() => setImportOpen(false)} onOk={handleImport} confirmLoading={importing}
        centered okText="Import" cancelText="Hủy" okButtonProps={{ disabled: !importFile }}>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: "#6b6b6b", marginBottom: 12 }}>
            File cần có cột: <strong>profile_id</strong>, <strong>profile_name</strong>. Tuỳ chọn: status, note.
          </div>
          <Upload accept=".xlsx,.xls,.csv" maxCount={1}
            beforeUpload={(f) => { setImportFile(f); return false; }}
            onRemove={() => setImportFile(null)}>
            <Button icon={<UploadOutlined />}>Chọn file</Button>
          </Upload>
        </div>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: COMMENT LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

function CommentLibraryTab({ isAdmin }: { isAdmin: boolean }) {
  const [comments, setComments] = useState<SeedingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SeedingComment | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // FIX #12: Subscribe realtime
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeCommentLibrary((data) => {
      setComments(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter((c) => c.text.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q)));
  }, [comments, search]);

  const handleSave = async () => {
    const values = await form.validateFields() as { text: string; tags?: string };
    const tags = values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    setSaving(true);
    try {
      if (editing) {
        await updateSeedingComment(editing.id, { text: values.text, tags });
        message.success("Đã cập nhật");
      } else {
        await createSeedingComment({ text: values.text, tags });
        message.success("Đã thêm comment");
      }
      setFormOpen(false);
    } catch { message.error("Lưu thất bại"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteSeedingComment(id); message.success("Đã xóa"); }
    catch { message.error("Xóa thất bại"); }
  };

  const columns = [
    {
      title: "Nội dung",
      dataIndex: "text",
      render: (t: string) => <span style={{ fontSize: 13, color: "#171717", lineHeight: 1.5 }}>{t}</span>,
    },
    {
      title: "Tags",
      dataIndex: "tags",
      width: 200,
      render: (tags: string[]) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {tags.map((tag) => (
            <Tag key={tag} style={{ fontSize: 11, borderRadius: 4, background: "#f4f4f4", border: "none" }}>
              {tag}
            </Tag>
          ))}
        </div>
      ),
    },
    { title: "Đã dùng", dataIndex: "usageCount", width: 80, render: (n: number) =>
      <span style={{ fontSize: 12, color: "#8a8a8a" }}>{n}</span> },
    {
      title: "",
      key: "actions",
      width: 80,
      render: (_: unknown, r: SeedingComment) => (
        <Space size={4}>
          <Tooltip title="Copy">
            <Button size="small" icon={<CopyOutlined />} onClick={() => {
              navigator.clipboard.writeText(r.text).then(() => message.success("Đã copy"));
            }} />
          </Tooltip>
          {isAdmin && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => {
                setEditing(r);
                form.setFieldsValue({ text: r.text, tags: r.tags.join(", ") });
                setFormOpen(true);
              }} />
              <Popconfirm title="Xóa comment?" onConfirm={() => handleDelete(r.id)} okType="danger" okText="Xóa" cancelText="Hủy">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Input.Search placeholder="Tìm comment..." value={search}
          onChange={(e) => setSearch(e.target.value)} size="small" style={{ maxWidth: 280 }} allowClear />
        {isAdmin && (
          <Button size="small" icon={<PlusOutlined />} type="primary" onClick={() => {
            setEditing(null); form.resetFields(); setFormOpen(true);
          }}>Thêm comment</Button>
        )}
        <span style={{ fontSize: 12, color: "#8a8a8a", lineHeight: "24px" }}>
          {filtered.length} mục
        </span>
      </div>

      <div style={{ background: "#fff", border: "1px solid #dfdfdf", borderRadius: 12, overflow: "hidden" }}>
        {loading ? <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 4 }} /></div>
          : comments.length === 0 ? <Empty description="Thư viện trống. Thêm comment mẫu để dùng khi tạo tasks." style={{ padding: "48px 0" }} />
          : <Table columns={columns} dataSource={filtered} rowKey="id" size="small" pagination={{ pageSize: 20, size: "small" }} />}
      </div>

      <Modal title={editing ? "Sửa comment" : "Thêm comment mới"} open={formOpen}
        onCancel={() => setFormOpen(false)} onOk={handleSave} confirmLoading={saving}
        centered okText="Lưu" cancelText="Hủy">
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="text" label="Nội dung comment" rules={[{ required: true, message: "Nhập nội dung" }]}>
            <TextArea rows={3} placeholder="Nội dung comment..." showCount maxLength={500} />
          </Form.Item>
          <Form.Item name="tags" label="Tags (phân cách bằng dấu phẩy)">
            <Input placeholder="VD: tích cực, hỏi giá, chung chung" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: AI PLANNER
// ═══════════════════════════════════════════════════════════════════════════════

interface AiPlannerTabProps {
  isAdmin: boolean;
  profileStatsMap: Record<string, { success: number; failed: number; rate: number; total: number }>;
  onPlanCreated: () => void;
}

function AiPlannerTab({ isAdmin, profileStatsMap, onPlanCreated }: AiPlannerTabProps) {
  const { token } = antdTheme.useToken();
  const [form] = Form.useForm();
  const [profiles, setProfiles] = useState<SeedingProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTask[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingProfiles(true);
    getProfiles()
      .then(setProfiles)
      .finally(() => setLoadingProfiles(false));
  }, [isAdmin]);

  const handleGeneratePlan = async () => {
    if (!isAdmin) {
      message.warning("Chỉ admin mới được lập kế hoạch seeding.");
      return;
    }
    const values = await form.validateFields() as AiPlannerFormValues;
    setPlanning(true);
    setSuggestedTasks([]);
    try {
      const selectedProfiles = profiles
        .filter((p) => values.profileIds.includes(p.id))
        .map((p) => ({
          id: p.id,
          profileId: p.profileId,
          profileName: p.profileName,
          rate: profileStatsMap[p.profileId]?.rate ?? 100,
        }));

      const actionCounts = {
        like: Number(values.likeCount || 0),
        comment: Number(values.commentCount || 0),
        share: Number(values.shareCount || 0),
      };

      const res = await planCampaignWithAI(
        values.goal,
        values.targetUrl,
        selectedProfiles,
        actionCounts
      );

      if (res.error) {
        message.error(`Lập kế hoạch AI lỗi: ${res.error}`);
      } else {
        setSuggestedTasks(
          res.tasks.map((t, idx): SuggestedTask => ({
            key: idx,
            checked: true,
            profileId: String(t.profileId ?? ""),
            profileName: String(t.profileName ?? ""),
            action: t.action as SeedingAction,
            targetUrl: String(t.targetUrl ?? ""),
            commentText: t.commentText ? String(t.commentText) : "",
            shareCaption: t.shareCaption ? String(t.shareCaption) : "",
            delayMin: Number(t.delayMin || 5),
            delayMax: Number(t.delayMax || 15),
          }))
        );
        message.success(`Đề xuất thành công ${res.tasks.length} tasks seeding`);
      }
    } catch {
      message.error("Lập kế hoạch AI thất bại.");
    } finally {
      setPlanning(false);
    }
  };

  const handleApplyPlan = async () => {
    if (!isAdmin) {
      message.warning("Chỉ admin mới được tạo chiến dịch từ AI Planner.");
      return;
    }
    const checkedTasks = suggestedTasks.filter((t) => t.checked);
    if (checkedTasks.length === 0) {
      message.warning("Vui lòng chọn ít nhất 1 task để áp dụng.");
      return;
    }
    setCreating(true);
    try {
      const goal = String(form.getFieldValue("goal") ?? "");
      const targetUrl = String(form.getFieldValue("targetUrl") ?? "");

      // 1. Tạo chiến dịch mới
      const campaign = await createCampaign({
        name: `AI Plan: ${goal.length > 25 ? goal.slice(0, 22) + "..." : goal}`,
        description: `Được tạo tự động bởi AI Planner. Mục tiêu: ${goal}`,
        status: "draft",
        targetUrl,
      });

      // 2. Tạo các tasks
      const newTasks = checkedTasks.map((t) => ({
        campaignId: campaign.id,
        profileId: t.profileId,
        profileName: t.profileName,
        action: t.action,
        targetUrl: t.targetUrl || targetUrl,
        commentText: t.commentText || "",
        shareCaption: t.shareCaption || "",
        delayMin: Number(t.delayMin || 5),
        delayMax: Number(t.delayMax || 15),
      }));

      await createTasksBulk(newTasks, "scheduled");
      message.success("Đã áp dụng kế hoạch thành công và tạo chiến dịch!");
      setSuggestedTasks([]);
      form.resetFields();
      onPlanCreated();
    } catch {
      message.error("Tạo chiến dịch thất bại.");
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    {
      title: "",
      dataIndex: "checked",
      width: 40,
      render: (checked: boolean, r: SuggestedTask) => (
        <Switch
          size="small"
          checked={checked}
          onChange={(val) => {
            setSuggestedTasks((prev) =>
              prev.map((item) => (item.key === r.key ? { ...item, checked: val } : item))
            );
          }}
        />
      ),
    },
    {
      title: "Profile",
      dataIndex: "profileName",
      width: 130,
      render: (name: string, r: SuggestedTask) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 12 }}>{name}</div>
          <div style={{ fontSize: 11, color: "#8a8a8a" }}>{r.profileId}</div>
        </div>
      ),
    },
    {
      title: "Hành động",
      dataIndex: "action",
      width: 90,
      render: (act: SeedingAction) => (
        <Tag color={act === "like" ? "blue" : act === "comment" ? "green" : "orange"} style={{ border: "none", borderRadius: 4 }}>
          {ACTION_LABELS[act] || act}
        </Tag>
      ),
    },
    {
      title: "Nội dung bình luận / Caption",
      dataIndex: "commentText",
      render: (_text: string, r: SuggestedTask) => {
        if (r.action === "like") return <span style={{ color: "#b2b2b2" }}>—</span>;
        const fieldName = r.action === "comment" ? "commentText" : "shareCaption";
        const val = r[fieldName] || "";
        return (
          <Input
            value={val}
            size="small"
            style={{ fontSize: 12 }}
            onChange={(e) => {
              const newVal = e.target.value;
              setSuggestedTasks((prev) =>
                prev.map((item) => (item.key === r.key ? { ...item, [fieldName]: newVal } : item))
              );
            }}
          />
        );
      },
    },
    {
      title: "Delay Min (s)",
      dataIndex: "delayMin",
      width: 80,
      render: (val: number, r: SuggestedTask) => (
        <Input
          type="number"
          value={val}
          size="small"
          style={{ width: 60 }}
          onChange={(e) => {
            const num = Number(e.target.value);
            setSuggestedTasks((prev) =>
              prev.map((item) => (item.key === r.key ? { ...item, delayMin: num } : item))
            );
          }}
        />
      ),
    },
    {
      title: "Delay Max (s)",
      dataIndex: "delayMax",
      width: 80,
      render: (val: number, r: SuggestedTask) => (
        <Input
          type="number"
          value={val}
          size="small"
          style={{ width: 60 }}
          onChange={(e) => {
            const num = Number(e.target.value);
            setSuggestedTasks((prev) =>
              prev.map((item) => (item.key === r.key ? { ...item, delayMax: num } : item))
            );
          }}
        />
      ),
    },
  ];

  return (
    <div style={{ marginTop: 8 }}>
      {!isAdmin && (
        <Alert
          type="info"
          showIcon
          message="Viewer chỉ được xem báo cáo seeding. AI Planner và thao tác tạo campaign/task chỉ dành cho admin."
          style={{ marginBottom: 16 }}
        />
      )}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            title={
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                <RobotOutlined style={{ color: "#8b5cf6", marginRight: 6 }} />
                YÊU CẦU LẬP KẾ HOẠCH AI
              </span>
            }
            style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 12 }}
          >
            <Form form={form} layout="vertical">
              <Form.Item name="goal" label="Mục tiêu chiến dịch" rules={[{ required: true, message: "Nhập mục tiêu" }]}>
                <TextArea rows={3} placeholder="Ví dụ: Tăng bình luận hỏi mua hàng, hỏi giá và tư vấn cho bài viết bán son môi." />
              </Form.Item>
              <Form.Item name="targetUrl" label="URL bài viết Facebook" rules={[{ required: true, message: "Nhập URL" }]}>
                <Input placeholder="https://facebook.com/..." />
              </Form.Item>
              <Form.Item name="profileIds" label="Profiles tham gia" rules={[{ required: true, message: "Chọn ít nhất 1 profile" }]}>
                <Select mode="multiple" placeholder="Chọn profiles..." maxTagCount={2} loading={loadingProfiles} style={{ width: "100%" }}>
                  {profiles.filter((p) => p.status === "active").map((p) => (
                    <Select.Option key={p.id} value={p.id}>{p.profileName}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <div style={{ display: "flex", gap: 12 }}>
                <Form.Item name="likeCount" label="Số Like" style={{ flex: 1 }} initialValue={5}>
                  <Input type="number" min={0} />
                </Form.Item>
                <Form.Item name="commentCount" label="Số Comment" style={{ flex: 1 }} initialValue={3}>
                  <Input type="number" min={0} />
                </Form.Item>
                <Form.Item name="shareCount" label="Số Share" style={{ flex: 1 }} initialValue={1}>
                  <Input type="number" min={0} />
                </Form.Item>
              </div>
              <Button type="primary" block style={{ background: "#8b5cf6", borderColor: "#8b5cf6" }} onClick={handleGeneratePlan} loading={planning} disabled={!isAdmin}>
                Lập kế hoạch với AI
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card title={<span style={{ fontSize: 13, fontWeight: 600 }}>KẾ HOẠCH SEEDING ĐỀ XUẤT</span>} style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 12 }}>
            {suggestedTasks.length > 0 ? (
              <div>
                <Table columns={columns} dataSource={suggestedTasks} pagination={false} size="small" scroll={{ x: 600 }} style={{ marginBottom: 16 }} />
                <Button type="primary" onClick={handleApplyPlan} loading={creating} disabled={!isAdmin} style={{ background: "#3ecf8e", borderColor: "#3ecf8e" }}>
                  Áp dụng & Tạo chiến dịch mới
                </Button>
              </div>
            ) : (
              <Empty description={planning ? "Gemini đang thiết lập danh sách các tasks thích hợp..." : "Điền thông tin và bấm 'Lập kế hoạch với AI' để bắt đầu."} style={{ padding: "80px 0" }} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const TAB_ICONS: Record<string, React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  campaigns: <PlayCircleOutlined />,
  planner:   <RobotOutlined />,
  profiles:  <CheckCircleOutlined />,
  comments:  <CopyOutlined />,
};

export default function SeedingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 1;
  const [activeTab, setActiveTab] = useState("dashboard");
  const [allTasks, setAllTasks] = useState<SeedingTask[]>([]);
  const [campaigns, setCampaigns] = useState<SeedingCampaign[]>([]);
  const [profiles, setProfiles] = useState<SeedingProfile[]>([]);

  useEffect(() => {
    const unsubCampaigns = subscribeCampaigns(setCampaigns);
    const unsubProfiles = subscribeProfiles(setProfiles);
    const unsubTasks = subscribeAllTasks(setAllTasks);
    return () => {
      unsubCampaigns();
      unsubProfiles();
      unsubTasks();
    };
  }, []);

  const profileStatsMap = useMemo(() => {
    const map: Record<string, { success: number; failed: number; rate: number; total: number }> = {};
    allTasks.forEach((t) => {
      const pId = t.profileId;
      if (!pId) return;
      if (!map[pId]) {
        map[pId] = { success: 0, failed: 0, rate: 100, total: 0 };
      }
      map[pId].total += 1;
      if (t.status === "success") {
        map[pId].success += 1;
      } else if (t.status === "failed") {
        map[pId].failed += 1;
      }
    });

    Object.keys(map).forEach((pId) => {
      const s = map[pId];
      const sum = s.success + s.failed;
      s.rate = sum > 0 ? Math.round((s.success / sum) * 100) : 100;
    });

    return map;
  }, [allTasks]);

  const tabItems = [
    {
      key: "dashboard",
      label: <span>{TAB_ICONS.dashboard} Dashboard</span>,
      children: (
        <Suspense fallback={<div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 4 }} /></div>}>
          <SeedingDashboardPanel
            allTasks={allTasks}
            campaignsCount={campaigns.length}
            profilesCount={profiles.length}
          />
        </Suspense>
      ),
    },
    {
      key: "campaigns",
      label: <span>{TAB_ICONS.campaigns} Chiến dịch</span>,
      children: <CampaignsTab isAdmin={isAdmin} profileStatsMap={profileStatsMap} />,
    },
    {
      key: "planner",
      label: <span>{TAB_ICONS.planner} AI Planner</span>,
      children: <AiPlannerTab isAdmin={isAdmin} profileStatsMap={profileStatsMap} onPlanCreated={() => setActiveTab("campaigns")} />,
    },
    {
      key: "profiles",
      label: <span>{TAB_ICONS.profiles} Profiles GPM</span>,
      children: useLegacyProfilesTab
        ? <ProfilesTab isAdmin={isAdmin} profileStatsMap={profileStatsMap} />
        : <GpmProfilesTab isAdmin={isAdmin} />,
    },
    {
      key: "comments",
      label: <span>{TAB_ICONS.comments} Thư viện bình luận</span>,
      children: <CommentLibraryTab isAdmin={isAdmin} />,
    },
  ];

  return (
    <AppLayout title="Seeding Manager">
      <div style={{ marginBottom: 8, padding: "8px 16px", background: "#fafafa",
        border: "1px solid #dfdfdf", borderRadius: 8, fontSize: 12, color: "#6b6b6b" }}>
        GPM Bridge Agent kết nối trực tiếp GPM Login API — quản lý profiles, mở/đóng browser, đồng bộ Firebase.
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="small"
        style={{ background: "#fff" }}
      />
    </AppLayout>
  );
}
