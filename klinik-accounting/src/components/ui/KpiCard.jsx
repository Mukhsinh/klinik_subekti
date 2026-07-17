import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function KpiCard({ title, value, sub, icon: Icon, color = 'blue', trend, trendLabel }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',    val: 'text-blue-700' },
    green:  { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-700' },
    red:    { bg: 'bg-red-50',     icon: 'bg-red-100 text-red-600',      val: 'text-red-700' },
    purple: { bg: 'bg-purple-50',  icon: 'bg-purple-100 text-purple-600', val: 'text-purple-700' },
    amber:  { bg: 'bg-amber-50',   icon: 'bg-amber-100 text-amber-600',  val: 'text-amber-700' },
    teal:   { bg: 'bg-teal-50',    icon: 'bg-teal-100 text-teal-600',    val: 'text-teal-700' },
  }
  const c = colors[color] || colors.blue
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-600' : 'text-slate-400'

  return (
    <div className={`card p-5 ${c.bg} border-0`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{title}</p>
          <p className={`text-xl font-bold ${c.val} truncate`}>{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>}
          {trendLabel && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              <span>{trendLabel}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ml-3 ${c.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  )
}
