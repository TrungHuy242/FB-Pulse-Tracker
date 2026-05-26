/**
 * BrandLogo — logo và title của ứng dụng trong Header.
 */
import { BarChartOutlined } from "@ant-design/icons";

export const BrandLogo = () => {
  return (
    <div className="logo-section">
      {/* Emerald fill with dark ink — brand's "lit surface" signature */}
      <div className="logo-icon">
        <BarChartOutlined style={{ fontSize: 16 }} />
      </div>
      <h1 className="title">FB Pulse Tracker</h1>
    </div>
  );
};
