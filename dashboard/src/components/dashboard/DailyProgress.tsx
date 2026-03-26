import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Clock } from 'lucide-react'
import type { Account, Post } from '@/types'

const POSTS_PER_DAY = 3
const MIN_HOURS_BETWEEN = 3

interface AccountProgress {
  account: Account
  todayPosts: Post[]
  nextPostAt: Date | null
}

export function DailyProgress() {
  const { user } = useAuth()
  const [progress, setProgress] = useState<AccountProgress[]>([])
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    if (!user) return
    fetchProgress()
  }, [user])

  // Update "now" every minute for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchProgress() {
    if (!user) return

    // Fetch user's accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)

    if (!accounts?.length) return

    // Today's date range (UTC)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Fetch today's posts for all accounts
    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .eq('submitted_by', user.id)
      .gte('created_at', todayStart.toISOString())

    const result: AccountProgress[] = accounts.map((account) => {
      const todayPosts = (posts || [])
        .filter((p) => p.account_id === account.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      let nextPostAt: Date | null = null
      if (todayPosts.length > 0 && todayPosts.length < POSTS_PER_DAY) {
        const lastPost = todayPosts[todayPosts.length - 1]
        const next = new Date(new Date(lastPost.created_at).getTime() + MIN_HOURS_BETWEEN * 60 * 60 * 1000)
        if (next > new Date()) {
          nextPostAt = next
        }
      }

      return { account, todayPosts, nextPostAt }
    })

    setProgress(result)
  }

  if (!progress.length) return null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Today's Progress</h2>
      {progress.map(({ account, todayPosts, nextPostAt }) => {
        const count = todayPosts.length
        const done = count >= POSTS_PER_DAY
        const pct = Math.min((count / POSTS_PER_DAY) * 100, 100)

        // Countdown
        let countdown = ''
        if (nextPostAt && nextPostAt > now) {
          const diff = nextPostAt.getTime() - now.getTime()
          const h = Math.floor(diff / 3_600_000)
          const m = Math.floor((diff % 3_600_000) / 60_000)
          countdown = h > 0 ? `${h}h ${m}m` : `${m}m`
        }

        return (
          <div key={account.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900">@{account.handle}</span>
                <span className="text-xs text-gray-400 ml-2">{account.platform}</span>
              </div>
              <span className={`text-sm font-semibold ${done ? 'text-green-600' : 'text-gray-600'}`}>
                {count}/{POSTS_PER_DAY}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  done ? 'bg-green-500' : 'bg-blue-600'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Steps */}
            <div className="flex justify-between">
              {Array.from({ length: POSTS_PER_DAY }).map((_, i) => {
                const posted = i < count
                const post = todayPosts[i]
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      posted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {posted ? '✓' : i + 1}
                    </div>
                    {posted && post && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Countdown */}
            {!done && countdown && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                <Clock className="w-3.5 h-3.5" />
                <span>Next post available in <strong>{countdown}</strong></span>
              </div>
            )}

            {!done && !countdown && count < POSTS_PER_DAY && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                <Clock className="w-3.5 h-3.5" />
                <span>Ready to post!</span>
              </div>
            )}

            {done && (
              <div className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 text-center font-medium">
                All done for today!
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
