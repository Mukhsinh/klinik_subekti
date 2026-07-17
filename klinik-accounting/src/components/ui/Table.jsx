export function Table({ columns, data, emptyText = 'Tidak ada data', loading = false, onRowClick }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{ width: col.width }} className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} className="text-center py-10 text-slate-400">Memuat data…</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} className="text-center py-10 text-slate-400">{emptyText}</td></tr>
          ) : data.map((row, i) => (
            <tr key={row.id || i} onClick={() => onRowClick?.(row)} className={onRowClick ? 'cursor-pointer' : ''}>
              {columns.map(col => (
                <td key={col.key} className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({ page, pageSize, total, onChange }) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
      <p className="text-sm text-slate-500">
        Menampilkan {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} dari {total} data
      </p>
      <div className="flex gap-1">
        <button className="btn-secondary py-1 px-3 text-xs" disabled={page === 1} onClick={() => onChange(page - 1)}>←</button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
          return (
            <button key={p} onClick={() => onChange(p)}
              className={`py-1 px-3 text-xs rounded-lg ${p === page ? 'bg-primary-600 text-white' : 'btn-secondary'}`}>
              {p}
            </button>
          )
        })}
        <button className="btn-secondary py-1 px-3 text-xs" disabled={page === totalPages} onClick={() => onChange(page + 1)}>→</button>
      </div>
    </div>
  )
}
