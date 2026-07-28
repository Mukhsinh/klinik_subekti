import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function KpiCard({ title, value, sub, icon: Icon, color = 'blue', trend, trendLabel }) {
  const colors = {
    blue: { bg: 'bg-blue-600', icon: 'bg-white/20 text-white', text: 'text-white', sub: 'text-blue-100' },
    green: { bg: 'bg-emerald-600', icon: 'bg-white/20 text-white', text: 'text-white', sub: 'text-emerald-100' },
    red: { bg: 'bg-rose-600', icon: 'bg-white/20 text-white', text: 'text-white', sub: 'text-rose-100' },
    purple: { bg: 'bg-purple-600', icon: 'bg-white/20 text-white', text: 'text-white', sub: 'text-purple-100' },
    amber: { bg: 'bg-amber-500', icon: 'bg-white/20 text-white', text: 'text-white', sub: 'text-amber-100' },
    teal: { bg: 'bg-teal-600', icon: 'bg-white/20 text-white', text: 'text-white', sub: 'text-teal-100' },
  }
  const c = colors[color] || colors.blue
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = 'text-white/90'

  return (
    <div className={`card p-5 ${c.bg} border-0 text-white shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-white/80 mb-1">{title}</p>
          <p className="text-xl font-black text-white truncate font-mono">{value}</p>
          {sub && <p className={`text-xs mt-0.5 truncate ${c.sub}`}>{sub}</p>}
          {trendLabel && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              <span>{trendLabel}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ml-3 ${c.icon}`}>
            <Icon className="w-5.5 h-5.5" />
          </div>
        )}
      </div>
    </div>
  )
}
