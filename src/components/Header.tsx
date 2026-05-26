/**
 * Header — thanh navigation chính của ứng dụng.
 *
 * Được tách thành 3 sub-components để giảm trách nhiệm:
 *   - BrandLogo  → logo và title
 *   - FilterBar  → date range, account select, filter/clear buttons, delete-all
 *   - UserMenu   → avatar dropdown (user info, admin link, logout)
 */
import { Button, Space } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { useRef, useState, useEffect } from "react";
import { getAccountNames } from "@/service/importService";

import "../styles/header.scss";
import { ImportZip, type FormDrawerHandle } from "./ImportFolder";
import { BrandLogo } from "./header/BrandLogo";
import { FilterBar } from "./header/FilterBar";
import { UserMenu } from "./header/UserMenu";

interface HeaderProps {
  onImportSuccess?: () => void;
  onAdvancedFilterChange?: (filter: {
    from?: Date;
    to?: Date;
    name?: string | string[];
  }) => void;
}

export const Header = ({
  onImportSuccess,
  onAdvancedFilterChange,
}: HeaderProps) => {
  const drawerImportFolderRef = useRef<FormDrawerHandle | null>(null);
  const [accountOptions, setAccountOptions] = useState<string[]>([]);

  const handleImportFolderClick = () => {
    drawerImportFolderRef.current?.open();
  };

  const fetchAccounts = async () => {
    try {
      const names = await getAccountNames();
      setAccountOptions(names);
    } catch (err) {
      console.error("Fetch account names failed:", err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAccounts();
  }, []);

  const handleImportSuccessWrapper = async () => {
    try {
      await fetchAccounts();
    } catch {
      // ignore
    }
    onImportSuccess?.();
  };

  return (
    <div className="header-container">
      <BrandLogo />

      {/* nav landmark: satisfies WCAG 1.3.6 when page has multiple links */}
      <nav aria-label="Điều hướng chính" className="header-actions">
        <Space size={6} wrap>
          <Button icon={<FileTextOutlined />} onClick={handleImportFolderClick}>
            Import
          </Button>

          <FilterBar
            accountOptions={accountOptions}
            onFilterChange={onAdvancedFilterChange}
            onDeleteAllSuccess={onImportSuccess}
            onRefreshAccounts={fetchAccounts}
          />

          <UserMenu />
        </Space>
      </nav>

      <ImportZip
        ref={drawerImportFolderRef}
        onImportSuccess={handleImportSuccessWrapper}
      />
    </div>
  );
};
