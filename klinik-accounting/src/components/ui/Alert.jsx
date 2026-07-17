import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react'

const configs = {
  info:    { icon: Info,         bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   iconColor: 'text-blue-500' },
  success: { icon: CheckCircle,  bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-800',iconColor: 'text-emerald-500' },
  warning: { icon: AlertTriangle,bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  iconColor: 'text-amber-500' },
  error:   { icon: AlertCircle,  bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    iconColor: 'text-red-500' },
}

export default function Alert({ type = 'info', title, message, onClose }) {
  const { icon: Icon, bg, border, text, iconColor } = configs[type] || configs.info
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${bg} ${border}`}>
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        {title && <p className={`text-sm font-semibold ${text}`}>{title}</p>}
        {message && <p className={`text-sm ${text} ${title ? 'mt-0.5' : ''}`}>{message}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} className={`p-1 hover:bg-black/5 rounded flex-shrink-0 ${text}`}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
