import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { PostsTable } from '@/components/dashboard/PostsTable'
import { ViewsChart } from '@/components/dashboard/ViewsChart'
import { SubmitPostModal } from '@/components/dashboard/SubmitPostModal'
import { WelcomeModal } from '@/components/dashboard/WelcomeModal'
import { DailyProgress } from '@/components/dashboard/DailyProgress'
import { Plus } from 'lucide-react'
import type { Post } from '@/types'

export function CreatorDashboard() {
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [showSubmit, setShowSubmit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('luca_welcome_shown'))

  async function fetchData() {
    if (!user) return

    const { data } = await supabase
      .from('posts')
      .select('*, analytics(*)')
      .eq('submitted_by', user.id)
      .order('created_at', { ascending: false })

    setPosts(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [user])

  // Filter posts by platform
  const filteredPosts = platformFilter === 'all'
    ? posts
    : posts.filter(p => p.platform === platformFilter)

  // Calculate stats from filtered posts
  const totalViews = filteredPosts.reduce((sum, post) => {
    const latest = post.analytics
      ?.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]
    return sum + (latest?.views || 0)
  }, 0)

  const totalLikes = filteredPosts.reduce((sum, post) => {
    const latest = post.analytics
      ?.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]
    return sum + (latest?.likes || 0)
  }, 0)

  const totalBookmarks = filteredPosts.reduce((sum, post) => {
    const latest = post.analytics
      ?.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]
    return sum + (latest?.bookmarks || 0)
  }, 0)

  const avgEngagement = filteredPosts.reduce((sum, post) => {
    const latest = post.analytics
      ?.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]
    return sum + (latest?.engagement_rate || 0)
  }, 0) / (filteredPosts.length || 1)

  const chartData = buildChartData(filteredPosts)

  if (loading) {
    return <div className="text-gray-400">Loading...</div>
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Here's how your content is performing.</p>
        </div>
        <button
          onClick={() => setShowSubmit(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Submit Post
        </button>
      </div>

      {/* Platform filter */}
      <div className="flex items-center gap-1.5 bg-white rounded-xl p-1 border border-gray-100 w-fit">
        {['all', 'tiktok', 'instagram'].map((p) => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              platformFilter === p
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {p === 'all' ? 'All Platforms' : p === 'tiktok' ? 'TikTok' : 'Instagram'}
          </button>
        ))}
      </div>

      <DailyProgress />

      <StatsGrid
        totalViews={totalViews}
        totalLikes={totalLikes}
        totalBookmarks={totalBookmarks}
        totalPosts={filteredPosts.length}
        avgEngagement={avgEngagement}
      />

      <ViewsChart data={chartData} />

      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Your Posts</h2>
        <PostsTable posts={filteredPosts} onRefreshed={fetchData} />
      </div>

      {showSubmit && (
        <SubmitPostModal
          onClose={() => setShowSubmit(false)}
          onSubmitted={fetchData}
        />
      )}

      {showWelcome && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}
    </div>
  )
}

function buildChartData(posts: Post[]) {
  const dailyDelta: Record<string, number> = {}

  posts.forEach((post) => {
    if (!post.analytics?.length) return
    const sorted = [...post.analytics].sort(
      (a, b) => new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime()
    )
    sorted.forEach((a, i) => {
      const date = a.fetched_at.split('T')[0]
      const prev = i > 0 ? sorted[i - 1].views : 0
      const delta = Math.max(0, a.views - prev)
      dailyDelta[date] = (dailyDelta[date] || 0) + delta
    })
  })

  return Object.entries(dailyDelta)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({ date, views }))
}
