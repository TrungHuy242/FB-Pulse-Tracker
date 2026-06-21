/**
 * SeedingPage - AI Agent Dashboard cho Seeding Content tiếng Trung
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  Input,
  Select,
  Table,
  Tag,
  Modal,
  Form,
  Space,
  Typography,
  message,
  Empty,
  Tooltip,
  Row,
  Col,
  List,
  Avatar,
  Alert,
  Tabs,
  Divider,
  Badge,
  Descriptions,
  DatePicker,
  Spin,
} from "antd";
import {
  PlusOutlined,
  CopyOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  ExclamationCircleOutlined,
  RocketOutlined,
  MessageOutlined,
  TeamOutlined,
  EyeOutlined,
  SendOutlined,
  LinkOutlined,
  WarningOutlined,
  DashboardOutlined,
  TableOutlined,
  CalendarOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  AimOutlined,
} from "@ant-design/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { seedingService } from "@/service/seedingService";
import SeedingDashboard from "@/components/SeedingDashboard";
import type {
  SeedingPost,
  SeedingGroup,
  SeedingCategory,
  GroupCategory,
  GeneratePostInput,
  RedirectEngineResult,
  CategoryStats,
  WeeklyStat,
} from "@/types/seeding";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

const { Text } = Typography;
const { TextArea } = Input;

const CATEGORIES: SeedingCategory[] = [
  "tìm khóa học", "tìm trung tâm", "tìm lớp", "tìm gia sư",
  "học online", "hỏi tài liệu", "hỏi app/web", "hỏi HSK",
  "hỏi kinh nghiệm học", "tự học",
];

const CATEGORY_COLORS: Record<SeedingCategory, string> = {
  "tìm khóa học": "blue",
  "tìm trung tâm": "green",
  "tìm lớp": "cyan",
  "tìm gia sư": "purple",
  "học online": "cyan",
  "hỏi tài liệu": "orange",
  "hỏi app/web": "magenta",
  "hỏi HSK": "red",
  "hỏi kinh nghiệm học": "gold",
  "tự học": "volcano",
};

const GROUP_CATEGORIES: GroupCategory[] = ["review", "online", "hsk", "tailieu", "all"];

const GROUP_CATEGORY_LABELS: Record<GroupCategory, string> = {
  review: "Review (khóa học, trung tâm)",
  online: "Online (1:1, lịch học)",
  hsk: "HSK (thi, lộ trình)",
  tailieu: "Tài liệu (app, sách)",
  all: "Tất cả",
};

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const copy = () => {
    navigator.clipboard.writeText(text);
    message.success("Đã copy!");
  };
  return (
    <Tooltip title="Copy">
      <Button type="text" size="small" icon={<CopyOutlined />} onClick={copy} />
    </Tooltip>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    draft: "default", ready: "processing", used: "success", archived: "error",
  };
  const labels: Record<string, string> = {
    draft: "Nháp", ready: "Sẵn sàng", used: "Đã dùng", archived: "Đã xóa",
  };
  return <Tag color={colors[status]}>{labels[status]}</Tag>;
};

export default function SeedingPage() {
  const [posts, setPosts] = useState<SeedingPost[]>([]);
  const [groups, setGroups] = useState<SeedingGroup[]>([]);
  const [selectedPost, setSelectedPost] = useState<SeedingPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  
  const [overallStats, setOverallStats] = useState({
    totalPosts: 0, totalComments: 0, readyPosts: 0, usedPosts: 0,
    archivedPosts: 0, activeGroups: 0, usedComments: 0, totalRedirects: 0,
  });
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [redirectModalOpen, setRedirectModalOpen] = useState(false);
  const [redirectContent, setRedirectContent] = useState("");
  const [redirectResult, setRedirectResult] = useState<RedirectEngineResult | null>(null);
  const [redirectLoading, setRedirectLoading] = useState(false);
  
  const [campaignResult, setCampaignResult] = useState<{
    seedResult: any;
    baitResult: any;
    redirectResult: RedirectEngineResult;
  } | null>(null);
  
  const [form] = Form.useForm();
  const [groupForm] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    setDataError(null);
    
    try {
      console.log("Loading data from Firebase...");
      
      const [allPosts, allGroups, stats, weekly, catStats] = await Promise.all([
        seedingService.getAllPosts(),
        seedingService.getGroups(),
        seedingService.getOverallStats(),
        seedingService.getWeeklyStats(),
        seedingService.getStatsByCategory(),
      ]);
      
      console.log("Posts loaded:", allPosts.length);
      console.log("Groups loaded:", allGroups.length);
      
      setPosts(allPosts);
      setGroups(allGroups);
      setOverallStats(stats);
      setWeeklyStats(weekly);
      
      const catStatsArray: CategoryStats[] = [];
      let total = 0;
      for (const [category, data] of Object.entries(catStats)) {
        total += data.count;
        catStatsArray.push({
          category: category as SeedingCategory,
          count: data.count,
          comments: data.comments,
          percentage: 0,
        });
      }
      catStatsArray.forEach(s => {
        s.percentage = total > 0 ? Math.round((s.count / total) * 100) : 0;
      });
      catStatsArray.sort((a, b) => b.count - a.count);
      setCategoryStats(catStatsArray);
      
      // Init sample groups if empty
      if (allGroups.length === 0) {
        console.log("No groups found, initializing sample data...");
        await seedingService.initSampleData();
        // Reload after init
        const newGroups = await seedingService.getGroups();
        setGroups(newGroups);
      }
    } catch (err: any) {
      console.error("Load data error:", err);
      setDataError(err.message || "Lỗi kết nối Firebase");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateCampaign = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const input: GeneratePostInput = {
        sourceContent: values.sourceContent || "",
        topic: values.topic || "",
        groupType: values.category || "hỏi kinh nghiệm học",
        commentCount: values.commentCount || 5,
      };
      
      console.log("Creating campaign:", input);
      const result = await seedingService.createCampaign(input);
      console.log("Campaign created:", result);
      
      setCampaignResult({
        seedResult: result.seedResult,
        baitResult: result.baitResult,
        redirectResult: result.redirectResult,
      });
      
      setSelectedPost(result.post);
      await loadData();
      setCreateModalOpen(false);
      setResultModalOpen(true);
      form.resetFields();
      
      message.success("Đã tạo campaign hoàn chỉnh!");
    } catch (err: any) {
      console.error("Create campaign error:", err);
      message.error("Lỗi: " + (err.message || "Không thể tạo campaign"));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDaily = async () => {
    setLoading(true);
    
    try {
      console.log("Generating daily campaigns...");
      const results = await seedingService.generateDailyCampaigns();
      console.log("Daily campaigns created:", results.length);
      
      await loadData();
      
      if (results.length > 0) {
        setSelectedPost(results[0]);
        
        const firstPost = results[0];
        const redirectResult = await seedingService.generateRedirect(firstPost.content, firstPost.category);
        
        setCampaignResult({
          seedResult: {
            title: firstPost.title,
            content: firstPost.content,
            category: firstPost.category,
          },
          baitResult: {
            comments: firstPost.comments.filter((c: any) => c.type === "bait").map((c: any) => c.content),
          },
          redirectResult,
        });
        
        setResultModalOpen(true);
      }
      
      message.success(`Đã tạo ${results.length} bài cho hôm nay!`);
    } catch (err: any) {
      console.error("Generate daily error:", err);
      message.error("Lỗi: " + (err.message || "Không thể tạo campaign"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async () => {
    try {
      const values = await groupForm.validateFields();
      console.log("Adding group:", values);
      
      await seedingService.addGroup({
        name: values.name,
        url: values.url,
        category: values.category || "all",
        status: values.status || "active",
        memberCount: values.memberCount,
      });
      
      await loadData();
      groupForm.resetFields();
      message.success("Đã thêm nhóm!");
    } catch (err: any) {
      console.error("Add group error:", err);
      message.error("Lỗi: " + (err.message || "Không thể thêm nhóm"));
    }
  };

  const handleDeletePost = (id: string) => {
    Modal.confirm({
      title: "Xóa bài này?",
      icon: <ExclamationCircleOutlined />,
      content: "Hành động này không thể hoàn tác.",
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        await seedingService.deletePost(id);
        await loadData();
        message.success("Đã xóa bài!");
      },
    });
  };

  const handleViewPost = async (post: SeedingPost) => {
    setSelectedPost(post);
    
    const redirectResult = await seedingService.generateRedirect(post.content, post.category);
    setCampaignResult({
      seedResult: {
        title: post.title,
        content: post.content,
        category: post.category,
      },
      baitResult: {
        comments: post.comments.filter(c => c.type === "bait").map(c => c.content),
      },
      redirectResult,
    });
    
    setResultModalOpen(true);
  };

  const handleGenerateRedirect = async () => {
    if (!redirectContent.trim()) {
      message.warning("Vui lòng nhập nội dung cần phân tích");
      return;
    }
    
    setRedirectLoading(true);
    
    try {
      const result = await seedingService.generateRedirectFromContent(redirectContent);
      setRedirectResult(result);
      
      if (result.success) {
        message.success("Đã tạo redirect thành công!");
      } else {
        message.warning(result.errorMessage || "Không thể tạo redirect");
      }
    } catch (err: any) {
      console.error("Generate redirect error:", err);
      message.error("Lỗi: " + (err.message || "Không thể tạo redirect"));
    } finally {
      setRedirectLoading(false);
    }
  };

  const getFilteredPosts = () => {
    let filtered = posts.filter(p => p.status !== "archived");
    
    if (dateRange) {
      const [start, end] = dateRange;
      filtered = filtered.filter(p => {
        const postDate = dayjs(p.createdAt);
        return postDate.isAfter(start) && postDate.isBefore(end.add(1, "day"));
      });
    }
    
    return filtered;
  };

  const postColumns: ColumnsType<SeedingPost> = [
    {
      title: "Bài viết",
      dataIndex: "content",
      key: "content",
      width: 350,
      render: (text: string, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{text.substring(0, 80)}...</Text>
          <Space style={{ marginTop: 4 }}>
            <Tag color={CATEGORY_COLORS[record.category]}>{record.category}</Tag>
            {record.comments?.length > 0 && (
              <Tag icon={<MessageOutlined />} color="processing">
                {record.comments.length} comments
              </Tag>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 100,
      render: (date: Date) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Hành động",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewPost(record)} />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeletePost(record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Loading state
  if (loading && posts.length === 0) {
    return (
      <AppLayout title="Seeding Manager">
        <div style={{ padding: 100, textAlign: "center" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Đang tải dữ liệu từ Firebase...</Text>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (dataError) {
    return (
      <AppLayout title="Seeding Manager">
        <div style={{ padding: 24 }}>
          <Alert
            type="error"
            showIcon
            icon={<WarningOutlined />}
            message="Lỗi kết nối Firebase"
            description={
              <div>
                <p>{dataError}</p>
                <p style={{ fontSize: 12, color: "#999" }}>
                  Kiểm tra: Firebase config trong .env, Firestore rules, và kết nối internet
                </p>
              </div>
            }
            action={
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                Thử lại
              </Button>
            }
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Seeding Manager">
      <div style={{ padding: 24 }}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          style={{ marginBottom: 24 }}
          items={[
            {
              key: "dashboard",
              label: <span><DashboardOutlined /> Dashboard</span>,
              children: (
                <>
                  <div style={{ marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerateDaily} loading={loading}>
                      Tạo 4 bài hôm nay
                    </Button>
                    <Button icon={<RocketOutlined />} onClick={() => setCreateModalOpen(true)}>
                      Tạo Campaign mới
                    </Button>
                    <Button icon={<TeamOutlined />} onClick={() => setGroupModalOpen(true)}>
                      Quản lý nhóm ({overallStats.activeGroups})
                    </Button>
                    <Button icon={<CalendarOutlined />} onClick={() => setHistoryModalOpen(true)}>
                      Lịch sử
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                      Tải lại
                    </Button>
                    <div style={{ flex: 1 }} />
                    <DatePicker.RangePicker 
                      onChange={(dates) => setDateRange(dates as any)}
                      placeholder={["Từ ngày", "Đến ngày"]}
                    />
                  </div>

                  <SeedingDashboard
                    stats={overallStats}
                    weeklyStats={weeklyStats}
                    categoryStats={categoryStats}
                    recentPosts={getFilteredPosts()}
                    topGroups={groups.filter(g => g.status === "active").slice(0, 5)}
                  />
                </>
              ),
            },
            {
              key: "posts",
              label: <span><TableOutlined /> Danh sách Bài</span>,
              children: (
                <>
                  <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <DatePicker.RangePicker 
                      onChange={(dates) => setDateRange(dates as any)}
                      placeholder={["Từ ngày", "Đến ngày"]}
                    />
                    {dateRange && (
                      <Button onClick={() => setDateRange(null)}>Xóa lọc</Button>
                    )}
                    <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                      Tải lại
                    </Button>
                    <Text type="secondary">
                      {getFilteredPosts().length} bài {dateRange ? "(đã lọc)" : ""}
                    </Text>
                  </div>

                  <Card>
                    {getFilteredPosts().length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có campaign nào" />
                    ) : (
                      <Table
                        dataSource={getFilteredPosts()}
                        columns={postColumns}
                        rowKey="id"
                        size="small"
                        pagination={{ pageSize: 15 }}
                      />
                    )}
                  </Card>
                </>
              ),
            },
            {
              key: "redirect",
              label: <span><AimOutlined /> Redirect Tool</span>,
              children: (
                <>
                  <Card style={{ marginBottom: 24 }}>
                    <Alert
                      type="info"
                      showIcon
                      icon={<AimOutlined />}
                      message="Công cụ tạo comment kéo member từ nội dung bất kỳ"
                      description="Dán nội dung bài viết, comment, hoặc tin nhắn bất kỳ - AI sẽ phân tích và đề xuất group phù hợp"
                      style={{ marginBottom: 16 }}
                    />
                    
                    <Form layout="vertical">
                      <Form.Item 
                        label="Nội dung cần phân tích" 
                        required
                        tooltip="Dán bài viết, comment, hoặc nội dung bất kỳ cần tạo redirect"
                      >
                        <TextArea 
                          rows={4}
                          placeholder={`Dán nội dung bài viết, comment, hoặc tin nhắn cần tạo redirect...\n\nVí dụ:\n"Mn ơi cho em hỏi học tiếng Trung ở trung tâm nào tốt vậy? Em muốn tìm lớp gần quận 1"`}
                          value={redirectContent}
                          onChange={(e) => setRedirectContent(e.target.value)}
                        />
                      </Form.Item>
                      
                      <Form.Item label=" " colon={false}>
                        <Space>
                          <Button 
                            type="primary" 
                            icon={<AimOutlined />}
                            onClick={handleGenerateRedirect}
                            loading={redirectLoading}
                            disabled={!redirectContent.trim()}
                          >
                            Phân tích & Tạo Redirect
                          </Button>
                          {redirectContent && (
                            <Button onClick={() => {
                              setRedirectContent("");
                              setRedirectResult(null);
                            }}>
                              Xóa
                            </Button>
                          )}
                        </Space>
                      </Form.Item>
                    </Form>
                  </Card>
                  
                  {/* Redirect Result */}
                  {redirectResult && (
                    <Card 
                      title={
                        <Space>
                          <CheckCircleOutlined style={{ color: "#52c41a" }} />
                          <span>Kết quả phân tích</span>
                        </Space>
                      }
                      style={{ background: "#fafff0", border: "1px solid #b7eb8f" }}
                    >
                      <Row gutter={[16, 16]}>
                        <Col span={24}>
                          <Card size="small" title="📝 Nội dung đã phân tích" style={{ background: "#f5f5f5" }}>
                            <Text style={{ fontStyle: "italic", color: "#666" }}>
                              {redirectContent}
                            </Text>
                          </Card>
                        </Col>
                        
                        <Col xs={24} md={12}>
                          <Card size="small" title="🔍 Phân tích">
                            <Descriptions column={1} size="small">
                              <Descriptions.Item label="Category detected">
                                <Tag color={CATEGORY_COLORS[redirectResult.detectedCategory as SeedingCategory]}>
                                  {redirectResult.detectedCategory}
                                </Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="Group phù hợp">
                                {redirectResult.targetGroup ? (
                                  <Tag icon={<TeamOutlined />} color="blue">
                                    {redirectResult.targetGroup.name}
                                  </Tag>
                                ) : (
                                  <Tag icon={<WarningOutlined />} color="error">Chưa có group</Tag>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label="Group Category">
                                <Tag>{redirectResult.mappedGroupCategory}</Tag>
                              </Descriptions.Item>
                            </Descriptions>
                          </Card>
                        </Col>
                        
                        <Col xs={24} md={12}>
                          <Card size="small" title="🔗 Link nhóm">
                            {redirectResult.targetGroup ? (
                              <>
                                <Text strong style={{ display: "block", marginBottom: 8 }}>
                                  {redirectResult.targetGroup.name}
                                </Text>
                                <Space direction="vertical">
                                  <Text copyable={{ text: redirectResult.targetGroup.url }} />
                                  <Button 
                                    icon={<LinkOutlined />} 
                                    href={redirectResult.targetGroup.url}
                                    target="_blank"
                                    size="small"
                                  >
                                    Mở nhóm
                                  </Button>
                                </Space>
                              </>
                            ) : (
                              <Alert 
                                type="warning" 
                                message="Cần thêm nhóm trong phần Quản lý nhóm" 
                                showIcon 
                              />
                            )}
                          </Card>
                        </Col>
                        
                        <Col span={24}>
                          <Card 
                            size="small" 
                            title="💬 Comment Kéo Member" 
                            style={{ background: "#fffef0", border: "1px solid #ffe58f" }}
                          >
                            {redirectResult.success ? (
                              <>
                                <Text style={{ whiteSpace: "pre-wrap", display: "block", lineHeight: 1.6 }}>
                                  {redirectResult.redirectComment}
                                </Text>
                                <Divider style={{ margin: "12px 0" }} />
                                <CopyButton text={redirectResult.redirectComment} />
                              </>
                            ) : (
                              <Alert 
                                type="warning" 
                                message={redirectResult.errorMessage || "Không thể tạo redirect"}
                                showIcon 
                              />
                            )}
                          </Card>
                        </Col>
                      </Row>
                    </Card>
                  )}
                  
                  {/* Available Groups */}
                  <Card title="📋 Danh sách nhóm hiện có" style={{ marginTop: 24 }}>
                    <List
                      dataSource={groups.filter(g => g.status === "active")}
                      renderItem={(group) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={
                              <Avatar icon={<TeamOutlined />} 
                                style={{ 
                                  background: group.category === "review" ? "#3ecf8e" : 
                                             group.category === "online" ? "#1677ff" :
                                             group.category === "hsk" ? "#722ed1" :
                                             group.category === "tailieu" ? "#fa8c16" : "#666" 
                                }} 
                              />
                            }
                            title={group.name}
                            description={
                              <Space>
                                <Tag>{GROUP_CATEGORY_LABELS[group.category]}</Tag>
                                {group.memberCount && <Text type="secondary">{group.memberCount.toLocaleString()} thành viên</Text>}
                              </Space>
                            }
                          />
                          <Button 
                            size="small" 
                            icon={<LinkOutlined />}
                            href={group.url}
                            target="_blank"
                          >
                            Mở
                          </Button>
                        </List.Item>
                      )}
                      locale={{ emptyText: "Chưa có nhóm nào - Thêm nhóm để sử dụng Redirect" }}
                    />
                  </Card>
                </>
              ),
            },
          ]}
        />
      </div>

      {/* Create Campaign Modal */}
      <Modal
        title={<Space><RocketOutlined /><span>Tạo Campaign mới</span></Space>}
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        footer={
          <Space>
            <Button onClick={() => setCreateModalOpen(false)}>Hủy</Button>
            <Button type="primary" onClick={handleCreateCampaign} loading={loading}>Tạo Campaign</Button>
          </Space>
        }
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Alert
            type="info"
            showIcon={false}
            message="Tạo campaign hoàn chỉnh: bài viết + 5 comment mồi + comment kéo member"
            style={{ marginBottom: 16 }}
          />
          
          <Form.Item label="Chủ đề" name="topic" rules={[{ required: true, message: "Nhập chủ đề" }]}>
            <Input placeholder="VD: Tìm lớp tiếng Trung online" />
          </Form.Item>
          
          <Form.Item label="Nội dung bài đăng (tùy chọn)" name="sourceContent">
            <TextArea rows={2} placeholder="Dán nội dung bài viết gốc..." />
          </Form.Item>
          
          <Form.Item label="Loại bài" name="category" initialValue="hỏi kinh nghiệm học">
            <Select options={CATEGORIES.map(c => ({ value: c, label: c }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Groups Modal */}
      <Modal
        title={<Space><TeamOutlined /><span>Quản lý nhóm</span></Space>}
        open={groupModalOpen}
        onCancel={() => { setGroupModalOpen(false); groupForm.resetFields(); }}
        footer={null}
        width={700}
      >
        <Alert
          type="info"
          showIcon={false}
          message="Thêm nhóm để AI có thể tạo comment kéo member"
          style={{ marginBottom: 16 }}
        />

        <Form form={groupForm} layout="vertical">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="name" label="Tên nhóm" rules={[{ required: true }]}>
                <Input placeholder="VD: Review tiếng Trung" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="url" label="URL nhóm" rules={[{ required: true }]}>
                <Input placeholder="https://facebook.com/groups/xxx" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="category" label="Loại" initialValue="all">
                <Select options={GROUP_CATEGORIES.map(c => ({ value: c, label: GROUP_CATEGORY_LABELS[c] }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="memberCount" label="Số thành viên">
                <Input type="number" placeholder="VD: 10000" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="Trạng thái" initialValue="active">
                <Select options={[
                  { value: "active", label: "Hoạt động" },
                  { value: "inactive", label: "Không hoạt động" },
                ]} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label=" " colon={false}>
                <Button type="primary" onClick={handleAddGroup} icon={<PlusOutlined />} loading={loading}>
                  Thêm nhóm
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
        
        <Divider orientation="left">Danh sách nhóm ({groups.length})</Divider>
        <List
          dataSource={groups}
          style={{ maxHeight: 300, overflow: "auto" }}
          renderItem={(group) => (
            <List.Item
              actions={[
                <Tag color={group.status === "active" ? "success" : "default"}>
                  {group.status === "active" ? "Hoạt động" : "Tắt"}
                </Tag>,
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={async () => {
                  await seedingService.deleteGroup(group.id);
                  await loadData();
                }} />,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar icon={<TeamOutlined />} 
                    style={{ background: group.category === "review" ? "#3ecf8e" : 
                               group.category === "online" ? "#1677ff" :
                               group.category === "hsk" ? "#722ed1" :
                               group.category === "tailieu" ? "#fa8c16" : "#666" }} />
                }
                title={<a href={group.url} target="_blank" rel="noopener noreferrer">{group.name}</a>}
                description={
                  <Space>
                    <Tag>{GROUP_CATEGORY_LABELS[group.category]}</Tag>
                    {group.memberCount && <Text type="secondary">{group.memberCount.toLocaleString()} thành viên</Text>}
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: "Chưa có nhóm nào - Thêm nhóm ở trên" }}
        />
      </Modal>

      {/* History Modal */}
      <Modal
        title={<Space><CalendarOutlined /><span>Lịch sử theo ngày</span></Space>}
        open={historyModalOpen}
        onCancel={() => setHistoryModalOpen(false)}
        footer={null}
        width={800}
      >
        <List
          dataSource={(() => {
            const grouped: { date: string; posts: SeedingPost[] }[] = [];
            const dateMap = new Map<string, SeedingPost[]>();
            
            posts.forEach(post => {
              const dateStr = dayjs(post.createdAt).format("YYYY-MM-DD");
              if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
              dateMap.get(dateStr)!.push(post);
            });
            
            Array.from(dateMap.entries())
              .sort((a, b) => b[0].localeCompare(a[0]))
              .forEach(([date, datePosts]) => {
                grouped.push({ date, posts: datePosts });
              });
            
            return grouped;
          })()}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Badge count={item.posts.length} style={{ backgroundColor: "#1890ff" }}>
                    <Avatar icon={<CalendarOutlined />} style={{ background: "#1890ff" }} />
                  </Badge>
                }
                title={
                  <Space>
                    <Text strong>{dayjs(item.date).format("DD/MM/YYYY")}</Text>
                    <Tag>{item.posts.length} bài</Tag>
                    <Text type="secondary">
                      ({item.posts.filter(p => p.status === "ready").length} sẵn sàng, {item.posts.filter(p => p.status === "used").length} đã dùng)
                    </Text>
                  </Space>
                }
                description={
                  <div style={{ marginTop: 8 }}>
                    {item.posts.slice(0, 3).map(post => (
                      <Tag key={post.id} style={{ marginBottom: 4 }}>
                        {post.content.substring(0, 40)}...
                      </Tag>
                    ))}
                    {item.posts.length > 3 && <Text type="secondary">+{item.posts.length - 3} bài khác</Text>}
                  </div>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: "Chưa có lịch sử" }}
        />
      </Modal>

      {/* Campaign Result Modal - 3 Tabs */}
      <Modal
        title={<Space><RocketOutlined /><span>Chi tiết Campaign</span></Space>}
        open={resultModalOpen}
        onCancel={() => { setResultModalOpen(false); setSelectedPost(null); setCampaignResult(null); }}
        footer={null}
        width={700}
      >
        {campaignResult && (
          <Tabs
            defaultActiveKey="post"
            items={[
              {
                key: "post",
                label: <span><RocketOutlined /> Bài viết</span>,
                children: (
                  <Card size="small" style={{ background: "#f6ffed", border: "1px solid #b7eb8f" }}>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Category">
                        <Tag color={CATEGORY_COLORS[campaignResult.seedResult.category]}>
                          {campaignResult.seedResult.category}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                    <Text strong style={{ fontSize: 16, display: "block", marginTop: 12 }}>
                      {campaignResult.seedResult.content}
                    </Text>
                    <Divider style={{ margin: "12px 0" }} />
                    <Space>
                      <CopyButton text={campaignResult.seedResult.content} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ID: {selectedPost?.id.substring(0, 8)}...
                      </Text>
                    </Space>
                  </Card>
                ),
              },
              {
                key: "bait",
                label: <span><MessageOutlined /> Comment Mồi <Badge count={5} style={{ marginLeft: 8 }} /></span>,
                children: (
                  <List
                    dataSource={campaignResult.baitResult.comments}
                    renderItem={(comment: string, index: number) => (
                      <List.Item style={{ padding: "8px 0" }}>
                        <div style={{ width: "100%" }}>
                          <Space>
                            <Tag color="green">#{index + 1}</Tag>
                            {selectedPost?.comments[index]?.used && <Tag color="blue">Đã dùng</Tag>}
                          </Space>
                          <Text style={{ display: "block", margin: "4px 0", fontSize: 14 }}>{comment}</Text>
                          <CopyButton text={comment} />
                        </div>
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: "redirect",
                label: (
                  <span>
                    <SendOutlined /> Kéo Member
                    {!campaignResult.redirectResult.success && <WarningOutlined style={{ color: "#ff4d4f", marginLeft: 8 }} />}
                  </span>
                ),
                children: (
                  <div>
                    <Alert
                      type="info"
                      showIcon
                      message="AI sẽ phân tích bài viết bên cạnh để đề xuất group phù hợp và tạo comment kéo member"
                      style={{ marginBottom: 16 }}
                    />
                    
                    {/* Bài viết để AI phân tích */}
                    <Card size="small" title="📝 Bài viết cần phân tích" style={{ marginBottom: 16, background: "#f0f5ff", border: "1px solid #adc6ff" }}>
                      <Text style={{ fontSize: 13, lineHeight: 1.6 }}>
                        {campaignResult.seedResult.content}
                      </Text>
                    </Card>
                    
                    {/* AI Analysis Result */}
                    <Card size="small" style={{ marginBottom: 16, background: "#fafafa" }}>
                      <Descriptions column={1} size="small" title="🔍 Phân tích của AI">
                        <Descriptions.Item label="Category">
                          <Tag color={CATEGORY_COLORS[campaignResult.seedResult.category]}>
                            {campaignResult.seedResult.category}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Nên đưa vào">
                          {campaignResult.redirectResult.targetGroup ? (
                            <Tag icon={<TeamOutlined />} color="blue">
                              {campaignResult.redirectResult.targetGroup.name}
                            </Tag>
                          ) : (
                            <Tag icon={<WarningOutlined />} color="error">Chưa có group phù hợp</Tag>
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Group Category">
                          <Tag>{campaignResult.redirectResult.mappedGroupCategory}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}> (tự động map từ bài viết)</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="Group URL">
                          {campaignResult.redirectResult.targetGroup ? (
                            <Space>
                              <Text copyable={{ text: campaignResult.redirectResult.targetGroup.url }} />
                              <a href={campaignResult.redirectResult.targetGroup.url} target="_blank" rel="noopener noreferrer"><LinkOutlined /></a>
                            </Space>
                          ) : <Text type="secondary">-</Text>}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                    
                    {/* Redirect Comment */}
                    {campaignResult.redirectResult.success ? (
                      <Card size="small" title="💬 Comment Kéo Member" style={{ background: "#fffef0", border: "1px solid #ffe58f" }}>
                        <Text style={{ whiteSpace: "pre-wrap", display: "block", lineHeight: 1.6 }}>
                          {campaignResult.redirectResult.redirectComment}
                        </Text>
                        <Divider style={{ margin: "12px 0" }} />
                        <Space>
                          <CopyButton text={campaignResult.redirectResult.redirectComment} />
                          <Tag icon={<CheckCircleOutlined />} color="success">Đã tạo thành công</Tag>
                        </Space>
                      </Card>
                    ) : (
                      <Alert
                        type="warning"
                        showIcon
                        icon={<WarningOutlined />}
                        message="Chưa có group phù hợp"
                        description="Cần thêm nhóm trong phần Quản lý nhóm để tạo redirect comment."
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </AppLayout>
  );
}
