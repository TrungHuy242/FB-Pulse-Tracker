/**
 * CommentsPage — Trang xem và quản lý bình luận.
 * Tính năng: tìm kiếm toàn văn, lọc theo tác giả/nhóm/tài khoản/ngày/cảm xúc,
 * danh sách phân trang, xuất CSV / JSON / Excel.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Input, Button, Select, DatePicker, Table, Tag, Space, Tooltip,
  Row, Col, Skeleton, Empty, Typography, Dropdown, Alert,
} from "antd";
import {
  SearchOutlined, ClearOutlined, CommentOutlined, DownloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { AppLayout } from "@/layouts/AppLayout";
import { useAllComments, type CommentFilter } from "@/hooks/useAllComments";
import { getAccountNames } from "@/service/importService";
import { formatDateTime } from "@/utils/commentExport";
import {
  exportCommentsToCSV,
  exportCommentsToJSON,
  exportCommentsToXLSX,
} from "@/utils/commentExport";
import type { RichComment } from "@/hooks/useAllComments";

const { Text } = Typography;
const PAGE_SIZE = 25;

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CommentsPage() {
  // Filter state
  const [keyword, setKeyword] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [page, setPage] = useState(1);

  // Committed filter (only applies on button click)
  const [activeFilter, setActiveFilter] = useState<CommentFilter>({});

  const [refreshSignal, setRefreshSignal] = useState(0);

  // Account options for dropdown
  const [accountOptions, setAccountOptions] = useState<string[]>([]);

  useEffect(() => {
    getAccountNames().then(setAccountOptions).catch(console.error);
  }, []);

  const { comments, loading, total, hasMore } = useAllComments(activeFilter, refreshSignal);

  // Group options derived from loaded data
  const groupOptions = useMemo(() => {
    const groups = new Set<string>();
    for (const c of comments) {
      if (c.group) groups.add(c.group);
    }
    return Array.from(groups).sort();
  }, [comments]);

  const handleSearch = useCallback(() => {
    setPage(1);
    setActiveFilter({
      keyword: keyword.trim() || undefined,
      author: authorInput.trim() || undefined,
      account: selectedAccount,
      group: selectedGroup,
      from: range?.[0] ? dayjs(range[0]).startOf("day").toDate() : null,
      to: range?.[1] ? dayjs(range[1]).endOf("day").toDate() : null,
    });
  }, [keyword, authorInput, selectedAccount, selectedGroup, range]);

  const handleClear = useCallback(() => {
    setKeyword("");
    setAuthorInput("");
    setSelectedAccount(undefined);
    setSelectedGroup(undefined);
    setRange(null);
    setActiveFilter({});
  }, []);

  // Client-side pagination
  const paginatedComments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return comments.slice(start, start + PAGE_SIZE);
  }, [comments, page]);

  /** Tổng số rows */
  const filteredTotal = comments.length;

  // ── Export menu ────────────────────────────────────────────────────────────

  const exportDisabled = loading || comments.length === 0;

  const exportMenuItems = [
    { key: "csv",   label: "Xuất CSV (.csv)" },
    { key: "json",  label: "Xuất JSON (.json)" },
    { key: "excel", label: "Xuất Excel (.xlsx)" },
  ];

  const handleExportMenu = useCallback(({ key }: { key: string }) => {
    if (key === "csv")   exportCommentsToCSV(comments);
    if (key === "json")  exportCommentsToJSON(comments);
    if (key === "excel") exportCommentsToXLSX(comments);
  }, [comments]);

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns = [
    {
      title: "Tác giả",
      dataIndex: "authorName",
      key: "authorName",
      width: 150,
      render: (v: string) => (
        <Text strong style={{ fontSize: 13 }}>
          {v || <span style={{ color: "#aaa" }}>—</span>}
        </Text>
      ),
    },
    {
      title: "Nội dung",
      dataIndex: "content",
      key: "content",
      render: (v: string) => (
        <span style={{ fontSize: 13, color: "#171717", lineHeight: 1.5 }}>
          {v || <span style={{ color: "#aaa" }}>—</span>}
        </span>
      ),
    },
    {
      title: "Bài viết",
      dataIndex: "postUrl",
      key: "postUrl",
      width: 100,
      render: (v: string) => {
        if (!v) return <span style={{ color: "#aaa" }}>—</span>;
        return (
          <Tooltip title={v}>
            <a
              href={v}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}
            >
              Mở link
            </a>
          </Tooltip>
        );
      },
    },
    {
      title: "Nhóm",
      dataIndex: "group",
      key: "group",
      width: 130,
      render: (v: string) =>
        v ? (
          <Tag style={{
            background: "#f4f4f4", border: "1px solid #dfdfdf",
            color: "#3b3b3b", borderRadius: 4, fontSize: 11,
          }}>
            {v}
          </Tag>
        ) : <span style={{ color: "#aaa" }}>—</span>,
    },
    {
      title: "Tài khoản",
      dataIndex: "accountName",
      key: "accountName",
      width: 130,
      render: (v: string) => (
        <span style={{ fontSize: 12, color: "#6b6b6b" }}>{v}</span>
      ),
    },
    {
      title: "Thời gian",
      dataIndex: "commentTime",
      key: "commentTime",
      width: 160,
      render: (ts: number) => (
        <span style={{ fontSize: 12, color: "#6b6b6b", whiteSpace: "nowrap" }}>
          {formatDateTime(ts)}
        </span>
      ),
    },
  ];

  // ── Top bar ────────────────────────────────────────────────────────────────

  const topBar = (
    <Space size={6} wrap>
      <Input
        prefix={<SearchOutlined style={{ color: "#9a9a9a" }} />}
        placeholder="Tìm từ khóa trong nội dung..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onPressEnter={handleSearch}
        size="small"
        style={{ width: 220 }}
        allowClear
      />
      <Input
        placeholder="Tên tác giả..."
        value={authorInput}
        onChange={(e) => setAuthorInput(e.target.value)}
        onPressEnter={handleSearch}
        size="small"
        style={{ width: 150 }}
        allowClear
      />
      <Select
        placeholder="Tài khoản"
        size="small"
        style={{ minWidth: 140 }}
        value={selectedAccount}
        onChange={setSelectedAccount}
        allowClear
      >
        {accountOptions.map((name, i) => (
          <Select.Option key={`${name}-${i}`} value={name}>{name}</Select.Option>
        ))}
      </Select>
      {groupOptions.length > 0 && (
        <Select
          placeholder="Nhóm"
          size="small"
          style={{ minWidth: 120 }}
          value={selectedGroup}
          onChange={setSelectedGroup}
          allowClear
        >
          {groupOptions.map((g, i) => (
            <Select.Option key={`${g}-${i}`} value={g}>{g}</Select.Option>
          ))}
        </Select>
      )}
      <DatePicker.RangePicker
        value={range}
        size="small"
        onChange={(dates) => {
          if (!dates || !dates[0] || !dates[1]) setRange(null);
          else setRange([dates[0], dates[1]]);
        }}
        placeholder={["Từ ngày", "Đến ngày"]}
        allowClear
      />
      <Button type="primary" size="small" icon={<SearchOutlined />} onClick={handleSearch}>
        Tìm
      </Button>
      <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>
        Xóa
      </Button>

      {/* Export dropdown: CSV + JSON */}
      <Dropdown
        menu={{ items: exportMenuItems, onClick: handleExportMenu }}
        disabled={exportDisabled}
        trigger={["click"]}
      >
        <Button
          size="small"
          icon={<DownloadOutlined />}
          disabled={exportDisabled}
          title="Xuất danh sách bình luận hiện tại"
        >
          Xuất <span style={{ fontSize: 10 }}>▼</span>
        </Button>
      </Dropdown>
    </Space>
  );

  const hasActiveFilter = Object.values(activeFilter).some(Boolean);

  return (
    <AppLayout title="Bình luận" topBar={topBar}>
      {/* Giới hạn load cảnh báo */}
      {hasMore && (
        <Alert
          type="warning"
          message={`Đã hiển thị tối đa 5.000 bình luận đầu tiên. Dùng bộ lọc để thu hẹp kết quả.`}
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Stats summary bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        marginBottom: 12, padding: "10px 16px",
        background: "#fafafa", border: "1px solid #dfdfdf",
        borderRadius: 8, fontSize: 13,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b6b6b" }}>
          <CommentOutlined />
          <strong style={{ color: "#171717", fontFamily: "ui-monospace, monospace" }}>
            {loading ? "..." : filteredTotal.toLocaleString("vi-VN")}
          </strong>
          {" "}bình luận{hasActiveFilter ? " (đang lọc)" : " (tất cả)"}
        </span>
        {hasActiveFilter && (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: "auto", color: "#6b6b6b" }}
            onClick={handleClear}
          >
            Xóa bộ lọc
          </Button>
        )}
      </div>

      <Row gutter={[16, 16]}>
        {/* Comments table — full width */}
        <Col xs={24}>
          <div style={{
            background: "#ffffff", border: "1px solid #dfdfdf",
            borderRadius: 12, overflow: "hidden",
          }}>
            {loading ? (
              <div style={{ padding: 20 }}>
                <Skeleton active paragraph={{ rows: 8 }} />
              </div>
            ) : comments.length === 0 ? (
              <Empty
                description={hasActiveFilter ? "Không tìm thấy bình luận khớp" : "Chưa có dữ liệu bình luận"}
                style={{ padding: "60px 0" }}
              />
            ) : (
              <Table<RichComment>
                columns={columns}
                dataSource={paginatedComments}
                rowKey={(r, i) => `${r.importId}-${r.commentTime}-${i}`}
                pagination={{
                  current: page,
                  pageSize: PAGE_SIZE,
                  total: filteredTotal,
                  onChange: setPage,
                  showSizeChanger: false,
                  showTotal: (t) => `${t.toLocaleString("vi-VN")} bình luận`,
                  size: "small",
                }}
                scroll={{ x: 700 }}
                size="small"
                style={{ fontSize: 13 }}
              />
            )}
          </div>
        </Col>
      </Row>
    </AppLayout>
  );
}
