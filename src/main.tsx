import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AuthProvider } from "@/contexts/AuthContext";
import { initSentry } from "@/service/sentry";
import "./styles/responsive.scss";
import "./styles/layout.scss";
import "./styles/print.scss";

// Khởi tạo Sentry trước khi render (chỉ chạy khi có VITE_SENTRY_DSN)
initSentry();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LoadingProvider>
      <AuthProvider>
        <App />
        <LoadingOverlay />
      </AuthProvider>
    </LoadingProvider>
  </StrictMode>
);
