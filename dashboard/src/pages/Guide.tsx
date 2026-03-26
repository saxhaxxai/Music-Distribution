import { BookOpen, Video, Copy, Send, Clock, MessageCircle, ArrowLeft, UserCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function Guide() {
  const navigate = useNavigate()

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-2">
          <BookOpen className="w-7 h-7 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Creator Guide</h1>
        <p className="text-gray-500">Everything you need to know to get started.</p>
      </div>

      {/* Step 1 - Generate Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">1</div>
          <h2 className="text-lg font-semibold text-gray-900">Generate your profile</h2>
        </div>
        <div className="ml-11 space-y-2 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <UserCircle className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
            <p>Go to <strong>Generate Profile</strong> in the sidebar. Get a name, bio and profile picture for your TikTok account. If the name is already taken, generate another one or add a few letters to make it unique.</p>
          </div>
        </div>
      </div>

      {/* Step 2 - Generate Post */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">2</div>
          <h2 className="text-lg font-semibold text-gray-900">Generate your post</h2>
        </div>
        <div className="ml-11 space-y-2 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <Video className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
            <p>Go to <strong>Generate Post</strong> in the sidebar. Choose your category, subcategory, and a sound. Click generate and wait for your TikTok to be created.</p>
          </div>
        </div>
      </div>

      {/* Step 3 - Post */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">3</div>
          <h2 className="text-lg font-semibold text-gray-900">Post on TikTok</h2>
        </div>
        <div className="ml-11 space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <Copy className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Copy the T-O-S</p>
              <p>Put the T-O-S (Text-On-Screen) directly on the video as text overlay when posting on TikTok. This is mandatory.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Copy className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Paste the Caption</p>
              <p>Copy the full caption (with hashtags) and paste it as the TikTok description. This is mandatory — do not modify it.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3 - Posting schedule */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white text-sm font-bold">!</div>
          <h2 className="text-lg font-semibold text-gray-900">Posting schedule — Important</h2>
        </div>
        <div className="ml-11 space-y-2 text-sm text-gray-700">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Post 3 times per day, with 3 to 4 hours between each post.</p>
              <p className="mt-1 text-amber-700 font-medium">This is mandatory. Posts that do not follow this schedule will not be taken into account.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 4 - Submit */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">4</div>
          <h2 className="text-lg font-semibold text-gray-900">Submit your post</h2>
        </div>
        <div className="ml-11 space-y-2 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <Send className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
            <p>After posting, go to <strong>Submit Post</strong>, paste the TikTok URL, select the account and the category you posted, and submit. We'll track your stats automatically.</p>
          </div>
        </div>
      </div>

      {/* Discord */}
      <div className="bg-[#5865F2]/10 rounded-xl border border-[#5865F2]/20 p-6 text-center space-y-3">
        <MessageCircle className="w-8 h-8 text-[#5865F2] mx-auto" />
        <h2 className="text-lg font-semibold text-gray-900">Got questions?</h2>
        <p className="text-sm text-gray-600">Join our Discord to ask questions, get help, and connect with other creators.</p>
        <a
          href="https://discord.gg/KERJaVEa"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#5865F2] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#4752C4] transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
          </svg>
          Join Discord
        </a>
      </div>
    </div>
  )
}
