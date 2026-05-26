/**
 * UserMenu — avatar dropdown với thông tin user, link admin, và logout.
 */
import { Avatar, Dropdown } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const UserMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <Dropdown
      menu={{
        items: [
          {
            key: "info",
            label: (
              <div style={{ padding: "4px 8px", minWidth: 160 }}>
                <div style={{ fontWeight: 600, color: "#171717" }}>
                  {user.displayName ?? ""}
                </div>
                <div style={{ color: "#666666", fontSize: 12, marginTop: 2 }}>
                  {user.email}
                </div>
              </div>
            ),
            disabled: true,
          },
          { type: "divider" },
          {
            key: "admin",
            label: "Quản trị",
            onClick: () => navigate("/admin"),
          },
          {
            key: "logout",
            label: "Đăng xuất",
            danger: true,
            onClick: () => logout(),
          },
        ],
      }}
      placement="bottomRight"
      trigger={["click"]}
    >
      <Avatar
        icon={<UserOutlined />}
        size={34}
        style={{ cursor: "pointer" }}
      />
    </Dropdown>
  );
};
