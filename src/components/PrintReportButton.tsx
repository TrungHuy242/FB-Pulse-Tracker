/**
 * PrintReportButton — Nút "Xuất PDF" dùng browser print dialog.
 *
 * Khi click: chèn report header vào DOM, gọi window.print(), rồi xóa header.
 * CSS print.scss ẩn toàn bộ UI shell và tối ưu layout cho A4.
 *
 * Không cần thư viện ngoài — hoạt động trên mọi browser hiện đại.
 */
import { useState } from "react";
import { Button, Tooltip } from "antd";
import { FilePdfOutlined } from "@ant-design/icons";

interface PrintReportButtonProps {
  /** Tiêu đề in ở đầu trang PDF */
  title?: string;
  /** Dải thời gian hiện tại để in vào header */
  dateLabel?: string;
  size?: "small" | "middle" | "large";
  type?: "default" | "primary" | "text" | "link" | "dashed";
}

export function PrintReportButton({
  title = "Báo cáo phân tích",
  dateLabel = "Tất cả",
  size = "small",
  type = "default",
}: PrintReportButtonProps) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);

    // Chèn report header vào đầu body (sẽ hiện khi in)
    const header = document.createElement("div");
    header.id = "__print-report-header__";
    header.className = "print-report-header";
    header.innerHTML = `
      <div>
        <div class="print-report-title">${title}</div>
        <div style="font-size:11pt;color:#3ecf8e;font-weight:600;margin-top:2px">
          FB Pulse Tracker
        </div>
      </div>
      <div class="print-report-meta">
        <div>Khoảng thời gian: <strong>${dateLabel}</strong></div>
        <div>In lúc: ${new Date().toLocaleString("vi-VN")}</div>
      </div>
    `;

    // Chèn vào đầu #root > app-content
    const appContent = document.querySelector(".app-content");
    if (appContent) {
      appContent.insertBefore(header, appContent.firstChild);
    } else {
      document.body.insertBefore(header, document.body.firstChild);
    }

    // Delay nhỏ để browser render header trước khi mở dialog
    setTimeout(() => {
      window.print();
      // Xóa header sau khi in
      const inserted = document.getElementById("__print-report-header__");
      inserted?.remove();
      setPrinting(false);
    }, 150);
  };

  return (
    <Tooltip title="Xuất PDF qua browser print dialog (Ctrl+P → Save as PDF)">
      <Button
        size={size}
        type={type}
        icon={<FilePdfOutlined />}
        loading={printing}
        onClick={handlePrint}
      >
        PDF
      </Button>
    </Tooltip>
  );
}

export default PrintReportButton;
