import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { ViewsChart } from '@/components/dashboard/ViewsChart'
import { PostsTable } from '@/components/dashboard/PostsTable'
import { SubmitPostModal } from '@/components/dashboard/SubmitPostModal'
import { RefreshCw, Plus } from 'lucide-react'
import type { Post } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'https://music-distribution-production.up.railway.app'

export function AdminOverview() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)

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

  const totalBookmarks = posts.reduce((sum, post) => {
    const latest = post.analytics
      ?.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]
    return sum + (latest?.bookmarks || 0)
  }, 0)

  const activeCreators = new Set(posts.map((p) => p.submitted_by)).size

  const avgEngagement = posts.reduce((sum, post) => {
    const latest = post.analytics
      ?.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]
    return sum + (latest?.engagement_rate || 0)
  }, 0) / (posts.length || 1)

  const chartData = buildChartData(posts)
  const pendingPosts = posts.filter((p) => p.status === 'pending')

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) return <div className="text-gray-400">Loading...</div>

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Overview of all creators and content performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSubmit(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Submit Post
          </button>
          <button
            onClick={refreshAll}
            disabled={refreshingAll}
            className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshingAll ? 'animate-spin' : ''}`} />
            {refreshingAll ? 'Refreshing...' : 'Refresh All'}
          </button>
        </div>
      </div>

      <StatsGrid
        totalViews={totalViews}
        totalLikes={totalLikes}
        totalBookmarks={totalBookmarks}
        totalPosts={posts.length}
        activeCreators={activeCreators}
        avgEngagement={avgEngagement}
        isAdmin
      />

      <ViewsChart data={chartData} />

      {pendingPosts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Pending Review ({pendingPosts.length})
          </h2>
          <PostsTable posts={pendingPosts} onRefreshed={fetchPosts} />
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">All Posts</h2>
        <PostsTable posts={posts} onRefreshed={fetchPosts} />
      </div>

      {showSubmit && (
        <SubmitPostModal
          onClose={() => setShowSubmit(false)}
          onSubmitted={fetchPosts}
        />
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
