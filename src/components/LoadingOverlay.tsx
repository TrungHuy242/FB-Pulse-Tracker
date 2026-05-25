import { Spin } from "antd";
import { useLoading } from "@/contexts/LoadingContext";
import "../styles/loading-overlay.scss";

export const LoadingOverlay = () => {
  const { isAnyLoading } = useLoading();

  if (!isAnyLoading()) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-overlay__content">
        <Spin size="large" />
        {/* <p className="loading-overlay__text">Loading...</p> */}
      </div>
    </div>
  );
};
