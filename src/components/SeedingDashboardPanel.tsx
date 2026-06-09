import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Row, Col, Card, Empty, theme as antdTheme } from "antd";
import type { SeedingTask } from "@/types/seeding";
import dayjs from "dayjs";

interface SeedingDashboardPanelProps {
  allTasks: SeedingTask[];
  campaignsCount: number;
  profilesCount: number;
}

type PieTooltipParam = {
  name: string;
  value: number;
  percent: number;
};

type AxisTooltipParam = Array<{
  dataIndex: number;
}>;

// Stats Card Component
function DashboardStatCard({
  label,
  value,
  subText,
  color,
}: {
  label: string;
  value: string | number;
  subText?: string;
  color?: string;
}) {
  const { token } = antdTheme.useToken();
  return (
    <Card
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderLeft: `4px solid ${color ?? token.colorBorderSecondary}`,
        borderRadius: 12,
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
      }}
      styles={{ body: { padding: "16px 20px" } }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: token.colorTextSecondary,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: token.colorText,
          lineHeight: 1.2,
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      {subText && (
        <div style={{ fontSize: 12, color: token.colorTextDescription, marginTop: 4 }}>
          {subText}
        </div>
      )}
    </Card>
  );
}

export const SeedingDashboardPanel: React.FC<SeedingDashboardPanelProps> = ({
  allTasks,
  campaignsCount,
  profilesCount,
}) => {
  const { token } = antdTheme.useToken();

  // 1. Thống kê tổng quan
  const stats = useMemo(() => {
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === "success" || t.status === "failed");
    const successTasks = allTasks.filter((t) => t.status === "success").length;
    const failedTasks = allTasks.filter((t) => t.status === "failed").length;
    const pendingTasks = allTasks.filter((t) => t.status === "pending" || t.status === "running").length;
    const scheduledTasks = allTasks.filter((t) => t.status === "scheduled").length;

    const rate = completedTasks.length > 0
      ? Math.round((successTasks / completedTasks.length) * 100)
      : 100;

    return {
      totalTasks,
      successTasks,
      failedTasks,
      pendingTasks,
      scheduledTasks,
      successRate: rate,
      completedCount: completedTasks.length,
    };
  }, [allTasks]);

  // 2. Biểu đồ 1: Timeline task thành công vs thất bại theo ngày
  const timelineOption = useMemo(() => {
    const dateMap: Record<string, { success: number; failed: number }> = {};

    allTasks.forEach((t) => {
      // Dùng finishedAt nếu có, không thì dùng createdAt
      const ts = t.finishedAt ?? t.createdAt;
      if (!ts) return;
      const dateStr = dayjs(ts.seconds * 1000).format("YYYY-MM-DD");

      if (!dateMap[dateStr]) {
        dateMap[dateStr] = { success: 0, failed: 0 };
      }

      if (t.status === "success") {
        dateMap[dateStr].success += 1;
      } else if (t.status === "failed") {
        dateMap[dateStr].failed += 1;
      }
    });

    // Lấy 10 ngày gần nhất có dữ liệu, sort tăng dần
    const sortedDates = Object.keys(dateMap).sort().slice(-10);
    const successData = sortedDates.map((d) => dateMap[d].success);
    const failedData = sortedDates.map((d) => dateMap[d].failed);

    if (sortedDates.length === 0) return null;

    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        backgroundColor: "#ffffff",
        borderColor: "#dfdfdf",
        borderWidth: 1,
        textStyle: { color: "#171717", fontSize: 13 },
      },
      legend: {
        data: ["Thành công", "Thất bại"],
        textStyle: { color: "#6b6b6b" },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        containLabel: true,
      },
      xAxis: [
        {
          type: "category" as const,
          data: sortedDates.map((d) => dayjs(d).format("DD/MM")),
          axisLabel: { color: "#6b6b6b" },
        },
      ],
      yAxis: [
        {
          type: "value" as const,
          axisLabel: { color: "#6b6b6b" },
          splitLine: { lineStyle: { type: "dashed" as const } },
        },
      ],
      series: [
        {
          name: "Thành công",
          type: "bar" as const,
          stack: "status",
          emphasis: { focus: "series" as const },
          data: successData,
          itemStyle: { color: "#3ecf8e" },
        },
        {
          name: "Thất bại",
          type: "bar" as const,
          stack: "status",
          emphasis: { focus: "series" as const },
          data: failedData,
          itemStyle: { color: "#dc2626" },
        },
      ],
    };
  }, [allTasks]);

  // 3. Biểu đồ 2: Phân bổ loại hành động (Like, Comment, Share)
  const actionOption = useMemo(() => {
    const actionCounts = { like: 0, comment: 0, share: 0 };
    allTasks.forEach((t) => {
      if (t.action === "like" || t.action === "comment" || t.action === "share") {
        actionCounts[t.action] += 1;
      }
    });

    const total = actionCounts.like + actionCounts.comment + actionCounts.share;
    if (total === 0) return null;

    const data = [
      { name: "Like 👍", value: actionCounts.like, itemStyle: { color: "#3b82f6" } },
      { name: "Comment 💬", value: actionCounts.comment, itemStyle: { color: "#3ecf8e" } },
      { name: "Share 🔗", value: actionCounts.share, itemStyle: { color: "#f59e0b" } },
    ].filter((item) => item.value > 0);

    return {
      tooltip: {
        trigger: "item" as const,
        backgroundColor: "#ffffff",
        borderColor: "#dfdfdf",
        borderWidth: 1,
        textStyle: { color: "#171717", fontSize: 13 },
        formatter: (params: PieTooltipParam) =>
          `<strong>${params.name}</strong><br/>Số lượng: <strong>${params.value}</strong> (${params.percent}%)`,
      },
      legend: {
        orient: "vertical" as const,
        right: 10,
        top: "center",
        textStyle: { color: "#6b6b6b", fontSize: 12 },
        icon: "circle",
      },
      series: [
        {
          type: "pie" as const,
          radius: ["40%", "70%"],
          center: ["40%", "50%"],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data,
        },
      ],
    };
  }, [allTasks]);

  // 4. Biểu đồ 3: Xếp hạng top profiles hoạt động năng suất và hiệu quả nhất
  const profileOption = useMemo(() => {
    const profilesMap: Record<string, { name: string; total: number; success: number }> = {};

    allTasks.forEach((t) => {
      const pId = t.profileId;
      if (!pId) return;
      if (!profilesMap[pId]) {
        profilesMap[pId] = { name: t.profileName || pId, total: 0, success: 0 };
      }
      profilesMap[pId].total += 1;
      if (t.status === "success") {
        profilesMap[pId].success += 1;
      }
    });

    const sortedProfiles = Object.entries(profilesMap)
      .map(([id, info]) => ({
        id,
        name: info.name,
        total: info.total,
        rate: info.total > 0 ? Math.round((info.success / info.total) * 100) : 100,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7); // Lấy Top 7

    if (sortedProfiles.length === 0) return null;

    // ECharts trục tung là tên, trục hoành là giá trị (bar ngang)
    // Cần đảo ngược mảng để vẽ từ trên xuống dưới
    const displayProfiles = [...sortedProfiles].reverse();

    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        backgroundColor: "#ffffff",
        borderColor: "#dfdfdf",
        borderWidth: 1,
        textStyle: { color: "#171717", fontSize: 13 },
        formatter: (params: AxisTooltipParam) => {
          const idx = params[0].dataIndex;
          const p = displayProfiles[idx];
          return `<strong>${p.name}</strong><br/>Tổng tasks: <strong>${p.total}</strong><br/>Tỷ lệ thành công: <strong>${p.rate}%</strong>`;
        },
      },
      grid: {
        left: "3%",
        right: "10%",
        bottom: "3%",
        top: "5%",
        containLabel: true,
      },
      xAxis: {
        type: "value" as const,
        boundaryGap: [0, 0.1],
        axisLabel: { color: "#6b6b6b" },
        splitLine: { lineStyle: { type: "dashed" as const } },
      },
      yAxis: {
        type: "category" as const,
        data: displayProfiles.map((p) => p.name.length > 12 ? p.name.slice(0, 10) + "..." : p.name),
        axisLabel: { color: "#6b6b6b", fontSize: 11 },
      },
      series: [
        {
          name: "Tổng tasks",
          type: "bar" as const,
          data: displayProfiles.map((p) => p.total),
          itemStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: "#93c5fd" },
                { offset: 1, color: "#3b82f6" }
              ]
            },
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    };
  }, [allTasks]);

  return (
    <div style={{ marginTop: 8 }}>
      {/* 4 Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <DashboardStatCard
            label="Chiến dịch"
            value={campaignsCount}
            subText="Tổng số chiến dịch seeding"
            color="#8b5cf6"
          />
        </Col>
        <Col xs={12} sm={6}>
          <DashboardStatCard
            label="Tài khoản Profiles"
            value={profilesCount}
            subText="Tổng profile GPM đồng bộ"
            color="#3b82f6"
          />
        </Col>
        <Col xs={12} sm={6}>
          <DashboardStatCard
            label="Tỷ lệ thành công"
            value={`${stats.successRate}%`}
            subText={`${stats.successTasks}/${stats.completedCount} tasks thành công`}
            color="#3ecf8e"
          />
        </Col>
        <Col xs={12} sm={6}>
          <DashboardStatCard
            label="Tasks đang chờ/chạy"
            value={stats.pendingTasks}
            subText="Sẵn sàng trong hàng đợi GPM"
            color="#f59e0b"
          />
        </Col>
      </Row>

      {/* Row Biểu đồ */}
      <Row gutter={[16, 16]}>
        {/* Timeline */}
        <Col xs={24} lg={16}>
          <Card
            title={<span style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>XU HƯỚNG SEEDING THEO NGÀY</span>}
            style={{
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            {timelineOption ? (
              <ReactECharts option={timelineOption} style={{ height: 280 }} />
            ) : (
              <Empty description="Chưa có dữ liệu thống kê theo ngày" style={{ padding: "50px 0" }} />
            )}
          </Card>
        </Col>

        {/* Action Type */}
        <Col xs={24} lg={8}>
          <Card
            title={<span style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>PHÂN BỔ LOẠI HÀNH ĐỘNG</span>}
            style={{
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            {actionOption ? (
              <ReactECharts option={actionOption} style={{ height: 280 }} />
            ) : (
              <Empty description="Chưa có dữ liệu hành động" style={{ padding: "50px 0" }} />
            )}
          </Card>
        </Col>

        {/* Top Profiles */}
        <Col xs={24}>
          <Card
            title={<span style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>TOP PROFILES HOẠT ĐỘNG TÍCH CỰC NHẤT</span>}
            style={{
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            {profileOption ? (
              <ReactECharts option={profileOption} style={{ height: 260 }} />
            ) : (
              <Empty description="Chưa có dữ liệu hoạt động của các profiles" style={{ padding: "40px 0" }} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
