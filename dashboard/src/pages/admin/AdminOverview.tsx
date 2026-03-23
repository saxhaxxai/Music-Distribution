import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { ViewsChart } from '@/components/dashboard/ViewsChart'
import { PostsTable } from '@/components/dashboard/PostsTable'
import type { Post } from '@/types'

export function AdminOverview() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('posts')
        .select('*, analytics(*)')
        .order('created_at', { ascending: false })

      setPosts(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

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
      <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>

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
          <PostsTable posts={pendingPosts} />
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">All Posts</h2>
        <PostsTable posts={posts} />
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
