import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { PostsTable } from '@/components/dashboard/PostsTable'
import { ViewsChart } from '@/components/dashboard/ViewsChart'
import { SubmitPostModal } from '@/components/dashboard/SubmitPostModal'
import { Plus } from 'lucide-react'
import type { Post, Account } from '@/types'

export function CreatorDashboard() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [, setAccounts] = useState<Account[]>([])
  const [showSubmit, setShowSubmit] = useState(false)
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    if (!user) return

    const [postsRes, accountsRes] = await Promise.all([
      supabase
        .from('posts')
        .select('*, analytics(*)')
        .eq('submitted_by', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id),
    ])

    setPosts(postsRes.data || [])
    setAccounts(accountsRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [user])

  // Calculate stats from posts
  const totalViews = posts.reduce((sum, post) => {
    const latest = post.analytics
      ?.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]
    return sum + (latest?.views || 0)
  }, 0)

  const totalLikes = posts.reduce((sum, post) => {
    const latest = post.analytics
      ?.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]
    return sum + (latest?.likes || 0)
  }, 0)

  const avgEngagement = posts.reduce((sum, post) => {
    const latest = post.analytics
      ?.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]
    return sum + (latest?.engagement_rate || 0)
  }, 0) / (posts.length || 1)

  // Build chart data from analytics
  const chartData = buildChartData(posts)

  if (loading) {
    return <div className="text-gray-400">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={() => setShowSubmit(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Submit Post
        </button>
      </div>

      <StatsGrid
        totalViews={totalViews}
        totalLikes={totalLikes}
        totalPosts={posts.length}
        avgEngagement={avgEngagement}
      />

      <ViewsChart data={chartData} />

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Your Posts</h2>
        <PostsTable posts={posts} />
      </div>

      {showSubmit && (
        <SubmitPostModal
          onClose={() => setShowSubmit(false)}
          onSubmitted={fetchData}
        />
      )}
    </div>
  )
}

function buildChartData(posts: Post[]) {
  const dailyViews: Record<string, number> = {}

  posts.forEach((post) => {
    post.analytics?.forEach((a) => {
      const date = a.fetched_at.split('T')[0]
      dailyViews[date] = (dailyViews[date] || 0) + a.views
    })
  })

  return Object.entries(dailyViews)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({ date, views }))
}
