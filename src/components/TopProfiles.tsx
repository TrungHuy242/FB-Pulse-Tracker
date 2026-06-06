import React from "react";
import { Card, Avatar, Button } from "antd";
import { UserOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { useImportData } from "@/contexts/ImportDataContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";

interface ProfileItem {
  name: string;
  grade: string;
  engagement: string;
  engagementNum: number;
}

export const TopProfiles: React.FC = () => {
  const { imports } = useImportData();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // Tạo dữ liệu top profiles
  const profiles: ProfileItem[] = React.useMemo(() => {
    if (!imports || imports.length === 0) {
      // Mock data giống thiết kế Stitch khi chưa có dữ liệu
      return [
        { name: "Alex Rivera", grade: "Grade A", engagement: "92% Engagement", engagementNum: 92 },
        { name: "Sarah Chen", grade: "Grade B+", engagement: "88% Engagement", engagementNum: 88 },
        { name: "Marcus Wright", grade: "Grade B", engagement: "84% Engagement", engagementNum: 84 },
      ];
    }

    // Nhóm theo tên account
    const map: Record<string, { comments: number; reactions: number }> = {};
    imports.forEach((imp) => {
      const name = imp.accountName || "Unknown Account";
      if (!map[name]) {
        map[name] = { comments: 0, reactions: 0 };
      }
      map[name].comments += imp.commentsCount || 0;
      map[name].reactions += imp.reactionsCount || 0;
    });

    // Chuyển thành array và sort
    const sorted = Object.entries(map)
      .map(([name, counts]) => ({
        name,
        total: counts.comments + counts.reactions,
      }))
      .sort((a, b) => b.total - a.total);

    // Lấy top 3 và gán thông số tương đối
    const grades = ["Grade A", "Grade B+", "Grade B"];
    const baseRates = [92, 85, 78];

    const result = sorted.slice(0, 3).map((item, index) => {
      const rate = baseRates[index] || 70;
      return {
        name: item.name,
        grade: grades[index] || "Grade C",
        engagement: `${rate}% Engagement`,
        engagementNum: rate,
      };
    });

    // Nếu có ít hơn 3 profile, chèn mock cho đủ 3
    if (result.length < 3) {
      const mockProfiles = [
        { name: "Alex Rivera", grade: "Grade A", engagement: "92% Engagement", engagementNum: 92 },
        { name: "Sarah Chen", grade: "Grade B+", engagement: "88% Engagement", engagementNum: 88 },
        { name: "Marcus Wright", grade: "Grade B", engagement: "84% Engagement", engagementNum: 84 },
      ];
      for (let i = result.length; i < 3; i++) {
        // Tránh trùng tên
        const mock = mockProfiles[i] || mockProfiles[0];
        result.push({
          ...mock,
          name: result.some(r => r.name === mock.name) ? `${mock.name} II` : mock.name
        });
      }
    }

    return result;
  }, [imports]);

  return (
    <Card
      style={{
        background: isDark ? "#111111" : "#ffffff",
        border: `1px solid ${isDark ? "#252525" : "#dfdfdf"}`,
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      styles={{ body: { padding: "20px 24px", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" } }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: isDark ? "#8a8a8a" : "#6b6b6b",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          Top Profiles
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {profiles.map((p, idx) => {
            // Xác định màu sắc avatar hoặc grade
            let avatarBg = "rgba(16, 185, 129, 0.1)";
            let avatarColor = "#10b981";
            if (idx === 1) {
              avatarBg = "rgba(59, 130, 246, 0.1)";
              avatarColor = "#3b82f6";
            } else if (idx === 2) {
              avatarBg = "rgba(245, 158, 11, 0.1)";
              avatarColor = "#f59e0b";
            }

            return (
              <div
                key={p.name + idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar
                    icon={<UserOutlined />}
                    style={{ background: avatarBg, color: avatarColor }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: isDark ? "#ffffff" : "#171717",
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: isDark ? "#6b6b6b" : "#888888",
                      }}
                    >
                      {p.engagement}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: isDark ? "#1c1c1c" : "#f5f5f5",
                    color: isDark ? "#10b981" : "#10b981",
                    border: `1px solid ${isDark ? "#2a2a2a" : "#e5e7eb"}`,
                  }}
                >
                  {p.grade}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Button
        type="link"
        onClick={() => navigate("/analytics")}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: 0,
          marginTop: 24,
          alignSelf: "flex-start",
          color: "#10b981",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        View All Profiles <ArrowRightOutlined style={{ fontSize: 11 }} />
      </Button>
    </Card>
  );
};
