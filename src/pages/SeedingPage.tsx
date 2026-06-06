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
import { useState, useEffect, useMemo } from "react";
import {
  Tabs, Table, Button, Modal, Input, Select, Form, Tag, Space,
  message, Tooltip, Upload, Dropdown, Empty, Skeleton, Progress,
  Typography, Popconfirm, theme as antdTheme,
} from "antd";
import {
  PlusOutlined, DownloadOutlined, UploadOutlined, DeleteOutlined,
  EditOutlined, CopyOutlined, DownOutlined, FileExcelOutlined,
  PlayCircleOutlined, CheckCircleOutlined,
} from "@ant-design/icons";
import { AppLayout } from "@/layouts/AppLayout";
import {
  createCampaign, updateCampaign, deleteCampaign,
  getProfiles, createProfile, updateProfile, deleteProfile, upsertProfiles,
  getTasksByCampaign, createTasksBulk, deleteTask,
  markTasksExported, applyTaskReport,
  createSeedingComment, updateSeedingComment, deleteSeedingComment,
  subscribeCampaigns, subscribeProfiles, subscribeCommentLibrary,
  CAMPAIGN_STATUS_LABELS, TASK_STATUS_LABELS, ACTION_LABELS, PROFILE_STATUS_LABELS,
} from "@/service/seedingService";
import {
  exportTasksToExcel, exportTasksToCSV,
  readReportFile, readProfileFile, exportProfileTemplate,
  normalizeTaskStatus, parseFinishedAt,
} from "@/utils/seedingExport";
import { computeSeedingStats } from "@/hooks/useSeedingStats";
import { useAuth } from "@/contexts/AuthContext";
import type {
  SeedingCampaign, SeedingTask, SeedingProfile, SeedingComment,
  CampaignStatus, SeedingAction, ProfileStatus, TaskStatus,
} from "@/types/seeding";

const { Text } = Typography;
const { TextArea } = Input;

// ── Status colours ────────────────────────────────────────────────────────────

