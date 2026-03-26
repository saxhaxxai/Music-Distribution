import { useState } from 'react'
import { RefreshCw, Copy, Check, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const NAMES = [
  'Loop Theory House', 'Drop Syndicate', 'Pulse Culture Lab', 'Beat Ritual Club',
  'Frequency Addiction', 'Bassline Society', 'Waveform District', 'Sonic Loop Agency',
  'Groove Injection', 'Club Signal Factory', 'Hidden Groove Unit', 'Subtone Society',
  'Night Circuit Collective', 'Lowlight Frequencies', 'Basement Signal Club',
  'Afterhour Protocol', 'Deepwave Syndicate', 'Noir Pulse System', 'Static Groove Archive',
  'Riviera Frequenza', 'Milano Sunset Society', 'Portofino Pulse Club',
  'Amalfi Groove Archive', 'Dolce Vita Frequencies', 'Capri Night Collective',
  'Roma Afterhour System', 'Italian Velvet Grooves', 'Riviera Signal Syndicate',
  'Tuscan Wave Archive', 'Frequenza Notturna', 'Subtone Milano', 'Italian Night Circuit',
  'Deepwave Italia', 'Afterhour Riviera Unit', 'Noir Frequenza Club', 'Roma Signal Archive',
  'Milano Pulse System', 'Casa Groove Collective', 'Notte Wave Syndicate',
]

const BIOS = [
  'italian house only 🇮🇹', 'dolce vita sounds', 'riviera house club',
  'milano night grooves', 'amalfi house energy', 'mediterranean house vibes',
  'italian summer grooves', 'sunset in capri', 'amalfi night vibes',
  'golden hour italia', 'summer house italia', 'riviera sunset grooves',
  'italian beach house', 'coastal house vibes', 'dolce summer sounds',
  'summer house italia', 'riviera beach house', 'italian golden grooves',
  'sunset house club', 'coastal night grooves', 'mediterranean night house',
  'summer night house', 'italian ocean vibes', 'golden house italia',
  'beach house nights',
]

const TOTAL_PICS = 22

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function GenerateProfile() {
  const navigate = useNavigate()
  const [name, setName] = useState(() => randomFrom(NAMES))
  const [bio, setBio] = useState(() => randomFrom(BIOS))
  const [picIndex, setPicIndex] = useState(() => Math.floor(Math.random() * TOTAL_PICS) + 1)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  function regenerate() {
    setName(randomFrom(NAMES))
    setBio(randomFrom(BIOS))
    setPicIndex(Math.floor(Math.random() * TOTAL_PICS) + 1)
  }

  function copyText(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  const picUrl = `/profile-pics/profile_${String(picIndex).padStart(2, '0')}.jpeg`

  return (
    <div className="max-w-md mx-auto space-y-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Generate Profile</h1>
        <p className="text-gray-500 text-sm">Get a name, bio and profile picture for your TikTok account.</p>
        <p className="text-xs text-amber-600 mt-1">If the name is already taken, hit generate again or add a few letters/numbers to make it unique :)</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Profile picture */}
        <div className="flex justify-center pt-8 pb-4">
          <div className="relative group">
            <img
              src={picUrl}
              alt="Profile"
              className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
            />
            <button
              onClick={() => {
                const a = document.createElement('a')
                a.href = picUrl
                a.download = `profile_pic.jpeg`
                a.click()
              }}
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium"
            >
              Download
            </button>
          </div>
        </div>

        {/* Name */}
        <div className="px-6 pb-3">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Name</label>
          <div className="flex items-center justify-between mt-1">
            <span className="text-lg font-semibold text-gray-900">{name}</span>
            <button
              onClick={() => copyText(name, 'name')}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              {copiedField === 'name' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Bio */}
        <div className="px-6 pb-6">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Bio</label>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm text-gray-600">{bio}</span>
            <button
              onClick={() => copyText(bio, 'bio')}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              {copiedField === 'bio' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={regenerate}
        className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Generate another
      </button>
    </div>
  )
}
