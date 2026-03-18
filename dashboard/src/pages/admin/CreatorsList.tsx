import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ExternalLink } from 'lucide-react'

interface CreatorWithStats {
  id: string
  full_name: string | null
  email: string
  accounts: { handle: string; platform: string }[]
  post_count: number
  total_views: number
}

export function CreatorsList() {
  const [creators, setCreators] = useState<CreatorWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      // Get all UGC creators with their accounts
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'ugc_creator')

      if (!users) { setLoading(false); return }

      // For each creator, get their stats
      const creatorsWithStats: CreatorWithStats[] = await Promise.all(
        users.map(async (user) => {
          const [accountsRes, postsRes] = await Promise.all([
            supabase.from('accounts').select('handle, platform').eq('user_id', user.id),
            supabase.from('posts').select('id, analytics(views)').eq('submitted_by', user.id),
          ])

          const posts = postsRes.data || []
          const totalViews = posts.reduce((sum, p) => {
            const maxViews = Math.max(...(p.analytics?.map((a: { views: number }) => a.views) || [0]))
            return sum + maxViews
          }, 0)

          return {
            ...user,
            accounts: accountsRes.data || [],
            post_count: posts.length,
            total_views: totalViews,
          }
        })
      )

      setCreators(creatorsWithStats.sort((a, b) => b.total_views - a.total_views))
      setLoading(false)
    }
    fetch()
  }, [])

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
  }

  if (loading) return <div className="text-gray-400">Loading...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Creators</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
              <th className="px-6 py-3 font-medium">Creator</th>
              <th className="px-6 py-3 font-medium">Accounts</th>
              <th className="px-6 py-3 font-medium">Posts</th>
              <th className="px-6 py-3 font-medium">Total Views</th>
            </tr>
          </thead>
          <tbody>
            {creators.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{c.full_name || 'No name'}</div>
                  <div className="text-xs text-gray-500">{c.email}</div>
                </td>
                <td className="px-6 py-4">
                  {c.accounts.map((a, i) => (
                    <a
                      key={i}
                      href={`https://www.tiktok.com/${a.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      {a.handle} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </td>
                <td className="px-6 py-4 text-sm font-medium">{c.post_count}</td>
                <td className="px-6 py-4 text-sm font-medium">{formatNumber(c.total_views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
