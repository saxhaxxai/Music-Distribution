import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { X, Plus } from 'lucide-react'
import type { Account } from '@/types'

function detectPlatform(url: string): string | null {
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  return null
}

function extractPostId(url: string, platform: string): string | null {
  if (platform === 'tiktok') {
    const match = url.match(/video\/(\d+)/)
    return match?.[1] || null
  }
  if (platform === 'instagram') {
    const match = url.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/)
    return match?.[2] || null
  }
  return null
}

interface Props {
  onClose: () => void
  onSubmitted: () => void
}

export function SubmitPostModal({ onClose, onSubmitted }: Props) {
  const { user } = useAuth()
  const [url, setUrl] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [newHandle, setNewHandle] = useState('')
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAccounts(data)
          setSelectedAccount(data[0].id)
        } else {
          setShowAddAccount(true)
        }
      })
  }, [user])

  async function handleAddAccount() {
    if (!newHandle || !user) return
    const handle = newHandle.startsWith('@') ? newHandle : `@${newHandle}`

    const { data, error: err } = await supabase.from('accounts').insert({
      user_id: user.id,
      platform: 'tiktok',
      handle,
    }).select().single()

    if (err) {
      setError(err.message)
      return
    }

    setAccounts([...accounts, data])
    setSelectedAccount(data.id)
    setShowAddAccount(false)
    setNewHandle('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!selectedAccount) {
      setError('Please select or add a TikTok account first.')
      return
    }

    const platform = detectPlatform(url)
    if (!platform) {
      setError('URL not supported. Use a TikTok or Instagram link.')
      return
    }

    const platformPostId = extractPostId(url, platform)
    if (!platformPostId) {
      setError("Could not extract post ID from URL.")
      return
    }

    setLoading(true)
    const { error: dbError } = await supabase.from('posts').insert({
      url,
      platform,
      platform_post_id: platformPostId,
      account_id: selectedAccount,
      submitted_by: user?.id,
      status: 'pending',
      published_at: new Date().toISOString(),
    })

    setLoading(false)
    if (dbError) {
      setError(dbError.message)
      return
    }

    onSubmitted()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Submit a Post</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              TikTok Account
            </label>
            {accounts.length > 0 && !showAddAccount ? (
              <div className="space-y-2">
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.handle} ({acc.platform})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddAccount(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  Add another account
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  placeholder="@your_tiktok_handle"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddAccount}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Post URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Post URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@user/video/123..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {url && detectPlatform(url) && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              {detectPlatform(url)} detected
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !selectedAccount}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Post'}
          </button>
        </form>
      </div>
    </div>
  )
}
