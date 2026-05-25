import { Header } from "@/components/Header";
import { StatsCards } from "@/components/StatsCards";
import EngagementChart from "@/components/EngagementChart";
import { AccountsTable } from "@/components/AccountsTable";
import { useRef, useState, useMemo } from "react";
import { Row, Col } from "antd";
import dayjs from "dayjs";
import { useStats } from "@/hooks/useStats";
import type { StatsFilter } from "@/types";

interface AccountsTableRef {
  reloadTable: () => void;
}

export default function HomePage() {
  const accountsTableRef = useRef<AccountsTableRef>(null);
  const [advancedFilter, setAdvancedFilter] = useState<StatsFilter>({});

  const fromTime = advancedFilter.from?.getTime() ?? null;
  const toTime = advancedFilter.to?.getTime() ?? null;
  const filterName = advancedFilter.name ?? null;

  const effectiveFilter = useMemo<StatsFilter | undefined>(() => {
    const hasRange = !!(advancedFilter.from && advancedFilter.to);
    const hasName = !!advancedFilter.name;
    if (hasRange || hasName) return advancedFilter;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTime, toTime, filterName]);

  const { stats, loading: statsLoading, reloadStats } = useStats(effectiveFilter);
  const [refreshSignal, setRefreshSignal] = useState(0);

  let dateLabel = "Tất cả";
  if (effectiveFilter?.from && effectiveFilter?.to) {
    const from = dayjs(effectiveFilter.from);
    const to = dayjs(effectiveFilter.to);
    dateLabel = from.isSame(to, "day")
      ? from.format("D/M/YYYY")
      : `${from.format("D/M/YYYY")} – ${to.format("D/M/YYYY")}`;
  }

  const handleImportSuccess = () => {
    accountsTableRef.current?.reloadTable();
    reloadStats();
    setRefreshSignal((s) => s + 1);
  };

  return (
    <div
      style={{ minHeight: "100vh", background: "#ffffff", padding: "32px 32px 40px" }}
      className="home-page-container"
    >
      <header>
        <Header
          onImportSuccess={handleImportSuccess}
          onAdvancedFilterChange={(f) => setAdvancedFilter(f)}
        />
      </header>
      <main>
        <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
          <Col xs={24} lg={8}>
            <StatsCards
              stats={stats}
              loading={statsLoading}
              dateLabel={dateLabel}
            />
          </Col>
          <Col xs={24} lg={16}>
            <EngagementChart
              filter={effectiveFilter}
              refreshSignal={refreshSignal}
            />
          </Col>
        </Row>
        <AccountsTable
          ref={accountsTableRef}
          filter={effectiveFilter}
          reloadStats={reloadStats}
          refreshSignal={refreshSignal}
          onDataChange={() => setRefreshSignal((s) => s + 1)}
        />
      </main>
    </div>
  );
}
