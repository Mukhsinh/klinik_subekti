export default function Badge({ label, variant = 'gray' }) {
  const variants = {
    gray: 'bg-slate-500 text-white',
    blue: 'bg-[#2563eb] text-white',
    green: 'bg-[#10b981] text-white',
    red: 'bg-[#ef4444] text-white',
    yellow: 'bg-[#f59e0b] text-white',
    purple: 'bg-[#a855f7] text-white',
    teal: 'bg-[#0d9488] text-white',
    orange: 'bg-[#f97316] text-white',
    indigo: 'bg-[#6366f1] text-white',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${variants[variant] || variants.green}`}>
      {label}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    // Jurnal
    DRAFT: { label: 'Draft', variant: 'yellow' },
    POSTED: { label: 'Diposting', variant: 'green' },
    REVERSED: { label: 'Dibalik', variant: 'red' },
    // Billing
    PAID: { label: 'Lunas', variant: 'green' },
    CANCELLED: { label: 'Dibatalkan', variant: 'red' },
    REFUNDED: { label: 'Dikembalikan', variant: 'orange' },
    // Expense
    VOID: { label: 'Dibatalkan', variant: 'red' },
    // User / item
    ACTIVE: { label: 'Aktif', variant: 'green' },
    INACTIVE: { label: 'Nonaktif', variant: 'red' },
    // Stock
    KRITIS: { label: 'Stok Kritis', variant: 'red' },
    AMAN: { label: 'Aman', variant: 'green' },
  }
  const { label, variant } = map[status] || { label: status, variant: 'teal' }
  return <Badge label={label} variant={variant} />
}
