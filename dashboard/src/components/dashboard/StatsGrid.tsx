import { Eye, FileVideo, TrendingUp, Users } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  icon: React.ReactNode
}

function StatCard({ label, value, change, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">{label}</span>
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {change && (
        <span className="text-sm text-green-600 mt-1">{change}</span>
      )}
    </div>
  )
}

interface StatsGridProps {
  totalViews: number
  totalPosts: number
  activeCreators?: number
  avgEngagement?: number
  isAdmin?: boolean
}

export function StatsGrid({ totalViews, totalPosts, activeCreators, avgEngagement, isAdmin }: StatsGridProps) {
  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
  }

  return (
    <div className={`grid gap-4 ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
      <StatCard
        label="Total Views"
        value={formatNumber(totalViews)}
        icon={<Eye className="w-5 h-5" />}
      />
      <StatCard
        label="Total Posts"
        value={totalPosts}
        icon={<FileVideo className="w-5 h-5" />}
      />
      {isAdmin && (
        <StatCard
          label="Active Creators"
          value={activeCreators || 0}
          icon={<Users className="w-5 h-5" />}
        />
      )}
      <StatCard
        label="Avg Engagement"
        value={`${(avgEngagement || 0).toFixed(1)}%`}
        icon={<TrendingUp className="w-5 h-5" />}
      />
    </div>
  )
}
