/**
 * Tests for ThemeContext — Light/Dark mode provider.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

// ── localStorage mock ──────────────────────────────────────────────────────

// Use a simple record that actually holds state across mocked calls.
// We replace globalThis.localStorage with this object.
let fakeStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => fakeStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { fakeStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete fakeStore[key]; }),
  clear: vi.fn(() => { fakeStore = {}; }),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Wrapper for renderHook
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ThemeContext", () => {
  beforeEach(() => {
    // Reset the fake store AND clear vi mock call history
    fakeStore = {};
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    // Reset data-theme attribute on <html>
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to 'light' theme when no localStorage value", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
    expect(result.current.isDark).toBe(false);
  });

  it("reads initial theme 'dark' from localStorage", () => {
    fakeStore["fbpulse.theme"] = "dark";
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
    expect(result.current.isDark).toBe(true);
  });

  it("setTheme changes theme to dark", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.setTheme("dark");
    });

    expect(result.current.theme).toBe("dark");
    expect(result.current.isDark).toBe(true);
  });

  it("setTheme changes theme back to light", () => {
    fakeStore["fbpulse.theme"] = "dark";
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("light");
    });

    expect(result.current.theme).toBe("light");
    expect(result.current.isDark).toBe(false);
  });

  it("persists theme to localStorage on change", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith("fbpulse.theme", "dark");
  });

  it("sets data-theme attribute on <html> when theme changes to dark", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("sets data-theme='light' when theme changes back to light", () => {
    fakeStore["fbpulse.theme"] = "dark";
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("light");
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("ignores invalid localStorage value and defaults to 'light'", () => {
    fakeStore["fbpulse.theme"] = "invalid-value";
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
  });
});
