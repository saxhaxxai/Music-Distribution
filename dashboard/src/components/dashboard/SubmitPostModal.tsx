import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { X } from 'lucide-react'

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
  accountId: string
  onClose: () => void
  onSubmitted: () => void
}

export function SubmitPostModal({ accountId, onClose, onSubmitted }: Props) {
  const { user } = useAuth()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

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
      account_id: accountId,
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

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Post'}
          </button>
        </form>
      </div>
    </div>
  )
}
