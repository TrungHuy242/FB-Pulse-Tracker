/**
 * SettingsPage — Cài đặt ứng dụng.
 * TODO: Theme toggle, notification settings, export preferences.
 */
import { AppLayout } from "@/layouts/AppLayout";
import { Empty } from "antd";
import { SettingOutlined } from "@ant-design/icons";

export default function SettingsPage() {
  return (
    <AppLayout title="Cài đặt">
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 400,
        gap: 12,
      }}>
        <SettingOutlined style={{ fontSize: 48, color: "#dfdfdf" }} />
        <Empty
          description={
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 600, color: "#171717", marginBottom: 4 }}>
                Đang phát triển
              </div>
              <div style={{ color: "#8a8a8a", fontSize: 13 }}>
                Sắp ra mắt: Dark/Light mode · Thông báo · Tùy chọn xuất báo cáo
              </div>
            </div>
          }
        />
      </div>
    </AppLayout>
  );
}
