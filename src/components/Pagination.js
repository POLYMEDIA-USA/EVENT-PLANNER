'use client';

/**
 * Reusable pagination component.
 *
 * Props:
 *  - totalItems:    number   total rows in the dataset
 *  - page:          number   current page (1-based)
 *  - pageSize:      number   rows per page
 *  - onPageChange:  (page) => void
 *  - onPageSizeChange: (size) => void
 *  - pageSizeOptions: number[] (default [25, 50, 100])
 */
export default function Pagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeP = Math.min(page, totalPages);
  const start = (safeP - 1) * pageSize + 1;
  const end = Math.min(safeP * pageSize, totalItems);

  // Build visible page numbers (max 7 buttons)
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (safeP > 3) pages.push('...');
    for (let i = Math.max(2, safeP - 1); i <= Math.min(totalPages - 1, safeP + 1); i++) pages.push(i);
    if (safeP < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs">
      {/* Left: showing X-Y of Z + page-size selector */}
      <div className="flex items-center gap-3">
        <span className="text-gray-500">
          {start}–{end} of {totalItems}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-gray-400">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
            className="px-1.5 py-0.5 border border-gray-300 rounded text-xs bg-white"
          >
            {pageSizeOptions.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: page buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(safeP - 1)}
          disabled={safeP <= 1}
          className="px-2 py-1 rounded border border-gray-300 bg-white disabled:opacity-30 hover:bg-gray-100"
        >
          Prev
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="px-1 text-gray-400">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-2 py-1 rounded border ${
                p === safeP
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 bg-white hover:bg-gray-100 text-gray-700'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(safeP + 1)}
          disabled={safeP >= totalPages}
          className="px-2 py-1 rounded border border-gray-300 bg-white disabled:opacity-30 hover:bg-gray-100"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/** Slice an array for the current page. */
export function paginate(arr, page, pageSize) {
  const start = (page - 1) * pageSize;
  return arr.slice(start, start + pageSize);
}
