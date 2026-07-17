import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, ChevronDown, X, Check } from 'lucide-react'

/**
 * SearchableSelect — dropdown dengan search & banyak baris
 * Props:
 *   options    : [{ value, label, sub?, group? }]
 *   value      : string (selected value)
 *   onChange   : (value) => void
 *   placeholder: string
 *   className  : string
 *   disabled   : bool
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = '— Pilih —',
  className = '',
  disabled = false,
}) {
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState('')
  const wrapRef  = useRef(null)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  const selected = options.find(o => o.value === value) || null

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus search input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      o.value.toLowerCase().includes(q) ||
      (o.sub  || '').toLowerCase().includes(q) ||
      (o.group|| '').toLowerCase().includes(q)
    )
  }, [options, query])

  // Group options
  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach(o => {
      const g = o.group || ''
      if (!groups[g]) groups[g] = []
      groups[g].push(o)
    })
    return groups
  }, [filtered])

  const handleSelect = (val) => {
    onChange(val)
    setOpen(false)
    setQuery('')
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg transition-colors text-left
          ${open ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-200 hover:border-slate-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
      >
        <span className="flex-1 truncate">
          {selected ? (
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs text-primary-700 flex-shrink-0">{selected.value}</span>
              <span className="text-slate-700 truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {value && !disabled && (
            <span onClick={handleClear}
              className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[360px] max-w-[560px] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
          style={{ maxHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          {/* Search box */}
          <div className="p-2.5 border-b border-slate-100 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Ketik kode atau nama akun…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
              />
              {query && (
                <button onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded">
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1.5 px-0.5">
              {filtered.length} akun ditemukan {query ? `untuk "${query}"` : ''}
            </p>
          </div>

          {/* Option list */}
          <div ref={listRef} className="overflow-y-auto flex-1" style={{ maxHeight: '320px' }}>
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                Akun tidak ditemukan
              </div>
            ) : Object.entries(grouped).map(([group, opts]) => (
              <div key={group}>
                {group && (
                  <div className="sticky top-0 px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
                    {group}
                  </div>
                )}
                {opts.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-primary-50 transition-colors group
                      ${opt.value === value ? 'bg-primary-50' : ''}`}
                  >
                    <span className="font-mono text-xs text-primary-700 w-24 flex-shrink-0 font-medium">
                      {opt.value}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="text-sm text-slate-800 group-hover:text-primary-800 truncate block">
                        {opt.label}
                      </span>
                      {opt.sub && (
                        <span className="text-xs text-slate-400 block truncate">{opt.sub}</span>
                      )}
                    </span>
                    {opt.value === value && (
                      <Check className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
