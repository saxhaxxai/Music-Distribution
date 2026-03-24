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
    const longMatch = url.match(/video\/(\d+)/)
    if (longMatch?.[1]) return longMatch[1]
    // Short URL: vm.tiktok.com/ZNRxtxu1S/
    const shortMatch = url.match(/vm\.tiktok\.com\/([A-Za-z0-9]+)/)
    if (shortMatch?.[1]) return shortMatch[1]
    return null
  }
  if (platform === 'instagram') {
    const match = url.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/)
    return match?.[2] || null
  }
  return null
}

const POST_TYPES = [
  { value: 'italy_blue', label: 'Italy — Blue', category: 'italy', color: 'bg-blue-500' },
  { value: 'italy_green', label: 'Italy — Green', category: 'italy', color: 'bg-emerald-500' },
  { value: 'italy_orange', label: 'Italy — Orange', category: 'italy', color: 'bg-orange-500' },
  { value: 'italy_yellow', label: 'Italy — Yellow', category: 'italy', color: 'bg-yellow-400' },
  { value: 'party_bw', label: 'Party — Black & White', category: 'party', color: 'bg-gray-800' },
  { value: 'party_night', label: 'Party — Night Club', category: 'party', color: 'bg-purple-500' },
  { value: 'party_day', label: 'Party — Day Club', category: 'party', color: 'bg-amber-400' },
  { value: 'party_vhs', label: 'Party — VHS', category: 'party', color: 'bg-cyan-500' },
  { value: 'other', label: 'Other', category: 'other', color: 'bg-gray-400' },
]

interface Props {
  onClose: () => void
  onSubmitted: () => void
}

export function SubmitPostModal({ onClose, onSubmitted }: Props) {
  const { user } = useAuth()
  const [url, setUrl] = useState('')
  const [contentType, setContentType] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [newHandle, setNewHandle] = useState('')
  const [newPlatform, setNewPlatform] = useState<'tiktok' | 'instagram'>('tiktok')
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
      platform: newPlatform,
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
      setError('Please select or add an account first.')
      return
    }

    if (!contentType) {
      setError('Please select a post type.')
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
      content_type: contentType,
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
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
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
              Account
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
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value as 'tiktok' | 'instagram')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tiktok">TikTok</option>
                    <option value="instagram">Instagram</option>
                  </select>
                  <input
                    type="text"
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    placeholder={`@your_${newPlatform}_handle`}
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
                {accounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddAccount(false)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Post Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Post Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {POST_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setContentType(type.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-left text-sm transition-all ${
                    contentType === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${type.color}`} />
                  <span className="font-medium text-gray-700">{type.label}</span>
                </button>
              ))}
            </div>
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
            disabled={loading || !selectedAccount || !contentType}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Post'}
          </button>
        </form>
      </div>
    </div>
  )
}
