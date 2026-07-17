import { Search, X } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Cari…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="form-input pl-9 pr-8"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded">
          <X className="w-3.5 h-3.5 text-slate-400" />
        </button>
      )}
    </div>
  )
}
