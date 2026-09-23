"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "./Input";
import { EmptyState } from "./EmptyState";

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  onSearch?: (term: string) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = "Search records...",
  onSearch,
  pageSize = 10,
  emptyTitle = "No records found",
  emptyDescription = "There are no items matching your criteria.",
  onRowClick,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortField, setSortField] = React.useState<string | null>(null);
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = React.useState(1);

  // Search filtering
  const filteredData = React.useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some(
        (val) => val && String(val).toLowerCase().includes(term)
      )
    );
  }, [data, searchTerm]);

  // Sorting
  const sortedData = React.useMemo(() => {
    if (!sortField) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      const res = valA < valB ? -1 : 1;
      return sortOrder === "asc" ? res : -res;
    });
  }, [filteredData, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key?: string) => {
    if (!key) return;
    if (sortField === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(key);
      setSortOrder("asc");
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Search Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="w-72">
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
              onSearch?.(e.target.value);
            }}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="text-xs text-zinc-500">
          Showing {paginatedData.length} of {sortedData.length} items
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-black/8 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-black">
            <thead className="bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500 border-b border-black/5">
              <tr>
                {columns.map((col, idx) => {
                  const key = String(col.accessorKey || idx);
                  return (
                    <th
                      key={key}
                      onClick={() => col.sortable && handleSort(col.accessorKey as string)}
                      className={`px-4 py-3.5 select-none ${
                        col.sortable ? "cursor-pointer hover:text-black" : ""
                      } ${col.className || ""}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.header}</span>
                        {col.sortable && sortField === col.accessorKey && (
                          sortOrder === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-black" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-black" />
                          )
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-12">
                    <EmptyState title={emptyTitle} description={emptyDescription} />
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rowIdx) => (
                  <tr
                    key={row.id || rowIdx}
                    onClick={() => onRowClick?.(row)}
                    className={`hover:bg-neutral-50 transition-colors ${
                      onRowClick ? "cursor-pointer" : ""
                    }`}
                  >
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className={`px-4 py-3 text-black ${col.className || ""}`}>
                        {col.cell
                          ? col.cell(row)
                          : col.accessorKey
                          ? row[col.accessorKey as string]
                          : null}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-black/5 bg-neutral-50/50 text-xs text-neutral-600">
            <div>
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-black/10 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-black"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-black/10 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-black"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
