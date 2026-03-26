import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  date: string
  views: number
}

interface Props {
  data: DataPoint[]
}

export function ViewsChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
        No analytics data yet
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Views per day</h3>
      <p className="text-xs text-gray-400 mb-6">Daily view count across all posts</p>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
          />
          <Tooltip
            contentStyle={{
              background: '#0a0a0a',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '13px',
              padding: '10px 14px',
            }}
            formatter={(value) => [Number(value).toLocaleString(), 'Views']}
            labelFormatter={(label) => new Date(label).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
          />
          <Area
            type="monotone"
            dataKey="views"
            stroke="#f97316"
            strokeWidth={2.5}
            fill="url(#viewsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
