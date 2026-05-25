/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from "react";

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

  const showLoading = (key: string) => {
    setLoadingStates((prev) => ({ ...prev, [key]: true }));
  };

  const closeLoading = (key: string) => {
    setLoadingStates((prev) => {
      const newStates = { ...prev };
      delete newStates[key];
      return newStates;
    });
  };

  const isLoading = (key: string) => {
    return loadingStates[key] || false;
  };

  const isAnyLoading = () => {
    return Object.values(loadingStates).some((loading) => loading);
  };

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
