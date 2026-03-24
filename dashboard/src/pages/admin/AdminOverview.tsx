import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { ViewsChart } from '@/components/dashboard/ViewsChart'
import { PostsTable } from '@/components/dashboard/PostsTable'
import { RefreshCw } from 'lucide-react'
import type { Post } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'https://music-distribution-production.up.railway.app'

export function AdminOverview() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingAll, setRefreshingAll] = useState(false)

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, analytics(*)')
      .order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  async function refreshAll() {
    setRefreshingAll(true)
    for (const post of posts) {
      try {
        const res = await fetch(`${API_URL}/fetch-stats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: post.url }),
        })
        if (!res.ok) continue
        const stats = await res.json()
        await supabase.from('analytics').insert({
          post_id: post.id,
          views: stats.views,
          likes: stats.likes,
          comments: stats.comments,
          shares: stats.shares,
          bookmarks: stats.bookmarks,
          engagement_rate: stats.engagement_rate,
          source: 'yt-dlp',
        })
        if (stats.views >= 100 && post.status === 'pending') {
          await supabase.from('posts').update({ status: 'approved' }).eq('id', post.id)
        }
      } catch { /* skip failed posts */ }
    }
    await fetchPosts()
    setRefreshingAll(false)
  }

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

  const activeCreators = new Set(posts.map((p) => p.submitted_by)).size

  const avgEngagement = posts.reduce((sum, post) => {
    const latest = post.analytics
      ?.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]
    return sum + (latest?.engagement_rate || 0)
  }, 0) / (posts.length || 1)

  const chartData = buildChartData(posts)
  const pendingPosts = posts.filter((p) => p.status === 'pending')

  if (loading) return <div className="text-gray-400">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <button
          onClick={refreshAll}
          disabled={refreshingAll}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshingAll ? 'animate-spin' : ''}`} />
          {refreshingAll ? 'Refreshing...' : 'Refresh All Stats'}
        </button>
      </div>

      <StatsGrid
        totalViews={totalViews}
        totalLikes={totalLikes}
        totalPosts={posts.length}
        activeCreators={activeCreators}
        avgEngagement={avgEngagement}
        isAdmin
      />

      <ViewsChart data={chartData} />

      {pendingPosts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Pending Review ({pendingPosts.length})
          </h2>
          <PostsTable posts={pendingPosts} onRefreshed={fetchPosts} isAdmin />
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">All Posts</h2>
        <PostsTable posts={posts} onRefreshed={fetchPosts} isAdmin />
      </div>
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
