/**
 * SeedingDashboard - Thống kê & Analytics
 */

import React from "react";
import { Row, Col, Card, Statistic, Progress, Typography, Space, Tag, List, Avatar, Badge } from "antd";
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  MessageOutlined,
  SendOutlined,
  RiseOutlined,
  CalendarOutlined,
  BarChartOutlined,
  PieChartOutlined,
} from "@ant-design/icons";
import type { SeedingPost, SeedingGroup, WeeklyStat, CategoryStats } from "@/types/seeding";

const { Title, Text } = Typography;

interface SeedingDashboardProps {
  stats: {
    totalPosts: number;
    totalComments: number;
    readyPosts: number;
    usedPosts: number;
    archivedPosts: number;
    activeGroups: number;
    usedComments: number;
    totalRedirects: number;
  };
  weeklyStats: WeeklyStat[];
  categoryStats: CategoryStats[];
  recentPosts: SeedingPost[];
  topGroups: SeedingGroup[];
}

const SeedingDashboard: React.FC<SeedingDashboardProps> = ({
  stats,
  weeklyStats,
  categoryStats,
  recentPosts,
  topGroups,
}) => {
  // Tính % sử dụng
  const usageRate = stats.totalPosts > 0 
    ? Math.round((stats.usedPosts / stats.totalPosts) * 100) 
    : 0;
  
  const commentUsageRate = stats.totalComments > 0 
    ? Math.round((stats.usedComments / stats.totalComments) * 100) 
    : 0;

  return (
    <div className="seeding-dashboard">
      {/* Header Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={6} lg={3}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic 
              title={<Text type="secondary">Tổng bài</Text>}
              value={stats.totalPosts}
              prefix={<FileTextOutlined style={{ color: "#1890ff" }} />}
              valueStyle={{ color: "#1890ff", fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic 
              title={<Text type="secondary">Sẵn sàng</Text>}
              value={stats.readyPosts}
              prefix={<ClockCircleOutlined style={{ color: "#faad14" }} />}
              valueStyle={{ color: "#faad14", fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic 
              title={<Text type="secondary">Đã dùng</Text>}
              value={stats.usedPosts}
              prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
              valueStyle={{ color: "#52c41a", fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic 
              title={<Text type="secondary">Comments</Text>}
              value={stats.totalComments}
              prefix={<MessageOutlined style={{ color: "#722ed1" }} />}
              valueStyle={{ color: "#722ed1", fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic 
              title={<Text type="secondary">Redirects</Text>}
              value={stats.totalRedirects}
              prefix={<SendOutlined style={{ color: "#eb2f96" }} />}
              valueStyle={{ color: "#eb2f96", fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic 
              title={<Text type="secondary">Nhóm</Text>}
              value={stats.activeGroups}
              prefix={<TeamOutlined style={{ color: "#13c2c2" }} />}
              valueStyle={{ color: "#13c2c2", fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic 
              title={<Text type="secondary">Đã copy</Text>}
              value={stats.usedComments}
              prefix={<CheckCircleOutlined style={{ color: "#fa8c16" }} />}
              valueStyle={{ color: "#fa8c16", fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic 
              title={<Text type="secondary">Usage Rate</Text>}
              value={usageRate}
              suffix="%"
              prefix={<RiseOutlined style={{ color: "#f5222d" }} />}
              valueStyle={{ color: "#f5222d", fontSize: 28 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Weekly Chart */}
        <Col xs={24} lg={14}>
          <Card 
            title={
              <Space>
                <BarChartOutlined />
                <span>7 Ngày Gần Nhất</span>
              </Space>
            }
            size="small"
          >
            <div style={{ height: 200, display: "flex", alignItems: "flex-end", justifyContent: "space-around" }}>
              {weeklyStats.map((day, idx) => {
                const maxPosts = Math.max(...weeklyStats.map(s => s.posts), 1);
                const height = (day.posts / maxPosts) * 160;
                const date = new Date(day.date);
                const dayName = date.toLocaleDateString("vi-VN", { weekday: "short" });
                
                return (
                  <div key={day.date} style={{ textAlign: "center", flex: 1 }}>
                    <div style={{ marginBottom: 8, fontSize: 12, color: "#999" }}>
                      {day.posts} bài
                    </div>
                    <div 
                      style={{ 
                        width: 40, 
                        height: Math.max(height, 4), 
                        background: idx === weeklyStats.length - 1 ? "#1890ff" : "#52c41a",
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.3s",
                      }} 
                    />
                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: idx === weeklyStats.length - 1 ? 600 : 400 }}>
                      {dayName}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>

        {/* Category Distribution */}
        <Col xs={24} lg={10}>
          <Card 
            title={
              <Space>
                <PieChartOutlined />
                <span>Phân Bố Category</span>
              </Space>
            }
            size="small"
          >
            <div style={{ maxHeight: 220, overflow: "auto" }}>
              {categoryStats.slice(0, 8).map((cat, idx) => (
                <div key={cat.category} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <Tag color={getCategoryColor(idx)}>{cat.category}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {cat.count} bài ({cat.percentage}%)
                    </Text>
                  </div>
                  <Progress 
                    percent={cat.percentage} 
                    showInfo={false}
                    strokeColor={getCategoryColor(idx)}
                    size="small"
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Recent Posts */}
        <Col xs={24} lg={14}>
          <Card 
            title={
              <Space>
                <CalendarOutlined />
                <span>Bài Gần Đây</span>
              </Space>
            }
            size="small"
          >
            <List
              size="small"
              dataSource={recentPosts.slice(0, 5)}
              style={{ maxHeight: 300, overflow: "auto" }}
              renderItem={(post) => (
                <List.Item style={{ padding: "8px 0" }}>
                  <List.Item.Meta
                    avatar={
                      <Badge 
                        status={post.status === "ready" ? "processing" : post.status === "used" ? "success" : "default"}
                      />
                    }
                    title={
                      <Text ellipsis style={{ maxWidth: 400 }}>
                        {post.content.substring(0, 60)}...
                      </Text>
                    }
                    description={
                      <Space size="small">
                        <Tag style={{ marginRight: 0 }}>{post.category}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {new Date(post.createdAt).toLocaleDateString("vi-VN")}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          • {post.comments.length} comments
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: "Chưa có bài nào" }}
            />
          </Card>
        </Col>

        {/* Top Groups */}
        <Col xs={24} lg={10}>
          <Card 
            title={
              <Space>
                <TeamOutlined />
                <span>Nhóm Hoạt Động</span>
              </Space>
            }
            size="small"
          >
            <List
              size="small"
              dataSource={topGroups.slice(0, 5)}
              style={{ maxHeight: 300, overflow: "auto" }}
              renderItem={(group) => (
                <List.Item style={{ padding: "8px 0" }}>
                  <List.Item.Meta
                    avatar={
                      <Avatar 
                        icon={<TeamOutlined />} 
                        style={{ 
                          background: getGroupColor(group.category),
                        }} 
                      />
                    }
                    title={
                      <a href={group.url} target="_blank" rel="noopener noreferrer">
                        {group.name}
                      </a>
                    }
                    description={
                      <Space size="small">
                        <Tag style={{ marginRight: 0 }}>{getGroupCategoryLabel(group.category)}</Tag>
                        {group.memberCount && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {group.memberCount.toLocaleString()} thành viên
                          </Text>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: "Chưa có nhóm nào" }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Helper functions
function getCategoryColor(idx: number): string {
  const colors = ["blue", "green", "cyan", "purple", "orange", "magenta", "red", "gold"];
  return colors[idx % colors.length];
}

function getGroupColor(category: string): string {
  const colors: Record<string, string> = {
    review: "#3ecf8e",
    online: "#1677ff",
    hsk: "#722ed1",
    tailieu: "#fa8c16",
    all: "#666",
  };
  return colors[category] || "#666";
}

function getGroupCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    review: "Review",
    online: "Online",
    hsk: "HSK",
    tailieu: "Tài liệu",
    all: "Tất cả",
  };
  return labels[category] || category;
}

export default SeedingDashboard;
