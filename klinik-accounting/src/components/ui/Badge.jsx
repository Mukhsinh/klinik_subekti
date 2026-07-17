export default function Badge({ label, variant = 'gray' }) {
  const variants = {
    gray:   'bg-slate-100 text-slate-600',
    blue:   'bg-blue-100 text-blue-700',
    green:  'bg-emerald-100 text-emerald-700',
    red:    'bg-red-100 text-red-700',
    yellow: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
    teal:   'bg-teal-100 text-teal-700',
    orange: 'bg-orange-100 text-orange-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.gray}`}>
      {label}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    // Jurnal
    DRAFT:    { label:'Draft',         variant:'yellow' },
    POSTED:   { label:'Diposting',     variant:'green'  },
    REVERSED: { label:'Dibalik',       variant:'red'    },
    // Billing
    PAID:     { label:'Lunas',         variant:'green'  },
    CANCELLED:{ label:'Dibatalkan',    variant:'red'    },
    REFUNDED: { label:'Dikembalikan',  variant:'orange' },
    // Expense
    VOID:     { label:'Dibatalkan',    variant:'red'    },
    // User / item
    ACTIVE:   { label:'Aktif',         variant:'green'  },
    INACTIVE: { label:'Nonaktif',      variant:'gray'   },
    // Stock
    KRITIS:   { label:'Stok Kritis',   variant:'red'    },
    AMAN:     { label:'Aman',          variant:'green'  },
  }
  const { label, variant } = map[status] || { label: status, variant: 'gray' }
  return <Badge label={label} variant={variant} />
}