const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  pending: "default", running: "processing", success: "success",
  failed: "error", skipped: "warning",
};
const CAMPAIGN_STATUS_COLOR: Record<string, string> = {
  draft: "default", active: "processing", paused: "warning", completed: "success",
};
const PROFILE_STATUS_COLOR: Record<string, string> = {
  active: "success", inactive: "default", banned: "error",
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

function CampaignsTab({ isAdmin }: { isAdmin: boolean }) {
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
    bulkForm.resetFields();
    bulkForm.setFieldsValue({ targetUrl: campaign.targetUrl ?? "", delayMin: 5, delayMax: 15 });
    setBulkTaskOpen(true);
  };

  const handleBulkCreate = async () => {
    if (!selectedCampaign) return;
    const values = await bulkForm.validateFields() as {
      profileIds: string[]; action: SeedingAction;
      targetUrl: string; commentText?: string; shareCaption?: string;
      delayMin: number; delayMax: number;
    };
    setBulkSaving(true);
    try {
      const selectedProfiles = profiles.filter((p) => values.profileIds.includes(p.id));
      const newTasks = selectedProfiles.map((p) => ({
        campaignId:   selectedCampaign.id,
        profileId:    p.profileId,
        profileName:  p.profileName,
        action:       values.action,
        targetUrl:    values.targetUrl.trim(),
        commentText:  values.commentText?.trim(),
        shareCaption: values.shareCaption?.trim(),
        delayMin:     Number(values.delayMin),
        delayMax:     Number(values.delayMax),
        totalFiles:   0,
      }));
      await createTasksBulk(newTasks);
      message.success(`Đã tạo ${newTasks.length} tasks`);
      setBulkTaskOpen(false);
      // Refresh tasks nếu modal đang mở
      if (taskModalOpen && selectedCampaign) {
        setTasks(await getTasksByCampaign(selectedCampaign.id));
      }
    } catch { message.error("Tạo tasks thất bại"); }
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

  const handleSaveCampaign = async () => {
    const values = await campaignForm.validateFields() as {
      name: string; description?: string; status: CampaignStatus; targetUrl?: string;
    };
    setSaving(true);
    try {
      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, { ...values });
        message.success("Đã cập nhật campaign");
      } else {
        await createCampaign({ ...values, status: values.status ?? "draft" });
        message.success("Đã tạo campaign");
      }
      setCampaignFormOpen(false);
    } catch { message.error("Lưu thất bại"); }
    finally { setSaving(false); }
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      await deleteCampaign(id);
      message.success("Đã xóa campaign");
    } catch { message.error("Xóa thất bại"); }
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
      width: 130,
      sorter: (a: SeedingCampaign, b: SeedingCampaign) => a.status.localeCompare(b.status),
      render: (s: CampaignStatus) => (
        <Tag color={CAMPAIGN_STATUS_COLOR[s]} style={{ fontSize: 11, borderRadius: 4, border: "none" }}>
          {CAMPAIGN_STATUS_LABELS[s]}
        </Tag>
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
      width: 200,
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
        return (
          <Space size={4} wrap>
            <Button size="small" onClick={() => openTaskManager(r)}>Tasks</Button>
            <Button size="small" icon={<PlusOutlined />} onClick={() => openBulkTask(r)}>Thêm</Button>
            <Dropdown menu={exportMenu} trigger={["click"]}>
              <Button size="small" icon={<DownloadOutlined />}>
                Export <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
            <Button size="small" icon={<UploadOutlined />} onClick={() => openImportReport(r)}>Report</Button>
            <Tooltip title="Sửa">
              <Button size="small" icon={<EditOutlined />} onClick={() => {
                setEditingCampaign(r);
                campaignForm.setFieldsValue(r);
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
        <Form form={campaignForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="name" label="Tên chiến dịch" rules={[{ required: true, message: "Nhập tên" }]}>
            <Input placeholder="VD: Like bài tháng 6" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input placeholder="Ghi chú thêm (tuỳ chọn)" />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái">
            <Select>
              {(Object.entries(CAMPAIGN_STATUS_LABELS) as [CampaignStatus, string][]).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="targetUrl" label="Target URL mặc định">
            <Input placeholder="https://facebook.com/..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk task creation */}
      <Modal title={`Thêm tasks — ${selectedCampaign?.name ?? ""}`}
        open={bulkTaskOpen} onCancel={() => setBulkTaskOpen(false)}
        onOk={handleBulkCreate} confirmLoading={bulkSaving} centered
        okText="Tạo tasks" cancelText="Hủy" width={560}>
        <Form form={bulkForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="profileIds" label="Chọn profiles" rules={[{ required: true, message: "Chọn ít nhất 1 profile" }]}>
            <Select mode="multiple" placeholder="Chọn profiles..." allowClear maxTagCount={4}>
              {profiles.filter((p) => p.status === "active").map((p) => (
                <Select.Option key={p.id} value={p.id}>{p.profileName} ({p.profileId})</Select.Option>
              ))}
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
                <Form.Item name="commentText" label="Nội dung comment">
                  <TextArea rows={2} placeholder="Nội dung comment..." />
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
      </Modal>

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
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: PROFILES
// ═══════════════════════════════════════════════════════════════════════════════

function ProfilesTab({ isAdmin }: { isAdmin: boolean }) {
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
    if (!q) return profiles;
    return profiles.filter((p) =>
      p.profileName.toLowerCase().includes(q) || p.profileId.toLowerCase().includes(q)
    );
  }, [profiles, search]);

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
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const TAB_ICONS: Record<string, React.ReactNode> = {
  campaigns: <PlayCircleOutlined />,
  profiles:  <CheckCircleOutlined />,
  comments:  <CopyOutlined />,
};

export default function SeedingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 1;
  const [activeTab, setActiveTab] = useState("campaigns");

  const tabItems = [
    {
      key: "campaigns",
      label: <span>{TAB_ICONS.campaigns} Chiến dịch</span>,
      children: <CampaignsTab isAdmin={isAdmin} />,
    },
    {
      key: "profiles",
      label: <span>{TAB_ICONS.profiles} Profiles</span>,
      children: <ProfilesTab isAdmin={isAdmin} />,
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
        GPM Bridge — Export task Excel → GPM Automate chạy → Import report để cập nhật trạng thái.
        Không kết nối Facebook trực tiếp.
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
