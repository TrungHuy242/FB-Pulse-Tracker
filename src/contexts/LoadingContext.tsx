/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface LoadingContextType {
  loadingStates: Record<string, boolean>;
  showLoading: (key: string) => void;
  closeLoading: (key: string) => void;
  isLoading: (key: string) => boolean;
  isAnyLoading: () => boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {}
  );

  const showLoading = useCallback((key: string) => {
    setLoadingStates((prev) => {
      if (prev[key]) return prev; // Tránh update state nếu đã true
      return { ...prev, [key]: true };
    });
  }, []);

  const closeLoading = useCallback((key: string) => {
    setLoadingStates((prev) => {
      if (!prev[key]) return prev; // Tránh update state nếu không có key
      const newStates = { ...prev };
      delete newStates[key];
      return newStates;
    });
  }, []);

  const isLoading = useCallback((key: string) => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  const isAnyLoading = useCallback(() => {
    return Object.values(loadingStates).some((loading) => loading);
  }, [loadingStates]);

  return (
    <LoadingContext.Provider
      value={{
        loadingStates,
        showLoading,
        closeLoading,
        isLoading,
        isAnyLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within LoadingProvider");
  }
  return context;
};
