import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

interface SafeEChartsProps {
  option: unknown;
  style?: React.CSSProperties;
  className?: string;
}

export function SafeECharts({ option, style, className }: SafeEChartsProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const chart = echarts.init(hostRef.current);
    chartRef.current = chart;

    return () => {
      chartRef.current = null;
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option as EChartsOption, true);
  }, [option]);

  useEffect(() => {
    if (!hostRef.current || typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    resizeObserver.observe(hostRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return <div ref={hostRef} style={style} className={className} />;
}
