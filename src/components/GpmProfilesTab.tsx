/**
 * GpmProfilesTab — Quản lý profiles GPM Login đầy đủ
 *
 * Tính năng:
 * - Xem danh sách profiles từ GPM (real-time qua Bridge API)
 * - Tìm kiếm và lọc theo nhóm
 * - Tạo / Sửa / Xóa profile (CRUD qua GPM API)
 * - Mở / Đóng browser
 * - Quản lý proxy (gán, kiểm tra)
 * - Đồng bộ profiles xuống Firebase (để Campaigns tab dùng)
 */
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Table, Button, Input, Select, Modal, Form, Tag, Space, message,
  Tooltip, Popconfirm, Badge, Spin, Alert, Tabs, Divider, Row, Col,
  Typography, Card, Progress, Empty,
} from "antd";
import {
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  PlayCircleOutlined, StopOutlined, SearchOutlined, SyncOutlined,
  CheckCircleOutlined, WifiOutlined, GlobalOutlined, UserOutlined,
  DesktopOutlined, ApiOutlined, SettingOutlined, InfoCircleOutlined,
} from "@ant-design/icons";
import {
  checkGpmBridgeHealth,
  getGpmGroups,
  getGpmProfiles,
  getGpmProfileById,
  createGpmProfile,
  updateGpmProfile,
  deleteGpmProfile,
  startGpmProfile,
  stopGpmProfile,
  getGpmProxies,
  checkGpmProxy,
  getGpmBrowserVersions,
} from "@/service/gpmApiService";
import { upsertProfiles } from "@/service/seedingService";
import type {
  GpmProfile,
  GpmGroup,
  GpmProxy,
  GpmProfileDTO,
  GpmBrowserType,
  GpmOsType,
} from "@/types/gpm";
import {
  GPM_BROWSER_TYPE_LABELS,
  GPM_OS_TYPE_LABELS,
  GPM_WEBRTC_MODE_LABELS,
  GPM_CANVAS_MODE_LABELS,
  GPM_AUDIO_MODE_LABELS,
  GPM_FONT_MODE_LABELS,
} from "@/types/gpm";

