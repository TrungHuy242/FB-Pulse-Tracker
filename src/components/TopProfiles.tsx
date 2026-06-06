import React from "react";
import { Card, Avatar, Button, Empty } from "antd";
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

  // Tạo dữ liệu top profiles từ dữ liệu thật
  const profiles: ProfileItem[] = React.useMemo(() => {
    if (!imports || imports.length === 0) {
      return [];
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

    // Chuyển thành array, tính Grade thật và sort
    const sorted = Object.entries(map)
      .map(([name, counts]) => {
        const total = counts.comments + counts.reactions;
        
        // Tính Grade thực tế dựa trên khối lượng tương tác
        let grade = "Grade C";
        if (total >= 10000) grade = "Grade A";
        else if (total >= 5000) grade = "Grade B+";
        else if (total >= 1000) grade = "Grade B";
        else if (total < 200) grade = "Grade D";

        return {
          name,
          grade,
          engagement: `${total.toLocaleString("vi-VN")} tương tác`,
          engagementNum: total,
        };
      })
      .sort((a, b) => b.engagementNum - a.engagementNum);

    // Lấy tối đa top 3 tài khoản có tương tác cao nhất
    return sorted.slice(0, 3);
  }, [imports]);

  const hasData = profiles.length > 0;

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
          Top Profiles (Tương tác hàng đầu)
        </div>

        {!hasData ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <Empty
              description={
                <span style={{ color: isDark ? "#8a8a8a" : "#6b6b6b" }}>
                  Chưa có dữ liệu tài khoản
                </span>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
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
                      background: isDark ? "rgba(16, 185, 129, 0.1)" : "#e6f7ed",
                      color: isDark ? "#10b981" : "#047857",
                      border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(4, 120, 87, 0.15)"}`,
                    }}
                  >
                    {p.grade}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Button
        type="link"
        onClick={() => navigate("/analytics")}
        disabled={!hasData}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          marginTop: 24,
          alignSelf: "flex-start",
          color: hasData ? (isDark ? "#10b981" : "#047857") : (isDark ? "#404040" : "#a3a3a3"),
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        View All Profiles <ArrowRightOutlined style={{ fontSize: 11 }} />
      </Button>
    </Card>
  );
};
