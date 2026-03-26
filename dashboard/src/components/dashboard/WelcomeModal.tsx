import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  onClose: () => void
}

export function WelcomeModal({ onClose }: Props) {
  const { user } = useAuth()
  const [paypalEmail, setPaypalEmail] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!user) return
    setSaving(true)
    if (paypalEmail.trim()) {
      await supabase
        .from('users')
        .update({ paypal_email: paypalEmail.trim() })
        .eq('id', user.id)
    }
    localStorage.setItem('luca_welcome_shown', 'true')
    setSaving(false)
    onClose()
  }

  function handleSkip() {
    localStorage.setItem('luca_welcome_shown', 'true')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-white text-center relative">
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold mb-1">Welcome to Luca</h2>
          <p className="text-white/80 text-sm">We're glad to have you on board</p>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* Explanation */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">How it works</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">1.</span>
                <span>Go to <strong>Generate Profile</strong> to get a name, bio and profile picture for your TikTok account.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">2.</span>
                <span>Go to <strong>Generate Post</strong> to create a TikTok with our templates and sounds.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">3.</span>
                <span>Post it on your TikTok account with the T-O-S and the caption provided.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">4.</span>
                <span>Come back here, click <strong>Submit Post</strong> and paste your TikTok URL, select the category you posted.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">5.</span>
                <span>Track your stats.</span>
              </li>
            </ul>
          </div>

          {/* PayPal email */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-900">
              PayPal email (for payments)
            </label>
            <input
              type="email"
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              placeholder="your@paypal.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-400">You can update this later in your profile.</p>
          </div>

          {/* Discord button */}
          <a
            href="https://discord.gg/KERJaVEa"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#5865F2] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#4752C4] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
            </svg>
            Join our Discord
          </a>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : "Let's go!"}
          </button>
        </div>
      </div>
    </div>
  )
}
