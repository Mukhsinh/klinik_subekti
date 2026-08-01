import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color = 'blue',
  trend,
  trendLabel,
  variant = 'solid'
}) {
  const iconColors = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    green: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    red: 'text-rose-600 bg-rose-50 border-rose-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    teal: 'text-teal-600 bg-teal-50 border-teal-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    cyan: 'text-cyan-600 bg-cyan-50 border-cyan-100',
    orange: 'text-orange-600 bg-orange-50 border-orange-100',
  }

  const solidColors = {
    blue: { bg: 'bg-blue-600', text: 'text-white', sub: 'text-blue-100', icon: 'bg-white/20 text-white' },
    green: { bg: 'bg-emerald-600', text: 'text-white', sub: 'text-emerald-100', icon: 'bg-white/20 text-white' },
    red: { bg: 'bg-rose-600', text: 'text-white', sub: 'text-rose-100', icon: 'bg-white/20 text-white' },
    purple: { bg: 'bg-purple-600', text: 'text-white', sub: 'text-purple-100', icon: 'bg-white/20 text-white' },
    amber: { bg: 'bg-amber-500', text: 'text-white', sub: 'text-amber-100', icon: 'bg-white/20 text-white' },
    teal: { bg: 'bg-teal-600', text: 'text-white', sub: 'text-teal-100', icon: 'bg-white/20 text-white' },
    indigo: { bg: 'bg-indigo-600', text: 'text-white', sub: 'text-indigo-100', icon: 'bg-white/20 text-white' },
    cyan: { bg: 'bg-cyan-600', text: 'text-white', sub: 'text-cyan-100', icon: 'bg-white/20 text-white' },
    orange: { bg: 'bg-orange-500', text: 'text-white', sub: 'text-orange-100', icon: 'bg-white/20 text-white' },
  }

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus

  if (variant === 'solid') {
    const c = solidColors[color] || solidColors.blue
    return (
      <div className={`rounded-xl p-3.5 ${c.bg} border-0 text-white shadow-sm hover:shadow-md transition-all duration-200`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-white/85 mb-1 truncate">{title}</p>
            <p className="text-lg lg:text-xl font-extrabold text-white truncate font-sans tracking-tight">{value}</p>
            {sub && sub !== 'Computed' && <p className={`text-[10px] font-medium mt-1 truncate ${c.sub}`}>{sub}</p>}
            {trendLabel && (
              <div className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-white/90">
                <TrendIcon className="w-3 h-3" />
                <span>{trendLabel}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${c.icon}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
    )
  }

  const iconStyle = iconColors[color] || iconColors.blue

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] font-semibold text-slate-500 mb-1 truncate">{title}</p>
          <p className="text-lg lg:text-xl font-extrabold text-slate-900 font-sans tracking-tight my-0.5 truncate">
            {value}
          </p>
          {sub && sub !== 'Computed' && (
            <div className="mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200 shadow-2xs">
                {sub}
              </span>
            </div>
          )}
          {trendLabel && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-slate-600">
              <TrendIcon className="w-3 h-3 text-slate-500" />
              <span>{trendLabel}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${iconStyle}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  )
}
