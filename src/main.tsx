import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImportDataProvider } from "@/contexts/ImportDataContext";
import "./styles/responsive.scss";
import "./styles/layout.scss";
import "./styles/print.scss";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LoadingProvider>
      <AuthProvider>
        <ImportDataProvider>
          <App />
          <LoadingOverlay />
        </ImportDataProvider>
      </AuthProvider>
    </LoadingProvider>
  </StrictMode>
);