const { Text } = Typography;
const { Search } = Input;

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseDebugPort(result: {
  data?: { remote_debugging_port?: number; selenium_remote_debug_address?: string } | null;
  remote_debugging_port?: number;
}): number | null {
  const directPort = result?.data?.remote_debugging_port ?? result?.remote_debugging_port;
  if (directPort) return directPort;
  const address = result?.data?.selenium_remote_debug_address;
  if (!address) return null;
  const parts = address.split(":");
  const parsed = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatName(value?: string | null): string {
  if (!value) return "";
  const text = value.trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getBrowserLabel(profile: GpmProfile): string {
  return formatName(profile.browser?.name) || GPM_BROWSER_TYPE_LABELS[profile.browser_type] || "—";
}

function getBrowserVersion(profile: GpmProfile): string {
  return profile.browser?.version || profile.browser_version || "";
}

function getOsLabel(profile: GpmProfile): string {
  return profile.os || GPM_OS_TYPE_LABELS[profile.os_type] || "—";
}

// ── Main component ────────────────────────────────────────────────────────────

export function GpmProfilesTab({ isAdmin }: { isAdmin: boolean }) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [profiles, setProfiles]           = useState<GpmProfile[]>([]);
  const [groups, setGroups]               = useState<GpmGroup[]>([]);
  const [proxies, setProxies]             = useState<GpmProxy[]>([]);
  const [browserVersions, setBrowserVersions] = useState<string[]>([]);

  const [loading, setLoading]             = useState(false);
  const [bridgeOk, setBridgeOk]           = useState<boolean | null>(null);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [search, setSearch]               = useState("");
  const [groupFilter, setGroupFilter]     = useState<string | undefined>();

  // Running browsers (tracked locally)
  const [runningIds, setRunningIds]       = useState<Set<string>>(new Set());
  const [runningPorts, setRunningPorts]   = useState<Record<string, number>>({});
  const [startingId, setStartingId]       = useState<string | null>(null);
  const [stoppingId, setStoppingId]       = useState<string | null>(null);

  // Profile form modal
  const [formOpen, setFormOpen]           = useState(false);
  const [editingProfile, setEditingProfile] = useState<GpmProfile | null>(null);
  const [form]                            = Form.useForm();
  const [saving, setSaving]               = useState(false);
  const [activeFormTab, setActiveFormTab] = useState("basic");

  // Proxy checker
  const [proxyInput, setProxyInput]       = useState("");
  const [proxyChecking, setProxyChecking] = useState(false);
  const [proxyResult, setProxyResult]     = useState<{ ip?: string; country?: string; isp?: string; success: boolean } | null>(null);

  // Detail view
  const [detailProfile, setDetailProfile] = useState<GpmProfile | null>(null);
  const [detailOpen, setDetailOpen]       = useState(false);

  // Sync to Firebase
  const [syncing, setSyncing]             = useState(false);
  const [syncProgress, setSyncProgress]   = useState(0);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 15;

  // ── Bridge health check ──────────────────────────────────────────────────
  useEffect(() => {
    checkGpmBridgeHealth().then(ok => {
      setBridgeOk(ok);
      if (ok) {
        loadProfiles();
        loadMeta();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadProfiles = useCallback(async (p = page, s = search, g = groupFilter) => {
    setLoading(true);
    try {
      const res = await getGpmProfiles({
        limit: PAGE_SIZE,
        page: p,
        search: s || undefined,
        group_id: g,
      });
      
      try {
        const { getProfiles: getFsProfiles } = await import("@/service/seedingService");
        const fsProfiles = await getFsProfiles();
        const mergedData = res.data.map(gpmProf => {
          const matched = fsProfiles.find(fp => fp.profileId === gpmProf.id);
          if (matched) {
            return {
              ...gpmProf,
              fbUid: matched.fbUid,
              fbName: matched.fbName,
              fbAvatar: matched.fbAvatar,
              fbUrl: matched.fbUrl,
              fbIsLoggedIn: matched.fbIsLoggedIn,
              fbSyncedAt: matched.fbSyncedAt
            } as any;
          }
          return gpmProf;
        });
        setProfiles(mergedData);
      } catch (dbErr) {
        console.error("Error merging Firestore data:", dbErr);
        setProfiles(res.data);
      }
      
      setTotal(res.total);
    } catch (err) {
      console.error("[GpmProfilesTab]", err);
      message.error("Không tải được danh sách profiles từ GPM");
      setBridgeOk(false);
    } finally {
      setLoading(false);
    }
  }, [page, search, groupFilter]);

  const loadMeta = async () => {
    try {
      const [g, p, v] = await Promise.allSettled([
        getGpmGroups(),
        getGpmProxies(),
        getGpmBrowserVersions(),
      ]);
      if (g.status === "fulfilled") setGroups(g.value);
      if (p.status === "fulfilled") setProxies(p.value);
      if (v.status === "fulfilled") setBrowserVersions(v.value);
    } catch {/* ignore */}
  };

  // ── Search debounce ───────────────────────────────────────────────────────
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      loadProfiles(1, val, groupFilter);
    }, 400);
  };

  const handleGroupFilter = (val: string | undefined) => {
    setGroupFilter(val);
    setPage(1);
    loadProfiles(1, search, val);
  };

  // ── Mở browser ───────────────────────────────────────────────────────────
  const handleStart = async (profile: GpmProfile) => {
    setStartingId(profile.id);
    try {
      const result = await startGpmProfile(profile.id);
      if (result.success === false) {
        message.error(`Không thể mở browser: ${result.message ?? "Lỗi không xác định"}`);
        return;
      }
      const port = parseDebugPort(result);
      setRunningIds(prev => new Set(prev).add(profile.id));
      if (port) {
        setRunningPorts(prev => ({ ...prev, [profile.id]: port }));
        message.success(`✅ Đã mở browser "${profile.name}" — Debug port: ${port}`);
      } else {
        message.success(`✅ Đã mở browser "${profile.name}"`);
      }

      // Sync Facebook info cào được lên Firestore
      if (result.fbInfo) {
        const { fbUid, fbName, fbAvatar, fbUrl, isLoggedIn } = result.fbInfo;
        
        // 1. Cập nhật local state ngay lập tức
        setProfiles(prev => prev.map(p => p.id === profile.id ? {
          ...p,
          fbUid,
          fbName,
          fbAvatar,
          fbUrl,
          fbIsLoggedIn: isLoggedIn,
          fbSyncedAt: new Date().toISOString()
        } as any : p));

        // 2. Tìm profile tương ứng trong Firestore
        try {
          const { getProfiles: getFsProfiles, updateProfile } = await import("@/service/seedingService");
          const fsProfiles = await getFsProfiles();
          const matched = fsProfiles.find(p => p.profileId === profile.id);
          if (matched) {
            const { serverTimestamp } = await import("firebase/firestore");
            await updateProfile(matched.id, {
              fbUid,
              fbName,
              fbAvatar,
              fbUrl,
              fbIsLoggedIn: isLoggedIn,
              fbSyncedAt: serverTimestamp() as any,
            });
            console.log("Firebase profile FB status synced successfully.");
          }
        } catch (dbErr) {
          console.error("Error syncing FB status to Firebase:", dbErr);
        }
      }
    } catch (err) {
      message.error(`Mở browser thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStartingId(null);
    }
  };

  // ── Đóng browser ─────────────────────────────────────────────────────────
  const handleStop = async (profile: GpmProfile) => {
    setStoppingId(profile.id);
    try {
      await stopGpmProfile(profile.id);
      setRunningIds(prev => { const n = new Set(prev); n.delete(profile.id); return n; });
      setRunningPorts(prev => { const n = { ...prev }; delete n[profile.id]; return n; });
      message.success(`Đã đóng browser "${profile.name}"`);
    } catch (err) {
      message.error(`Đóng browser thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStoppingId(null);
    }
  };

  // ── Tạo / Sửa profile ────────────────────────────────────────────────────
  const openCreateForm = () => {
    setEditingProfile(null);
    setActiveFormTab("basic");
    form.resetFields();
    form.setFieldsValue({
      browser_type: 1,
      os_type: 1,
      timezone_base_on_ip: true,
      is_language_base_on_ip: true,
    });
    setFormOpen(true);
  };

  const openEditForm = (profile: GpmProfile) => {
    setEditingProfile(profile);
    setActiveFormTab("basic");
    form.setFieldsValue({
      name: profile.name,
      group_id: profile.group_id ?? undefined,
      raw_proxy: profile.raw_proxy ?? "",
      browser_type: profile.browser_type ?? 1,
      browser_version: profile.browser_version ?? undefined,
      os_type: profile.os_type ?? 1,
      custom_user_agent: profile.custom_user_agent ?? "",
      task_bar_title: profile.task_bar_title ?? "",
      note: profile.note ?? "",
      webrtc_mode: profile.webrtc_mode ?? undefined,
      canvas_mode: profile.canvas_mode ?? undefined,
      audio_mode: profile.audio_mode ?? undefined,
      font_mode: profile.font_mode ?? undefined,
      timezone_base_on_ip: profile.timezone_base_on_ip ?? true,
      timezone: profile.timezone ?? undefined,
      is_language_base_on_ip: profile.is_language_base_on_ip ?? true,
      fixed_language: profile.fixed_language ?? undefined,
      startup_urls: profile.startup_urls ?? "",
    });
    setFormOpen(true);
  };

  const handleSaveProfile = async () => {
    try {
      const values = await form.validateFields() as GpmProfileDTO & { raw_proxy_select?: string };
      setSaving(true);

      const dto: GpmProfileDTO = {
        name: values.name,
        group_id: values.group_id ?? null,
        raw_proxy: values.raw_proxy || null,
        browser_type: values.browser_type as GpmBrowserType ?? 1,
        browser_version: values.browser_version ?? null,
        os_type: values.os_type as GpmOsType ?? 1,
        custom_user_agent: values.custom_user_agent || null,
        task_bar_title: values.task_bar_title || null,
        note: values.note || null,
        webrtc_mode: values.webrtc_mode ?? null,
        canvas_mode: values.canvas_mode ?? null,
        audio_mode: values.audio_mode ?? null,
        font_mode: values.font_mode ?? null,
        timezone_base_on_ip: values.timezone_base_on_ip ?? true,
        timezone: values.timezone ?? null,
        is_language_base_on_ip: values.is_language_base_on_ip ?? true,
        fixed_language: values.fixed_language ?? null,
        startup_urls: values.startup_urls || null,
      };

      if (editingProfile) {
        await updateGpmProfile(editingProfile.id, dto);
        message.success(`Đã cập nhật profile "${dto.name}"`);
      } else {
        await createGpmProfile(dto);
        message.success(`Đã tạo profile "${dto.name}"`);
      }

      setFormOpen(false);
      loadProfiles();
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return; // Form validation
      message.error(`Lưu thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Xóa profile ──────────────────────────────────────────────────────────
  const handleDelete = async (profile: GpmProfile, mode: "soft" | "hard" = "soft") => {
    try {
      await deleteGpmProfile(profile.id, mode);
      message.success(`Đã xóa profile "${profile.name}"`);
      loadProfiles();
    } catch (err) {
      message.error(`Xóa thất bại: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ── Kiểm tra proxy ────────────────────────────────────────────────────────
  const handleCheckProxy = async () => {
    if (!proxyInput.trim()) { message.warning("Nhập proxy để kiểm tra"); return; }
    setProxyChecking(true);
    setProxyResult(null);
    try {
      const res = await checkGpmProxy(proxyInput.trim());
      setProxyResult({ ...res.data, success: res.success });
      if (res.success) {
        message.success(`Proxy OK — IP: ${res.data?.ip}, ${res.data?.country}`);
      } else {
        message.error(`Proxy lỗi: ${res.message || "Không kết nối được"}`);
      }
    } catch (err) {
      message.error(`Kiểm tra proxy thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProxyChecking(false);
    }
  };

  // ── Đồng bộ xuống Firebase ────────────────────────────────────────────────
  const handleSyncToFirebase = async () => {
    setSyncing(true);
    setSyncProgress(0);
    try {
      // Lấy toàn bộ profiles (tăng page_size lớn)
      const { data: allProfiles } = await getGpmProfiles({ page_size: 1000, page: 1 });
      setSyncProgress(30);

      if (allProfiles.length === 0) {
        message.warning("Không có profiles để đồng bộ");
        return;
      }

      // Chuyển sang format Firestore SeedingProfile
      const firestoreProfiles = allProfiles.map(p => ({
        profileId: p.id,
        profileName: p.name,
        status: "active" as const,
        note: p.note || `Group: ${groups.find(g => g.id === p.group_id)?.name ?? "—"}`,
      }));

      setSyncProgress(60);
      await upsertProfiles(firestoreProfiles);
      setSyncProgress(100);

      message.success(`✅ Đã đồng bộ ${allProfiles.length} profiles xuống Firebase!`);
    } catch (err) {
      message.error(`Đồng bộ thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTimeout(() => { setSyncing(false); setSyncProgress(0); }, 1500);
    }
  };

  // ── Xem chi tiết ─────────────────────────────────────────────────────────
  const handleViewDetail = async (profile: GpmProfile) => {
    try {
      const detail = await getGpmProfileById(profile.id);
      setDetailProfile(detail);
      setDetailOpen(true);
    } catch {
      setDetailProfile(profile);
      setDetailOpen(true);
    }
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = [
    {
      title: "Tên Profile",
      dataIndex: "name",
      render: (name: string, r: any) => {
        const hasFb = r.fbIsLoggedIn && r.fbUid;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {hasFb && r.fbAvatar ? (
              <img 
                src={r.fbAvatar} 
                alt={r.fbName} 
                style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #d1d5db", objectFit: "cover" }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div style={{ 
                width: 32, height: 32, borderRadius: "50%", 
                background: "#f3f4f6", display: "flex", 
                alignItems: "center", justifyContent: "center",
                border: "1px solid #e5e7eb"
              }}>
                <UserOutlined style={{ color: "#9ca3af", fontSize: 16 }} />
              </div>
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                {name}
                {runningIds.has(r.id) && (
                  <Badge
                    status="processing"
                    text={<span style={{ fontSize: 11, color: "#10b981" }}>
                      Đang chạy{runningPorts[r.id] ? ` :${runningPorts[r.id]}` : ""}
                    </span>}
                  />
                )}
                {hasFb ? (
                  <Tag color="success" style={{ fontSize: 10, padding: "0 4px", height: 16, lineHeight: "14px", border: "none", margin: 0 }}>FB Live</Tag>
                ) : (
                  <Tag color="default" style={{ fontSize: 10, padding: "0 4px", height: 16, lineHeight: "14px", border: "none", margin: 0 }}>Chưa Login</Tag>
                )}
              </div>
              {r.note && (
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{r.note}</div>
              )}
              {hasFb && (
                <div style={{ fontSize: 11, color: "#4f46e5", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontWeight: 500 }}>{r.fbName}</span>
                  <span style={{ color: "#d1d5db" }}>|</span>
                  <a href={r.fbUrl || `https://facebook.com/${r.fbUid}`} target="_blank" rel="noreferrer" style={{ color: "#6b7280" }} onClick={e => e.stopPropagation()}>
                    UID: {r.fbUid}
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "Nhóm",
      dataIndex: "group_id",
      width: 140,
      render: (gid: string | null) => {
        const g = groups.find(g => g.id === gid);
        return g ? <Tag color="blue" style={{ fontSize: 11 }}>{g.name}</Tag>
          : <span style={{ color: "#d1d5db" }}>—</span>;
      },
    },
    {
      title: "Browser / OS",
      width: 160,
      render: (_: unknown, r: GpmProfile) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 12 }}>
            <DesktopOutlined style={{ marginRight: 4, color: "#6b7280" }} />
            {getBrowserLabel(r)}
            {getBrowserVersion(r) && <span style={{ color: "#9ca3af", fontSize: 11 }}> {getBrowserVersion(r)}</span>}
          </span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {getOsLabel(r)}
          </span>
        </div>
      ),
    },
    {
      title: "Proxy",
      dataIndex: "raw_proxy",
      width: 180,
      render: (proxy: string | null) => proxy
        ? <Text ellipsis={{ tooltip: proxy }} style={{ fontSize: 11, maxWidth: 170, color: "#059669" }}>
            <WifiOutlined style={{ marginRight: 4 }} />{proxy}
          </Text>
        : <span style={{ color: "#d1d5db", fontSize: 11 }}>Không có proxy</span>,
    },
    {
      title: "Ngày tạo",
      dataIndex: "created_at",
      width: 110,
      render: (d: string) => d
        ? <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {new Date(d).toLocaleDateString("vi-VN")}
          </span>
        : "—",
    },
    {
      title: "",
      key: "actions",
      width: isAdmin ? 280 : 60,
      render: (_: unknown, r: GpmProfile) => {
        const isRunning = runningIds.has(r.id);
        const isStarting = startingId === r.id;
        const isStopping = stoppingId === r.id;
        return (
          <Space size={4} wrap>
            {/* Mở / Đóng browser */}
            {isAdmin && (
              isRunning ? (
                <Popconfirm
                  title={`Đóng browser "${r.name}"?`}
                  onConfirm={() => handleStop(r)}
                  okText="Đóng" cancelText="Hủy"
                >
                  <Button
                    size="small" danger
                    icon={<StopOutlined />}
                    loading={isStopping}
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    Đóng
                  </Button>
                </Popconfirm>
              ) : (
                <Button
                  size="small" type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={isStarting}
                  onClick={() => handleStart(r)}
                  style={{ background: "#10b981", borderColor: "#10b981", display: "inline-flex", alignItems: "center" }}
                >
                  Mở
                </Button>
              )
            )}

            {/* Chi tiết */}
            <Tooltip title="Xem chi tiết">
              <Button
                size="small" icon={<InfoCircleOutlined />}
                onClick={() => handleViewDetail(r)}
              />
            </Tooltip>

            {/* Sửa / Xóa — chỉ admin */}
            {isAdmin && (
              <>
                <Tooltip title="Sửa profile">
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEditForm(r)} />
                </Tooltip>
                <Popconfirm
                  title={
                    <div>
                      <div style={{ fontWeight: 600 }}>Xóa profile "{r.name}"?</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        Chọn cách xóa bên dưới
                      </div>
                    </div>
                  }
                  okText="Xóa mềm (thùng rác)"
                  cancelText="Xóa cứng (vĩnh viễn)"
                  onConfirm={() => handleDelete(r, "soft")}
                  onCancel={() => handleDelete(r, "hard")}
                  okType="default"
                  icon={<DeleteOutlined style={{ color: "#ef4444" }} />}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  // ── Bridge offline state ──────────────────────────────────────────────────
  if (bridgeOk === false) {
    return (
      <Alert
        type="warning"
        showIcon
        message="GPM Bridge không phản hồi"
        description={
          <div>
            <p>Không thể kết nối đến GPM Bridge tại <code>http://localhost:3001</code>.</p>
            <p>Vui lòng:</p>
            <ol>
              <li>Đảm bảo GPM Login đang mở</li>
              <li>Khởi động GPM Bridge bằng lệnh:
                <code style={{ display: "block", background: "#f3f4f6", padding: "4px 8px", borderRadius: 4, margin: "4px 0" }}>
                  cd gpm-bridge && npm run build && npm start
                </code>
              </li>
              <li>Nếu GPM Login không chạy ở <code>http://127.0.0.1:9495</code>, sửa <code>GPM_API_URL</code> trong <code>gpm-bridge/.env</code>.</li>
            </ol>
            <Button
              icon={<ReloadOutlined />}
              onClick={async () => {
                setBridgeOk(null);
                const ok = await checkGpmBridgeHealth();
                setBridgeOk(ok);
                if (ok) { loadProfiles(); loadMeta(); }
              }}
            >
              Thử lại kết nối
            </Button>
          </div>
        }
      />
    );
  }

  if (bridgeOk === null) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin size="large" />
        <div style={{ marginTop: 12, color: "#6b7280" }}>Đang kết nối GPM Bridge...</div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <Search
          placeholder="Tìm kiếm profile..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          onSearch={val => { setPage(1); loadProfiles(1, val, groupFilter); }}
          style={{ width: 240 }}
          prefix={<SearchOutlined />}
          allowClear
        />

        <Select
          placeholder="Lọc theo nhóm"
          style={{ width: 160 }}
          allowClear
          value={groupFilter}
          onChange={val => handleGroupFilter(val)}
        >
          {groups.map(g => (
            <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>
          ))}
        </Select>

        <Button
          icon={<ReloadOutlined />}
          onClick={() => { loadProfiles(); loadMeta(); }}
          loading={loading}
        >
          Làm mới
        </Button>

        <div style={{ flex: 1 }} />

        {/* Sync to Firebase */}
        {isAdmin && (
          <Tooltip title="Đồng bộ tất cả profiles xuống Firebase để Campaigns có thể chọn">
            <Button
              icon={<SyncOutlined spin={syncing} />}
              onClick={handleSyncToFirebase}
              loading={syncing}
              style={{ color: "#6366f1", borderColor: "#6366f1" }}
            >
              {syncing ? `Đang sync... ${syncProgress}%` : "Sync → Firebase"}
            </Button>
          </Tooltip>
        )}

        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateForm}>
            Tạo Profile
          </Button>
        )}
      </div>

      {syncing && <Progress percent={syncProgress} style={{ marginBottom: 12 }} />}

      {/* ── Stats ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Tag color="blue">{total} profiles</Tag>
        <Tag color="green">{runningIds.size} đang chạy</Tag>
        <Tag color="default">{groups.length} nhóm</Tag>
        <Tag color="orange">{proxies.length} proxies</Tag>
      </div>

      {/* ── Table ── */}
      <Table
        columns={columns}
        dataSource={profiles}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{
          total,
          current: page,
          pageSize: PAGE_SIZE,
          showTotal: (t) => `${t} profiles`,
          onChange: (p) => { setPage(p); loadProfiles(p, search, groupFilter); },
          showSizeChanger: false,
        }}
        locale={{ emptyText: <Empty description="Không có profiles" /> }}
        rowClassName={(r) => runningIds.has(r.id) ? "profile-row-running" : ""}
      />

      {/* ── Proxy Checker Panel ── */}
      <Card
        title={<><WifiOutlined style={{ marginRight: 8 }} />Kiểm tra Proxy</>}
        size="small"
        style={{ marginTop: 16 }}
        extra={<Tooltip title="Nhập chuỗi proxy để kiểm tra IP và quốc gia"><InfoCircleOutlined /></Tooltip>}
      >
        <Row gutter={8} align="middle">
          <Col flex="auto">
            <Input
              placeholder="VD: socks5://user:pass@127.0.0.1:5000 hoặc http://ip:port"
              value={proxyInput}
              onChange={e => { setProxyInput(e.target.value); setProxyResult(null); }}
              onPressEnter={handleCheckProxy}
              prefix={<GlobalOutlined style={{ color: "#9ca3af" }} />}
            />
          </Col>
          <Col>
            <Button
              icon={<CheckCircleOutlined />}
              loading={proxyChecking}
              onClick={handleCheckProxy}
              type="primary"
              ghost
            >
              Kiểm tra
            </Button>
          </Col>
        </Row>
        {proxyResult && (
          <div style={{ marginTop: 10 }}>
            {proxyResult.success ? (
              <Alert
                type="success"
                showIcon
                message={
                  <Space split="·">
                    <span>🌐 IP: <strong>{proxyResult.ip}</strong></span>
                    <span>🏳️ {proxyResult.country}</span>
                    {proxyResult.isp && <span>📡 {proxyResult.isp}</span>}
                  </Space>
                }
              />
            ) : (
              <Alert type="error" showIcon message="Proxy không hoạt động hoặc không thể kết nối" />
            )}
          </div>
        )}
      </Card>

      {/* ── Create / Edit Profile Modal ── */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            {editingProfile ? `Sửa Profile: ${editingProfile.name}` : "Tạo Profile mới"}
          </Space>
        }
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={handleSaveProfile}
        confirmLoading={saving}
        width={640}
        centered
        okText="Lưu"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Tabs
            activeKey={activeFormTab}
            onChange={setActiveFormTab}
            items={[
              {
                key: "basic",
                label: <><UserOutlined />Cơ bản</>,
                children: (
                  <>
                    <Form.Item name="name" label="Tên Profile" rules={[{ required: true, message: "Nhập tên profile" }]}>
                      <Input placeholder="VD: FB_Account_01" />
                    </Form.Item>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="group_id" label="Nhóm">
                          <Select placeholder="Chọn nhóm" allowClear>
                            {groups.map(g => <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>)}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="task_bar_title" label="Taskbar Title">
                          <Input placeholder="Tên hiển thị trên taskbar" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="browser_type" label="Trình duyệt">
                          <Select>
                            <Select.Option value={1}>Chrome</Select.Option>
                            <Select.Option value={2}>Firefox</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="browser_version" label="Phiên bản Browser">
                          <Select placeholder="Chọn hoặc nhập phiên bản" allowClear showSearch>
                            {browserVersions.map(v => <Select.Option key={v} value={v}>{v}</Select.Option>)}
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="os_type" label="Hệ điều hành">
                      <Select>
                        {Object.entries(GPM_OS_TYPE_LABELS).map(([k, v]) => (
                          <Select.Option key={k} value={Number(k)}>{v}</Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item name="custom_user_agent" label="User Agent tùy chỉnh">
                      <Input.TextArea rows={2} placeholder="Để trống để dùng UA mặc định" />
                    </Form.Item>
                    <Form.Item name="note" label="Ghi chú">
                      <Input placeholder="Ghi chú (email FB, tên chủ sở hữu...)" />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: "proxy",
                label: <><WifiOutlined />Proxy</>,
                children: (
                  <>
                    <Form.Item name="raw_proxy" label="Proxy">
                      <Input.TextArea
                        rows={3}
                        placeholder="Nhập proxy string&#10;VD: socks5://user:pass@127.0.0.1:5000&#10;hoặc http://ip:port"
                      />
                    </Form.Item>
                    {proxies.length > 0 && (
                      <Form.Item label="Hoặc chọn proxy lưu sẵn">
                        <Select
                          placeholder="Chọn proxy từ danh sách"
                          allowClear
                          showSearch
                          onChange={(val: string) => form.setFieldValue("raw_proxy", val)}
                        >
                          {proxies.map(p => (
                            <Select.Option key={p.id} value={p.raw_proxy}>
                              {p.name} — <span style={{ color: "#6b7280", fontSize: 11 }}>{p.raw_proxy}</span>
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    )}
                    <Divider style={{ margin: "8px 0" }} />
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Định dạng: <code>socks5://user:pass@host:port</code> hoặc <code>http://host:port</code>
                    </div>
                  </>
                ),
              },
              {
                key: "fingerprint",
                label: <><SettingOutlined />Fingerprint</>,
                children: (
                  <>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="webrtc_mode" label="WebRTC Mode">
                          <Select placeholder="Chọn..." allowClear>
                            {Object.entries(GPM_WEBRTC_MODE_LABELS).map(([k, v]) => (
                              <Select.Option key={k} value={Number(k)}>{v}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="canvas_mode" label="Canvas Mode">
                          <Select placeholder="Chọn..." allowClear>
                            {Object.entries(GPM_CANVAS_MODE_LABELS).map(([k, v]) => (
                              <Select.Option key={k} value={Number(k)}>{v}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="audio_mode" label="Audio Mode">
                          <Select placeholder="Chọn..." allowClear>
                            {Object.entries(GPM_AUDIO_MODE_LABELS).map(([k, v]) => (
                              <Select.Option key={k} value={Number(k)}>{v}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="font_mode" label="Font Mode">
                          <Select placeholder="Chọn..." allowClear>
                            {Object.entries(GPM_FONT_MODE_LABELS).map(([k, v]) => (
                              <Select.Option key={k} value={Number(k)}>{v}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="timezone_base_on_ip" label="Timezone">
                          <Select>
                            <Select.Option value={true}>Theo IP</Select.Option>
                            <Select.Option value={false}>Tùy chỉnh</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="timezone" label="Timezone cố định">
                          <Input placeholder="VD: Asia/Ho_Chi_Minh" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="is_language_base_on_ip" label="Ngôn ngữ">
                          <Select>
                            <Select.Option value={true}>Theo IP</Select.Option>
                            <Select.Option value={false}>Tùy chỉnh</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="fixed_language" label="Ngôn ngữ cố định">
                          <Input placeholder="VD: vi-VN,vi;q=0.9" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ),
              },
              {
                key: "startup",
                label: <><ApiOutlined />Startup</>,
                children: (
                  <Form.Item name="startup_urls" label="Startup URLs">
                    <Input.TextArea
                      rows={4}
                      placeholder="Nhập URLs mở khi khởi động (mỗi URL 1 dòng)&#10;VD: https://facebook.com"
                    />
                  </Form.Item>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      {/* ── Profile Detail Modal ── */}
      <Modal
        title={<Space><InfoCircleOutlined />Chi tiết Profile: {detailProfile?.name}</Space>}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={[
          ...(isAdmin ? [
            <Button key="edit" icon={<EditOutlined />} onClick={() => {
              setDetailOpen(false);
              if (detailProfile) openEditForm(detailProfile);
            }}>
              Sửa
            </Button>,
          ] : []),
          <Button key="close" onClick={() => setDetailOpen(false)}>Đóng</Button>,
        ]}
        width={540}
        centered
        destroyOnHidden
      >
        {detailProfile && (
          <div style={{ fontSize: 13 }}>
            <Row gutter={[8, 6]}>
              {[
                ["ID", detailProfile.id],
                ["Tên", detailProfile.name],
                ["Nhóm", groups.find(g => g.id === detailProfile.group_id)?.name ?? "—"],
                ["Proxy", detailProfile.raw_proxy ?? "Không có"],
                ["Browser", `${getBrowserLabel(detailProfile)} ${getBrowserVersion(detailProfile)}`.trim()],
                ["OS", getOsLabel(detailProfile)],
                ["WebRTC", detailProfile.webrtc_mode ? GPM_WEBRTC_MODE_LABELS[detailProfile.webrtc_mode] : "—"],
                ["Canvas", detailProfile.canvas_mode ? GPM_CANVAS_MODE_LABELS[detailProfile.canvas_mode] : "—"],
                ["Timezone", detailProfile.timezone_base_on_ip ? "Theo IP" : (detailProfile.timezone ?? "—")],
                ["Ngôn ngữ", detailProfile.is_language_base_on_ip ? "Theo IP" : (detailProfile.fixed_language ?? "—")],
                ["Ghi chú", detailProfile.note ?? "—"],
                ["Tạo lúc", detailProfile.created_at ? new Date(detailProfile.created_at).toLocaleString("vi-VN") : "—"],
                ["Cập nhật", detailProfile.updated_at ? new Date(detailProfile.updated_at).toLocaleString("vi-VN") : "—"],
              ].map(([label, value]) => (
                <React.Fragment key={label}>
                  <Col span={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{label}:</Text>
                  </Col>
                  <Col span={16}>
                    <Text style={{ fontSize: 12, wordBreak: "break-all" }}>{value}</Text>
                  </Col>
                </React.Fragment>
              ))}
            </Row>
            {runningIds.has(detailProfile.id) && (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 12 }}
                message={`Browser đang chạy${runningPorts[detailProfile.id] ? ` — Debug port: ${runningPorts[detailProfile.id]}` : ""}`}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
