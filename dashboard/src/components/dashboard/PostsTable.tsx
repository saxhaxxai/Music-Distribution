import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Post } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'https://music-distribution-production.up.railway.app'

interface Props {
  posts: Post[]
  onRefreshed?: () => void
}

function getLatestAnalytics(post: Post) {
  if (!post.analytics?.length) return null
  return post.analytics.sort(
    (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
  )[0]
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export function PostsTable({ posts, onRefreshed }: Props) {
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function refreshPost(post: Post) {
    setRefreshing(post.id)
    setErrors(e => ({ ...e, [post.id]: '' }))
    try {
      const res = await fetch(`${API_URL}/fetch-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: post.url }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Failed')
      }
      const stats = await res.json()
      const { error: insertError } = await supabase.from('analytics').insert({
        post_id: post.id,
        views: stats.views,
        likes: stats.likes,
        comments: stats.comments,
        shares: stats.shares,
        bookmarks: stats.bookmarks,
        engagement_rate: stats.engagement_rate,
        source: 'yt-dlp',
      })
      if (insertError) throw new Error(`DB error: ${insertError.message}`)
      if (stats.views >= 100 && post.status === 'pending') {
        const { error: updateError } = await supabase.from('posts').update({ status: 'approved' }).eq('id', post.id)
        if (updateError) throw new Error(`Status update failed: ${updateError.message}`)
      }
      onRefreshed?.()
    } catch (e: unknown) {
      setErrors(prev => ({ ...prev, [post.id]: (e as Error).message }))
    } finally {
      setRefreshing(null)
    }
  }

  if (!posts.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        No posts yet. Submit your first post!
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
              <th className="px-4 py-3 font-medium sm:px-6">Post</th>
              <th className="px-4 py-3 font-medium sm:px-6">Type</th>
              <th className="px-4 py-3 font-medium sm:px-6">Status</th>
              <th className="px-4 py-3 font-medium sm:px-6">Views</th>
              <th className="px-4 py-3 font-medium sm:px-6">Likes</th>
              <th className="px-4 py-3 font-medium sm:px-6">Saves</th>
              <th className="hidden sm:table-cell px-6 py-3 font-medium">Engagement</th>
              <th className="hidden sm:table-cell px-6 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium sm:px-6"></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => {
              const stats = getLatestAnalytics(post)
              const isRefreshing = refreshing === post.id
              const error = errors[post.id]
              return (
                <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[80px] sm:max-w-none">
                        {post.url.split('/').pop()?.slice(0, 14) || post.url.slice(0, 14)}...
                      </span>
                    </a>
                    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                      {(post as unknown as { content_type?: string }).content_type || 'other'}
                    </span>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[post.status]}`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4 text-sm font-medium">
                    {stats ? formatNumber(stats.views) : '—'}
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4 text-sm">
                    {stats ? formatNumber(stats.likes) : '—'}
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4 text-sm">
                    {stats ? formatNumber(stats.bookmarks) : '—'}
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-sm">
                    {stats ? `${stats.engagement_rate.toFixed(1)}%` : '—'}
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-500">
                    {new Date(post.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <button
                      onClick={() => refreshPost(post)}
                      disabled={isRefreshing}
                      title="Refresh analytics"
                      className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-40"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
