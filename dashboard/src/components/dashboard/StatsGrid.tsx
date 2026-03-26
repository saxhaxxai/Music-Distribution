import { Eye, FileVideo, TrendingUp, Users, Heart, Bookmark } from 'lucide-react'

const gradients = [
  'from-orange-400 to-pink-500',
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-400',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
]

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  gradient: string
}

function StatCard({ label, value, icon, gradient }: StatCardProps) {
  return (
    <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 p-5 group hover:shadow-md transition-shadow">
      <div className={`absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br ${gradient} rounded-full opacity-10 group-hover:opacity-20 transition-opacity`} />
      <div className={`w-9 h-9 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center text-white mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900 tracking-tight">{value}</div>
      <div className="text-xs text-gray-400 font-medium mt-0.5">{label}</div>
    </div>
  )
}

interface StatsGridProps {
  totalViews: number
  totalLikes: number
  totalPosts: number
  totalBookmarks?: number
  activeCreators?: number
  avgEngagement?: number
  isAdmin?: boolean
}

export function StatsGrid({ totalViews, totalLikes, totalPosts, totalBookmarks, activeCreators, avgEngagement, isAdmin }: StatsGridProps) {
  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
  }

  return (
    <div className={`grid gap-3 grid-cols-2 sm:gap-4 ${isAdmin ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
      <StatCard
        label="Total Views"
        value={formatNumber(totalViews)}
        icon={<Eye className="w-4 h-4" />}
        gradient={gradients[0]}
      />
      <StatCard
        label="Total Likes"
        value={formatNumber(totalLikes)}
        icon={<Heart className="w-4 h-4" />}
        gradient={gradients[1]}
      />
      <StatCard
        label="Saves"
        value={formatNumber(totalBookmarks || 0)}
        icon={<Bookmark className="w-4 h-4" />}
        gradient={gradients[4]}
      />
      <StatCard
        label="Total Posts"
        value={totalPosts}
        icon={<FileVideo className="w-4 h-4" />}
        gradient={gradients[2]}
      />
      {isAdmin && (
        <StatCard
          label="Active Creators"
          value={activeCreators || 0}
          icon={<Users className="w-4 h-4" />}
          gradient={gradients[4]}
        />
      )}
      <StatCard
        label="Avg Engagement"
        value={`${(avgEngagement || 0).toFixed(1)}%`}
        icon={<TrendingUp className="w-4 h-4" />}
        gradient={gradients[3]}
      />
    </div>
  )
}
