import {
  useState,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useEffect,
} from "react";
import { Card, Table, Button, Space, Tooltip, Modal, message } from "antd";
import {
  FolderOpenOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useAccountsTable } from "./AccountsTable/hooks/useAccountsTable";
import type { AccountsTableFilter } from "./AccountsTable/hooks/useAccountsTable";
import type { ImportRecord } from "@/types";
import CommentDetails from "./CommentDetails";
import ReactionDetails from "./ReactionDetails";
import "../styles/accounts-table.scss";
import { useImportComments } from "./AccountsTable/hooks/useImportComments";
import { useImportReactions } from "./AccountsTable/hooks/useImportReactions";
import { exportAllImportsToExcel } from "./exportAllImportsToExcel";
import { useLoading } from "@/contexts/LoadingContext";
import { deleteDoc, doc, collection, getDocs } from "firebase/firestore";
import { db } from "@/service/firebase";
import type { Timestamp } from "firebase/firestore";

export interface AccountsTableRef {
  reloadTable: () => void;
}

interface AccountsTableProps {
  filter?: AccountsTableFilter;
  reloadStats?: () => void;
  refreshSignal?: number;
  onDataChange?: () => void;
}

export const AccountsTable = forwardRef<AccountsTableRef, AccountsTableProps>(
  ({ reloadStats, filter, refreshSignal, onDataChange }, ref) => {
    const fromTime = filter?.from?.getTime() ?? null;
    const toTime = filter?.to?.getTime() ?? null;
    const filterName = filter?.name ?? null;
    const filterMinLikes = filter?.minLikes ?? null;
    const filterMinComments = filter?.minComments ?? null;

    const memoFilter = useMemo<AccountsTableFilter | undefined>(() => {
      if (!filter) return undefined;
      return {
        from: filter.from ?? undefined,
        to: filter.to ?? undefined,
        name: filter.name,
        minLikes: filter.minLikes,
        minComments: filter.minComments,
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromTime, toTime, filterName, filterMinLikes, filterMinComments]);

    const { tableData, reloadTable } = useAccountsTable(
      memoFilter,
      refreshSignal,
      "filter-accounts"
    );
    const { showLoading, closeLoading } = useLoading();

    useImperativeHandle(ref, () => ({ reloadTable }));

    const [selectedImport, setSelectedImport] = useState<ImportRecord | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReactionModalOpen, setIsReactionModalOpen] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

    const { comments, loading: commentsLoading } = useImportComments(
      selectedImport?.id,
      isModalOpen,
      filter?.from ?? null,
      filter?.to ?? null
    );

    const { reactions, loading: reactionsLoading } = useImportReactions(
      selectedImport?.id,
      isReactionModalOpen,
      filter?.from ?? null,
      filter?.to ?? null
    );

    useEffect(() => {
      setSelectedRowKeys([]);
    }, [tableData]);

    const handleDeleteImport = async (importId: string) => {
      let modalRef: ReturnType<typeof Modal.confirm> | null = null;
      modalRef = Modal.confirm({
        title: "Xác nhận xóa?",
        icon: <ExclamationCircleOutlined />,
        centered: true,
        content: "Hành động này sẽ xóa toàn bộ import, bình luận và cảm xúc liên quan.",
        okText: "Xóa",
        okType: "danger",
        cancelText: "Hủy",
        onOk: async () => {
          try {
            modalRef?.update?.({
              cancelButtonProps: { disabled: true },
              okButtonProps: { loading: true },
            });
          } catch {
            // ignore
          }

          try {
            const commentChunksSnap = await getDocs(
              collection(db, "imports", importId, "commentChunks")
            );
            for (const d of commentChunksSnap.docs) {
              await deleteDoc(doc(db, "imports", importId, "commentChunks", d.id));
            }

            const reactionChunksSnap = await getDocs(
              collection(db, "imports", importId, "reactionChunks")
            );
            for (const d of reactionChunksSnap.docs) {
              await deleteDoc(doc(db, "imports", importId, "reactionChunks", d.id));
            }

            await deleteDoc(doc(db, "imports", importId));
            message.success("Xóa import thành công");
            reloadTable();
            reloadStats?.();
            onDataChange?.();
          } catch (err) {
            console.error("Xóa import thất bại:", err);
            message.error("Xóa import thất bại");
            throw err;
          }
        },
      });
    };

    const columns = [
      {
        title: "Tên người dùng",
        dataIndex: "accountName",
        render: (text: string) => (
          <Tooltip title={text}>
            <span style={{ color: "#171717", fontWeight: 500 }}>{text}</span>
          </Tooltip>
        ),
      },
      {
        title: "Lượt thích",
        dataIndex: "reactionsCount",
        key: "reactionsCount",
        align: "center" as const,
        render: (count: number, record: ImportRecord) => {
          const n = count || 0;
          const disabled = n === 0;
          return (
            <Tooltip title={disabled ? "Không có lượt thích" : "Xem cảm xúc"}>
              <button
                className={`stat-badge stat-badge--likes${disabled ? " stat-badge--disabled" : ""}`}
                onClick={() => {
                  if (disabled) return;
                  setSelectedImport(record);
                  setIsReactionModalOpen(true);
                }}
                disabled={disabled}
                style={{ border: "none", cursor: disabled ? "default" : "pointer" }}
              >
                {n}
              </button>
            </Tooltip>
          );
        },
      },
      {
        title: "Bình luận",
        dataIndex: "commentsCount",
        align: "center" as const,
        render: (count: number, record: ImportRecord) => {
          const n = count || 0;
          const disabled = n === 0;
          return (
            <Tooltip title={disabled ? "Không có bình luận" : "Xem bình luận"}>
              <button
                className={`stat-badge stat-badge--comments${disabled ? " stat-badge--disabled" : ""}`}
                onClick={() => {
                  if (disabled) return;
                  setSelectedImport(record);
                  setIsModalOpen(true);
                }}
                disabled={disabled}
                style={{ border: "none", cursor: disabled ? "default" : "pointer" }}
              >
                {n}
              </button>
            </Tooltip>
          );
        },
      },
      {
        title: "Thời gian import",
        dataIndex: "importedAt",
        key: "importedAt",
        align: "center" as const,
        render: (value: Timestamp | null) => {
          if (!value) return <span style={{ color: "#aaa" }}>—</span>;
          return (
            <span style={{ color: "#666666", fontSize: 13 }}>
              {value.toDate().toLocaleString("vi-VN")}
            </span>
          );
        },
      },
      {
        title: "",
        key: "actions",
        align: "center" as const,
        width: 60,
        render: (_: unknown, record: ImportRecord) => (
          <Tooltip title="Xóa import">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteImport(record.id)}
              size="small"
              aria-label={`Xóa import của ${record.accountName}`}
            />
          </Tooltip>
        ),
      },
    ];

    return (
      <Card
        className="accounts-table-card"
        extra={
          <Space size={8}>
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              className="folder-button"
              onClick={async () => {
                try {
                  showLoading("export");
                  await exportAllImportsToExcel(undefined, memoFilter);
                } finally {
                  closeLoading("export");
                }
              }}
            >
              Xuất tất cả
            </Button>
            <Button
              className="export-selected-button"
              disabled={selectedRowKeys.length === 0}
              onClick={async () => {
                try {
                  showLoading("export");
                  await exportAllImportsToExcel(selectedRowKeys, memoFilter);
                } finally {
                  closeLoading("export");
                }
              }}
            >
              Xuất theo lựa chọn
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={tableData}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
          pagination={false}
          scroll={{
            x: 1000,
            y: tableData.length > 10 ? 500 : undefined,
          }}
          className="custom-table"
          rowKey={(record) => record.id}
        />

        <CommentDetails
          visible={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedImport(null);
          }}
          title={selectedImport?.accountName ?? null}
          comments={comments}
          loading={commentsLoading}
        />

        <ReactionDetails
          visible={isReactionModalOpen}
          onClose={() => {
            setIsReactionModalOpen(false);
            setSelectedImport(null);
          }}
          title={selectedImport?.accountName ?? null}
          reactions={reactions.map((r) => ({
            ...r,
            accountName: selectedImport?.accountName,
          }))}
          loading={reactionsLoading}
        />
      </Card>
    );
  }
);
