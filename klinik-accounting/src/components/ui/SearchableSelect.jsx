import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, ChevronDown, X, Check } from 'lucide-react'

/**
 * SearchableSelect — dropdown dengan search & banyak baris
 * Props:
 *   options    : [{ value, label, sub?, group?, disabled?, stockBadge? }]
 *   value      : string (selected value)
 *   onChange   : (value) => void
 *   placeholder: string
 *   className  : string
 *   disabled   : bool
 *   hideValue  : bool (force hide value code tag)
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = '— Pilih —',
  className = '',
  disabled = false,
  hideValue = false,
  searchPlaceholder = 'Ketik kata kunci…',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState({})
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const selected = options.find(o => o.value === value) || null

  // Auto-detect if value is a UUID or DB ID (e.g. d0000000-0000-...) -> hide automatically if true
  const isUuid = (val) => typeof val === 'string' && (val.length > 20 || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(val))
  const showValTag = !hideValue && selected && !isUuid(selected.value)

  const updatePosition = () => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const dropdownHeight = 340
      const openUpwards = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

      const calcWidth = Math.max(rect.width, 380)
      const calcLeft = Math.min(rect.left, window.innerWidth - calcWidth - 16)

      setDropdownStyle({
        position: 'fixed',
        left: `${Math.max(16, calcLeft)}px`,
        top: openUpwards ? `${Math.max(10, rect.top - dropdownHeight - 4)}px` : `${rect.bottom + 4}px`,
        width: `${calcWidth}px`,
        maxHeight: `${openUpwards ? Math.min(spaceAbove - 20, 360) : Math.min(spaceBelow - 20, 360)}px`,
        zIndex: 99999,
      })
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        // Also check if click is inside dropdown popover
        const popover = document.getElementById('searchable-select-popover')
        if (popover && popover.contains(e.target)) return

        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Update position on open, scroll, resize
  useEffect(() => {
    if (open) {
      updatePosition()
      if (inputRef.current) inputRef.current.focus()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
    }
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter(o =>
      (o.label || '').toLowerCase().includes(q) ||
      (o.value || '').toLowerCase().includes(q) ||
      (o.sub || '').toLowerCase().includes(q) ||
      (o.group || '').toLowerCase().includes(q)
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
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg transition-colors text-left font-sans
          ${open ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-200 hover:border-slate-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
      >
        <span className="flex-1 truncate">
          {selected ? (
            <span className="flex items-center gap-2">
              {showValTag && (
                <span className="font-mono text-xs text-primary-700 flex-shrink-0 font-bold">{selected.value}</span>
              )}
              <span className="text-slate-800 font-bold truncate">{selected.label}</span>
              {selected.stockBadge && (
                <span className="ml-1 flex-shrink-0">{selected.stockBadge}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 font-medium">{placeholder}</span>
          )}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {value && !disabled && (
            <span onClick={handleClear}
              className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id="searchable-select-popover"
          style={dropdownStyle}
          className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden font-sans flex flex-col"
        >
          {/* Search box */}
          <div className="p-2.5 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 font-sans"
              />
              {query && (
                <button onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded">
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 px-0.5 font-sans">
              {filtered.length} item ditemukan {query ? `untuk "${query}"` : ''}
            </p>
          </div>

          {/* Option list */}
          <div ref={listRef} className="overflow-y-auto flex-1 bg-white divide-y divide-slate-100" style={{ maxHeight: '340px' }}>
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-sans">
                Data item tidak ditemukan
              </div>
            ) : Object.entries(grouped).map(([group, opts]) => (
              <div key={group}>
                {group && (
                  <div className="sticky top-0 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100/90 border-b border-slate-200 font-sans">
                    {group}
                  </div>
                )}
                {opts.map(opt => {
                  const showOptVal = !hideValue && !isUuid(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => !opt.disabled && handleSelect(opt.value)}
                      className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-all group font-sans
                        ${opt.value === value ? 'bg-primary-50 font-bold' : ''}
                        ${opt.disabled ? 'opacity-45 cursor-not-allowed bg-slate-50/70' : 'hover:bg-primary-50/80 cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {showOptVal && (
                          <span className="font-mono text-xs text-primary-700 w-20 flex-shrink-0 font-bold">
                            {opt.value}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-800 group-hover:text-primary-800 truncate leading-snug font-sans">
                            {opt.label}
                          </div>
                          {opt.sub && (
                            <div className="text-[11px] text-slate-400 block truncate mt-0.5 font-medium">{opt.sub}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {opt.stockBadge}
                        {opt.value === value && (
                          <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
