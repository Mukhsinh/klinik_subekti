import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

export default function SearchableSelect({
    options = [],
    value = '',
    onChange,
    placeholder = 'Pilih Opsi...',
    disabled = false,
    className = ''
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const containerRef = useRef(null)
    const searchInputRef = useRef(null)
    const dropdownRef = useRef(null)

    // Close the dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Reset search when opening dropdown & auto-focus search input
    useEffect(() => {
        if (isOpen) {
            setSearch('')
            // Small delay to ensure DOM is ready
            requestAnimationFrame(() => {
                searchInputRef.current?.focus()
            })
        }
    }, [isOpen])

    // Calculate dropdown position: open upward if close to bottom of viewport
    useEffect(() => {
        if (isOpen && containerRef.current && dropdownRef.current) {
            const triggerRect = containerRef.current.getBoundingClientRect()
            const dropdownEl = dropdownRef.current
            const viewportHeight = window.innerHeight
            const spaceBelow = viewportHeight - triggerRect.bottom
            const dropdownHeight = dropdownEl.offsetHeight

            if (spaceBelow < dropdownHeight && triggerRect.top > dropdownHeight) {
                dropdownEl.style.bottom = `${triggerRect.height + 4}px`
                dropdownEl.style.top = 'auto'
            } else {
                dropdownEl.style.top = `${triggerRect.height + 4}px`
                dropdownEl.style.bottom = 'auto'
            }
        }
    }, [isOpen])

    const selectedOption = options.find(opt => opt.value === value)

    const filteredOptions = useMemo(() =>
        options.filter(opt =>
            (opt.label || '').toLowerCase().includes(search.toLowerCase())
        ),
        [options, search]
    )

    const handleSelect = (val) => {
        onChange(val)
        setIsOpen(false)
    }

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className="form-select flex items-center justify-between w-full text-left gap-2"
                style={{ minHeight: '38px' }}
            >
                <span className={`block truncate flex-1 ${!selectedOption ? 'text-slate-400' : 'text-slate-700'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div
                    ref={dropdownRef}
                    className="absolute left-0 bg-white rounded-xl shadow-lg border border-slate-200 z-[100] py-1.5 flex flex-col"
                    style={{ minWidth: '280px', width: 'max-content', maxWidth: '460px', maxHeight: '300px' }}
                >
                    {/* Search box at the top */}
                    <div className="px-3 pb-2 pt-1 border-b border-slate-100 relative flex-shrink-0">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cari..."
                            className="w-full form-input pl-8 pr-8 py-1.5 text-xs"
                            onClick={e => e.stopPropagation()}
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSearch('') }}
                                className="absolute right-5 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
                            >
                                <X className="w-3 h-3 text-slate-400" />
                            </button>
                        )}
                    </div>

                    {/* Options list */}
                    <div className="overflow-y-auto flex-1 py-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-slate-400 text-center">
                                Tidak ada data
                            </div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    disabled={opt.disabled}
                                    onClick={() => handleSelect(opt.value)}
                                    className={`w-full text-left px-4 py-2 text-xs transition-colors whitespace-nowrap ${opt.disabled ? 'text-slate-300 cursor-not-allowed bg-slate-50/50' :
                                        opt.value === value ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
