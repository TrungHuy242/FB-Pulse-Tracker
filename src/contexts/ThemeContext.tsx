/**
 * ThemeContext — Quản lý Light/Dark mode toàn ứng dụng.
 *
 * Lưu lựa chọn vào localStorage ("fbpulse.theme").
 * Gán data-theme="dark" | "light" lên <html> để CSS variables phản ứng.
 * Cung cấp isDark flag để App.tsx truyền vào Ant Design ConfigProvider.
 */
import React, { createContext, useContext, useState, useEffect } from "react";

type Theme = "light" | "dark";

const LS_THEME_KEY = "fbpulse.theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  /** true khi theme === "dark" — shorthand cho ConfigProvider algorithm */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  isDark: false,
});

/** Đọc theme khởi tạo từ localStorage (hoặc mặc định "light"). */
function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(LS_THEME_KEY);
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  /** Gọi khi user toggle theme */
  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  useEffect(() => {
    // Lưu vào localStorage
    try {
      localStorage.setItem(LS_THEME_KEY, theme);
    } catch {
      // Ignore storage errors (private browsing, full storage)
    }
    // Gán data-theme lên <html> để CSS variables và Ant Design dark algorithm phản ứng
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark: theme === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
};

/** Hook để đọc và thay đổi theme hiện tại. */
export const useTheme = (): ThemeContextValue => useContext(ThemeContext);
