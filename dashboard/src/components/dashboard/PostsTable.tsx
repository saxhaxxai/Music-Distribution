import type { Post } from '@/types'
import { ExternalLink } from 'lucide-react'

interface Props {
  posts: Post[]
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

export function PostsTable({ posts }: Props) {
  if (!posts.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        No posts yet. Submit your first post!
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
            <th className="px-6 py-3 font-medium">Post</th>
            <th className="px-6 py-3 font-medium">Platform</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Views</th>
            <th className="px-6 py-3 font-medium">Likes</th>
            <th className="px-6 py-3 font-medium">Engagement</th>
            <th className="px-6 py-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const stats = getLatestAnalytics(post)
            return (
              <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-6 py-4">
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {post.platform_post_id?.slice(0, 12)}...
                  </a>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm capitalize">{post.platform}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[post.status]}`}>
                    {post.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium">
                  {stats ? formatNumber(stats.views) : '-'}
                </td>
                <td className="px-6 py-4 text-sm">
                  {stats ? formatNumber(stats.likes) : '-'}
                </td>
                <td className="px-6 py-4 text-sm">
                  {stats ? `${stats.engagement_rate.toFixed(1)}%` : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(post.created_at).toLocaleDateString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
