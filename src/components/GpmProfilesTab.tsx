/**
 * GpmProfilesTab - giao dien gon cho workflow noi bo:
 * tao nhom, them profile, tao hang loat, them/sua proxy va kiem tra proxy.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ApiOutlined,
  CheckCircleOutlined,
  EditOutlined,
  FolderOutlined,
  GlobalOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import {
  checkGpmBridgeHealth,
  checkGpmProxy,
  createGpmGroup,
  createGpmProfile,
  createGpmProxy,
  getGpmGroups,
  getGpmProfiles,
  getGpmProxies,
  updateGpmProfile,
} from "@/service/gpmApiService";
import type {
  GpmGroup,
  GpmProfile,
  GpmProfileDTO,
  GpmProxy,
} from "@/types/gpm";

const { Search, TextArea } = Input;
const { Text } = Typography;
const PAGE_SIZE = 50;

type ProxyCheckState = {
  rawProxy: string;
  success: boolean;
  ip?: string;
  country?: string;
  isp?: string;
  message?: string;
};

type ProfileFormValues = {
  name: string;
  group_id?: string;
  raw_proxy?: string;
  raw_proxy_select?: string;
};

type BatchFormValues = {
  names: string;
  group_id?: string;
  raw_proxy?: string;
  raw_proxy_select?: string;
};

type ProxyFormValues = {
  name: string;
  raw_proxy: string;
};

type ProfileProxyFormValues = {
  raw_proxy?: string;
  raw_proxy_select?: string;
};

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function profileMatchesSearch(profile: GpmProfile, search: string): boolean {
  const query = normalizeSearchText(search);
  if (!query) return true;

  return [profile.name, profile.raw_proxy, profile.note]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function parseProfileNames(value: string): string[] {
  const names = value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set(names));
}

async function fetchAllGpmProfiles(): Promise<GpmProfile[]> {
  const first = await getGpmProfiles({ page: 1, page_size: 1000 });
  const profiles = [...first.data];

  let page = 2;
  while (profiles.length < first.total) {
    const next = await getGpmProfiles({ page, page_size: 1000 });
    if (next.data.length === 0) break;
    profiles.push(...next.data);
    page += 1;
  }

  return profiles;
}

export function GpmProfilesTab({ isAdmin }: { isAdmin: boolean }) {
  const [profiles, setProfiles] = useState<GpmProfile[]>([]);
  const [groups, setGroups] = useState<GpmGroup[]>([]);
  const [proxies, setProxies] = useState<GpmProxy[]>([]);

  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | undefined>();

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm] = Form.useForm<ProfileFormValues>();

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchForm] = Form.useForm<BatchFormValues>();

  const [groupOpen, setGroupOpen] = useState(false);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupForm] = Form.useForm<{ name: string }>();

  const [proxyOpen, setProxyOpen] = useState(false);
  const [proxySaving, setProxySaving] = useState(false);
  const [proxyForm] = Form.useForm<ProxyFormValues>();

  const [profileProxyOpen, setProfileProxyOpen] = useState(false);
  const [profileProxySaving, setProfileProxySaving] = useState(false);
  const [proxyEditingProfile, setProxyEditingProfile] = useState<GpmProfile | null>(null);
  const [profileProxyForm] = Form.useForm<ProfileProxyFormValues>();

  const [proxyInput, setProxyInput] = useState("");
  const [proxyChecking, setProxyChecking] = useState(false);
  const [checkingProxyKey, setCheckingProxyKey] = useState<string | null>(null);
  const [proxyResult, setProxyResult] = useState<ProxyCheckState | null>(null);

  const requestIdRef = useRef(0);
  const pageRef = useRef(1);
  const searchRef = useRef("");
  const groupFilterRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  useEffect(() => {
    groupFilterRef.current = groupFilter;
  }, [groupFilter]);

  const getGroupName = useCallback(
    (groupId?: string | null) => groups.find((group) => group.id === groupId)?.name ?? "",
    [groups]
  );

  const proxyOptions = useMemo(
    () => proxies.map((proxy) => ({
      label: proxy.name + " - " + proxy.raw_proxy,
      value: proxy.raw_proxy,
    })),
    [proxies]
  );

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const [groupsResult, proxiesResult] = await Promise.allSettled([
        getGpmGroups(),
        getGpmProxies(),
      ]);

      if (groupsResult.status === "fulfilled") {
        setGroups(groupsResult.value);
      } else {
        message.warning("Không tải được danh sách nhóm GPM");
      }

      if (proxiesResult.status === "fulfilled") {
        setProxies(proxiesResult.value);
      } else {
        setProxies([]);
      }
    } finally {
      setMetaLoading(false);
    }
  }, []);

  const loadProfiles = useCallback(async (
    nextPage = pageRef.current,
    nextSearch = searchRef.current,
    nextGroup = groupFilterRef.current
  ) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    try {
      const shouldFilterLocally = Boolean(nextGroup || nextSearch.trim());
      const pagedResult = shouldFilterLocally
        ? null
        : await getGpmProfiles({ page: nextPage, page_size: PAGE_SIZE });
      const source = shouldFilterLocally ? await fetchAllGpmProfiles() : pagedResult?.data ?? [];

      const filtered = source.filter((profile) => {
        const groupMatched = nextGroup ? profile.group_id === nextGroup : true;
        return groupMatched && profileMatchesSearch(profile, nextSearch);
      });

      if (requestId !== requestIdRef.current) return;

      setProfiles(
        shouldFilterLocally
          ? filtered.slice((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE)
          : filtered
      );
      setTotal(shouldFilterLocally ? filtered.length : pagedResult?.total ?? filtered.length);
    } catch (err) {
      if (requestId === requestIdRef.current) {
        message.error("Không tải được profiles: " + (err instanceof Error ? err.message : String(err)));
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadProfiles(), loadMeta()]);
  }, [loadProfiles, loadMeta]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const ok = await checkGpmBridgeHealth();
      if (!alive) return;
      setBridgeOk(ok);
      if (ok) {
        await Promise.all([loadMeta(), loadProfiles(1, "", undefined)]);
      }
    }

    void boot();

    const timer = window.setInterval(() => {
      void loadProfiles(pageRef.current, searchRef.current, groupFilterRef.current);
    }, 10000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [loadMeta, loadProfiles]);

  const handleSearchChange = (value: string) => {
    searchRef.current = value;
    pageRef.current = 1;
    setSearch(value);
    setPage(1);
    void loadProfiles(1, value, groupFilterRef.current);
  };

  const handleGroupFilter = (value: string | undefined) => {
    groupFilterRef.current = value;
    pageRef.current = 1;
    setGroupFilter(value);
    setPage(1);
    void loadProfiles(1, searchRef.current, value);
  };

  const openCreateProfile = () => {
    profileForm.resetFields();
    profileForm.setFieldsValue({
      group_id: groupFilterRef.current,
      raw_proxy: "",
      raw_proxy_select: undefined,
    });
    setProfileOpen(true);
  };

  const handleCreateProfile = async () => {
    try {
      const values = await profileForm.validateFields();
      const payload: GpmProfileDTO = {
        name: values.name.trim(),
        group_id: values.group_id ?? null,
        raw_proxy: values.raw_proxy?.trim() || null,
        browser_type: 1,
        os_type: 1,
      };

      setProfileSaving(true);
      await createGpmProfile(payload);
      message.success("Đã thêm profile");
      setProfileOpen(false);
      await loadProfiles(pageRef.current, searchRef.current, groupFilterRef.current);
    } catch (err) {
      if (err instanceof Error) message.error("Thêm profile thất bại: " + err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleBatchCreate = async () => {
    try {
      const values = await batchForm.validateFields();
      const names = parseProfileNames(values.names);
      if (names.length === 0) {
        message.warning("Nhập ít nhất một tên profile");
        return;
      }

      setBatchSaving(true);
      let successCount = 0;
      const failed: string[] = [];

      for (const name of names) {
        try {
          await createGpmProfile({
            name,
            group_id: values.group_id ?? null,
            raw_proxy: values.raw_proxy?.trim() || null,
            browser_type: 1,
            os_type: 1,
          });
          successCount += 1;
        } catch {
          failed.push(name);
        }
      }

      if (failed.length > 0) {
        message.warning("Đã tạo " + successCount + "/" + names.length + " profile. Lỗi: " + failed.join(", "));
      } else {
        message.success("Đã tạo " + successCount + " profile");
        setBatchOpen(false);
        batchForm.resetFields();
      }

      await loadProfiles(1, searchRef.current, groupFilterRef.current);
    } finally {
      setBatchSaving(false);
    }
  };

  const handleCreateGroup = async () => {
    try {
      const values = await groupForm.validateFields();
      setGroupSaving(true);
      const group = await createGpmGroup({ name: values.name.trim() });
      message.success("Đã tạo nhóm " + group.name);
      setGroupOpen(false);
      groupForm.resetFields();
      await loadMeta();
    } catch (err) {
      if (err instanceof Error) message.error("Tạo nhóm thất bại: " + err.message);
    } finally {
      setGroupSaving(false);
    }
  };

  const handleCreateProxy = async () => {
    try {
      const values = await proxyForm.validateFields();
      setProxySaving(true);
      await createGpmProxy({
        name: values.name.trim(),
        raw_proxy: values.raw_proxy.trim(),
      });
      message.success("Đã thêm proxy");
      setProxyOpen(false);
      proxyForm.resetFields();
      await loadMeta();
    } catch (err) {
      if (err instanceof Error) message.error("Thêm proxy thất bại: " + err.message);
    } finally {
      setProxySaving(false);
    }
  };

  const openProfileProxyEditor = (profile: GpmProfile) => {
    setProxyEditingProfile(profile);
    profileProxyForm.resetFields();
    profileProxyForm.setFieldsValue({
      raw_proxy: profile.raw_proxy ?? "",
      raw_proxy_select: undefined,
    });
    setProfileProxyOpen(true);
  };

  const handleSaveProfileProxy = async () => {
    if (!proxyEditingProfile) return;

    try {
      const values = await profileProxyForm.validateFields();
      setProfileProxySaving(true);
      await updateGpmProfile(proxyEditingProfile.id, {
        raw_proxy: values.raw_proxy?.trim() || null,
      });
      message.success("Đã cập nhật proxy cho profile");
      setProfileProxyOpen(false);
      setProxyEditingProfile(null);
      await loadProfiles(pageRef.current, searchRef.current, groupFilterRef.current);
    } catch (err) {
      if (err instanceof Error) message.error("Cập nhật proxy thất bại: " + err.message);
    } finally {
      setProfileProxySaving(false);
    }
  };

  const checkProxyValue = async (rawProxy: string, key = "manual") => {
    const value = rawProxy.trim();
    if (!value) {
      message.warning("Nhập proxy để kiểm tra");
      return;
    }

    setProxyInput(value);
    setProxyChecking(true);
    setCheckingProxyKey(key);
    setProxyResult(null);

    try {
      const res = await checkGpmProxy(value);
      const result: ProxyCheckState = {
        rawProxy: value,
        success: res.success,
        ip: res.data?.ip,
        country: res.data?.country,
        isp: res.data?.isp,
        message: res.message,
      };
      setProxyResult(result);

      if (res.success) {
        message.success("Proxy hoạt động");
      } else {
        message.error("Proxy lỗi: " + (res.message || "Không kết nối được"));
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      setProxyResult({ rawProxy: value, success: false, message: messageText });
      message.error("Kiểm tra proxy thất bại: " + messageText);
    } finally {
      setProxyChecking(false);
      setCheckingProxyKey(null);
    }
  };

  const columns: ColumnsType<GpmProfile> = [
    {
      title: "Tên profile",
      dataIndex: "name",
      key: "name",
      width: 280,
      render: (_value, profile) => (
        <Space size={10}>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "#eef2ff",
            display: "grid",
            placeItems: "center",
            color: "#2563eb",
          }}>
            <UserOutlined />
          </div>
          <div style={{ minWidth: 0 }}>
            <Text strong ellipsis={{ tooltip: profile.name }} style={{ maxWidth: 210 }}>
              {profile.name}
            </Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID: {profile.id}
              </Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Nhóm",
      dataIndex: "group_id",
      key: "group_id",
      width: 180,
      render: (groupId?: string | null) => {
        const groupName = getGroupName(groupId);
        return groupName ? (
          <Tag icon={<FolderOutlined />} color="blue">{groupName}</Tag>
        ) : (
          <Text type="secondary">Chưa nhóm</Text>
        );
      },
    },
    {
      title: "Proxy",
      dataIndex: "raw_proxy",
      key: "raw_proxy",
      render: (proxy?: string | null) => proxy ? (
        <Text ellipsis={{ tooltip: proxy }} style={{ maxWidth: 360 }}>
          {proxy}
        </Text>
      ) : (
        <Text type="secondary">Chưa có proxy</Text>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "is_running",
      key: "status",
      width: 140,
      render: (isRunning?: boolean) => (
        isRunning ? <Tag color="processing">Đang mở</Tag> : <Tag color="success">Sẵn sàng</Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 230,
      align: "right",
      render: (_value, profile) => (
        <Space size={6}>
          <Button
            size="small"
            icon={<EditOutlined />}
            disabled={!isAdmin}
            onClick={() => openProfileProxyEditor(profile)}
          >
            {profile.raw_proxy ? "Sửa proxy" : "Thêm proxy"}
          </Button>
          <Tooltip title={profile.raw_proxy ? "Kiểm tra proxy của profile này" : "Profile chưa có proxy"}>
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              disabled={!profile.raw_proxy || proxyChecking}
              loading={checkingProxyKey === profile.id}
              onClick={() => void checkProxyValue(profile.raw_proxy ?? "", profile.id)}
            >
              Kiểm tra
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (bridgeOk === null) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  if (bridgeOk === false) {
    return (
      <Alert
        type="error"
        showIcon
        message="GPM Bridge không phản hồi"
        description="Không thể kết nối đến GPM Bridge tại http://localhost:3001."
        action={
          <Button
            danger
            icon={<ReloadOutlined />}
            onClick={async () => {
              setBridgeOk(null);
              const ok = await checkGpmBridgeHealth();
              setBridgeOk(ok);
              if (ok) await refreshAll();
            }}
          >
            Thử lại
          </Button>
        }
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
      }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Space wrap>
              <Button
                icon={<FolderOutlined />}
                onClick={() => setGroupOpen(true)}
                disabled={!isAdmin}
              >
                Tạo nhóm
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateProfile}
                disabled={!isAdmin}
              >
                Thêm mới
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ background: "#f97316", borderColor: "#f97316" }}
                onClick={() => {
                  batchForm.resetFields();
                  batchForm.setFieldsValue({ group_id: groupFilterRef.current });
                  setBatchOpen(true);
                }}
                disabled={!isAdmin}
              >
                Tạo hàng loạt
              </Button>
              <Button
                icon={<ApiOutlined />}
                onClick={() => setProxyOpen(true)}
                disabled={!isAdmin}
              >
                Thêm proxy
              </Button>
            </Space>
          </Col>
          <Col>
            <Tooltip title="Tải lại profiles, nhóm và proxy">
              <Button
                icon={<ReloadOutlined />}
                loading={loading || metaLoading}
                onClick={() => void refreshAll()}
              />
            </Tooltip>
          </Col>
        </Row>

        <Row gutter={[10, 10]} style={{ marginTop: 14 }}>
          <Col xs={24} md={10} lg={8}>
            <Search
              placeholder="Tìm profile hoặc proxy..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              onSearch={handleSearchChange}
              allowClear
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} md={8} lg={6}>
            <Select
              placeholder="Lọc theo nhóm"
              value={groupFilter}
              onChange={handleGroupFilter}
              allowClear
              style={{ width: "100%" }}
              options={groups.map((group) => ({ label: group.name, value: group.id }))}
            />
          </Col>
          <Col xs={24} md={6} lg={4}>
            <Tag color="default" style={{ height: 32, display: "inline-flex", alignItems: "center" }}>
              Tổng: {total}
            </Tag>
          </Col>
        </Row>
      </div>

      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={profiles}
        loading={loading}
        locale={{ emptyText: <Empty description="Không có profile" /> }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: (count) => String(count) + " profiles",
          onChange: (nextPage) => {
            pageRef.current = nextPage;
            setPage(nextPage);
            void loadProfiles(nextPage, searchRef.current, groupFilterRef.current);
          },
        }}
        scroll={{ x: 900 }}
      />

      <Card
        size="small"
        title={<Space><WifiOutlined />Kiểm tra proxy</Space>}
        extra={<Text type="secondary">{proxies.length} proxy đã lưu</Text>}
      >
        <Row gutter={[8, 8]} align="middle">
          <Col xs={24} md={18}>
            <Input
              placeholder="Nhập proxy để kiểm tra"
              value={proxyInput}
              onChange={(event) => {
                setProxyInput(event.target.value);
                setProxyResult(null);
              }}
              onPressEnter={() => void checkProxyValue(proxyInput)}
              prefix={<GlobalOutlined />}
            />
          </Col>
          <Col xs={24} md={6}>
            <Button
              block
              icon={<CheckCircleOutlined />}
              loading={proxyChecking && checkingProxyKey === "manual"}
              onClick={() => void checkProxyValue(proxyInput)}
            >
              Kiểm tra
            </Button>
          </Col>
        </Row>

        {proxyResult && (
          <Alert
            style={{ marginTop: 12 }}
            type={proxyResult.success ? "success" : "error"}
            showIcon
            message={proxyResult.success ? "Proxy hoạt động" : "Proxy không hoạt động"}
            description={
              proxyResult.success ? (
                <Space wrap>
                  <Text>IP: {proxyResult.ip ?? "-"}</Text>
                  <Text>Quốc gia: {proxyResult.country ?? "-"}</Text>
                  {proxyResult.isp && <Text>ISP: {proxyResult.isp}</Text>}
                </Space>
              ) : (
                proxyResult.message || "Không thể kết nối proxy"
              )
            }
          />
        )}
      </Card>

      <Modal
        title="Tạo nhóm"
        open={groupOpen}
        forceRender
        onCancel={() => setGroupOpen(false)}
        onOk={handleCreateGroup}
        confirmLoading={groupSaving}
        okText="Tạo nhóm"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item
            name="name"
            label="Tên nhóm"
            rules={[{ required: true, message: "Nhập tên nhóm" }]}
          >
            <Input placeholder="VD: Seeding" autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Thêm profile"
        open={profileOpen}
        forceRender
        onCancel={() => setProfileOpen(false)}
        onOk={handleCreateProfile}
        confirmLoading={profileSaving}
        okText="Thêm profile"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={profileForm} layout="vertical">
          <Form.Item
            name="name"
            label="Tên profile"
            rules={[{ required: true, message: "Nhập tên profile" }]}
          >
            <Input placeholder="VD: FB_001" autoFocus />
          </Form.Item>
          <Form.Item name="group_id" label="Nhóm">
            <Select
              placeholder="Chọn nhóm"
              allowClear
              options={groups.map((group) => ({ label: group.name, value: group.id }))}
            />
          </Form.Item>
          <Form.Item name="raw_proxy_select" label="Chọn proxy đã lưu">
            <Select
              placeholder="Chọn proxy"
              allowClear
              showSearch
              optionFilterProp="label"
              options={proxyOptions}
              onChange={(value?: string) => profileForm.setFieldValue("raw_proxy", value ?? "")}
            />
          </Form.Item>
          <Form.Item name="raw_proxy" label="Proxy">
            <TextArea rows={3} placeholder="host:port:user:pass hoặc protocol://user:pass@host:port" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Tạo hàng loạt"
        open={batchOpen}
        forceRender
        onCancel={() => setBatchOpen(false)}
        onOk={handleBatchCreate}
        confirmLoading={batchSaving}
        okText="Tạo hàng loạt"
        cancelText="Hủy"
        destroyOnHidden
        width={620}
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item
            name="names"
            label="Danh sách tên profile"
            rules={[{ required: true, message: "Nhập danh sách profile" }]}
          >
            <TextArea
              rows={8}
              placeholder={"FB_001\nFB_002\nFB_003"}
              autoFocus
            />
          </Form.Item>
          <Form.Item name="group_id" label="Nhóm">
            <Select
              placeholder="Chọn nhóm"
              allowClear
              options={groups.map((group) => ({ label: group.name, value: group.id }))}
            />
          </Form.Item>
          <Form.Item name="raw_proxy_select" label="Chọn proxy dùng chung">
            <Select
              placeholder="Chọn proxy"
              allowClear
              showSearch
              optionFilterProp="label"
              options={proxyOptions}
              onChange={(value?: string) => batchForm.setFieldValue("raw_proxy", value ?? "")}
            />
          </Form.Item>
          <Form.Item name="raw_proxy" label="Proxy dùng chung">
            <TextArea rows={3} placeholder="Bỏ trống nếu chưa gán proxy" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Thêm proxy"
        open={proxyOpen}
        forceRender
        onCancel={() => setProxyOpen(false)}
        onOk={handleCreateProxy}
        confirmLoading={proxySaving}
        okText="Thêm proxy"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={proxyForm} layout="vertical">
          <Form.Item
            name="name"
            label="Tên proxy"
            rules={[{ required: true, message: "Nhập tên proxy" }]}
          >
            <Input placeholder="VD: Proxy Viettel 01" autoFocus />
          </Form.Item>
          <Form.Item
            name="raw_proxy"
            label="Proxy"
            rules={[{ required: true, message: "Nhập proxy" }]}
          >
            <TextArea rows={3} placeholder="host:port:user:pass hoặc protocol://user:pass@host:port" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={proxyEditingProfile ? "Sửa proxy: " + proxyEditingProfile.name : "Sửa proxy"}
        open={profileProxyOpen}
        forceRender
        onCancel={() => {
          setProfileProxyOpen(false);
          setProxyEditingProfile(null);
        }}
        onOk={handleSaveProfileProxy}
        confirmLoading={profileProxySaving}
        okText="Lưu proxy"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={profileProxyForm} layout="vertical">
          <Form.Item name="raw_proxy_select" label="Chọn proxy đã lưu">
            <Select
              placeholder="Chọn proxy"
              allowClear
              showSearch
              optionFilterProp="label"
              options={proxyOptions}
              onChange={(value?: string) => profileProxyForm.setFieldValue("raw_proxy", value ?? "")}
            />
          </Form.Item>
          <Form.Item name="raw_proxy" label="Proxy">
            <TextArea rows={4} placeholder="Bỏ trống để gỡ proxy khỏi profile" autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
