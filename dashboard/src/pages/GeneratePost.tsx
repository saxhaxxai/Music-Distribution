import { useState, useEffect } from 'react'
import { Download, Loader2, Play, RefreshCw, Sparkles, ChevronLeft, Music, Zap, Copy, Hash, Type } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'https://music-distribution-production.up.railway.app'

interface Track {
  filename: string
  name: string
  duration: number
  tempo: number
  drop_time: number
  clip_start: number
  clip_end: number
  error?: string
}

const CATEGORIES = [
  {
    value: 'italy',
    label: 'Italy',
    description: 'Dolce Vita, Capri, Napoli',
    image: 'https://images.unsplash.com/photo-1515859005217-8a1f08870f59?w=400&h=250&fit=crop',
    subcategories: [
      { value: 'bleu', label: 'Blue', gradient: 'from-sky-400 via-blue-500 to-indigo-600', description: 'Sea, Capri, Navy outfits, Vespa', icon: '\u{1F30A}', disabled: false },
      { value: 'vert', label: 'Green', gradient: 'from-lime-400 via-emerald-500 to-teal-600', description: 'Gardens, Lemon trees, Terraces', icon: '\u{1F33F}', disabled: false },
      { value: 'orange', label: 'Orange', gradient: 'from-amber-400 via-orange-500 to-red-500', description: 'Sunset, Aperol, Golden hour', icon: '\u{1F305}', disabled: false },
      { value: 'jaune', label: 'Yellow', gradient: 'from-yellow-300 via-amber-400 to-orange-400', description: 'Lemons, Positano, Limoncello', icon: '\u{1F34B}', disabled: false },
    ],
  },
  {
    value: 'party',
    label: 'Party',
    description: 'Club, Night, House Music',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=250&fit=crop',
    subcategories: [
      { value: 'black_white', label: 'Black & White', gradient: 'from-gray-600 via-gray-800 to-black', description: 'Club, DJ sets, Crowd, Night', icon: '\u{1F5A4}', disabled: false },
      { value: 'night_club', label: 'Night Club', gradient: 'from-purple-500 via-pink-500 to-red-500', description: 'Neon, Lasers, Dark, Rave', icon: '\u{1F303}', disabled: false },
      { value: 'day_club', label: 'Day Club', gradient: 'from-amber-400 via-orange-400 to-pink-500', description: 'Pool party, Rooftop, Ibiza', icon: '\u{2600}\u{FE0F}', disabled: false },
      { value: 'vhs', label: 'VHS', gradient: 'from-cyan-400 via-blue-500 to-purple-600', description: 'Retro, Glitch, Analog', icon: '\u{1F4FC}', disabled: false },
    ],
  },
  {
    value: 'rio',
    label: 'RIO',
    description: 'Brazil, Beach, Carnival',
    image: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=400&h=250&fit=crop',
    disabled: true,
  },
  {
    value: 'la',
    label: 'LA',
    description: 'Hollywood, Sunset, Palm Trees',
    image: 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=400&h=250&fit=crop',
    disabled: true,
  },
]

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function GeneratePost() {
  const [category, setCategory] = useState<string | null>(null)
  const [subcategory, setSubcategory] = useState<string | null>(null)
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [tracksLoading, setTracksLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [caption, setCaption] = useState<string | null>(null)
  const [hashtags, setHashtags] = useState<string | null>(null)
  const [captionLoading, setCaptionLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!subcategory) return
    setTracksLoading(true)
    fetch(`${API_URL}/tracks`)
      .then(r => r.json())
      .then((data: Track[]) => {
        setTracks(data.filter(t => !t.error))
        if (data.length > 0 && !data[0].error) {
          setSelectedTrack(data[0].filename)
        }
      })
      .catch(() => setTracks([]))
      .finally(() => setTracksLoading(false))
  }, [subcategory])

  async function handleGenerate() {
    if (!category || !subcategory || !selectedTrack) return
    setLoading(true)
    setError(null)
    setVideoUrl(null)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout
      const res = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, color: subcategory, track: selectedTrack }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Generation failed')
      }
      const blob = await res.blob()
      setVideoUrl(URL.createObjectURL(blob))

      // Auto-generate caption after video
      generateCaption()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function generateCaption() {
    if (!category || !subcategory) return
    setCaptionLoading(true)
    try {
      const trackName = tracks.find(t => t.filename === selectedTrack)?.name || ''
      const res = await fetch(`${API_URL}/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, color: subcategory, track_name: trackName }),
      })
      if (res.ok) {
        const data = await res.json()
        setCaption(data.caption)
        setHashtags(data.hashtags)
      }
    } catch { /* silent */ }
    finally { setCaptionLoading(false) }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleDownload() {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `tiktok_${category}_${subcategory}_${Date.now()}.mp4`
    a.click()
  }

  const selectedCat = CATEGORIES.find(c => c.value === category)
  const selectedSub = subcategory && selectedCat?.subcategories?.find(s => s.value === subcategory)
  const selectedTrackInfo = tracks.find(t => t.filename === selectedTrack)

  // Back button handler
  function goBack() {
    if (videoUrl) {
      setVideoUrl(null)
    } else if (selectedTrack && subcategory) {
      setSelectedTrack(null)
      setSubcategory(null)
    } else if (subcategory) {
      setSubcategory(null)
      setSelectedTrack(null)
    } else if (category) {
      setCategory(null)
    }
    setError(null)
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Generate Post</h1>
            <p className="text-sm text-gray-500">Create TikTok videos automatically</p>
          </div>
        </div>
      </div>

      {/* Steps indicator */}
      {category && (
        <div className="flex items-center gap-2 mb-6">
          {['Category', 'Music', 'Generate'].map((label, i) => {
            const currentStep = !subcategory ? 1 : !videoUrl && !loading ? 2 : 3
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i + 1 < currentStep ? 'bg-blue-600 text-white'
                  : i + 1 === currentStep ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                  : 'bg-gray-100 text-gray-400'
                }`}>
                  {i + 1 < currentStep ? '\u2713' : i + 1}
                </div>
                <span className={`text-xs font-medium ${i + 1 <= currentStep ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
                {i < 2 && <div className={`w-8 h-px ${i + 1 < currentStep ? 'bg-blue-400' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>
      )}

      {/* Back button */}
      {category && !loading && (
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      )}

      {/* Step 1: Category */}
      {!category && (
        <div className="grid grid-cols-2 gap-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => !cat.disabled && setCategory(cat.value)}
              disabled={cat.disabled}
              className={`group relative overflow-hidden rounded-2xl text-left transition-all duration-200 ${
                cat.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              <div className="aspect-[16/9] relative">
                <img src={cat.image} alt={cat.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-5">
                  <h3 className="text-xl font-bold text-white mb-1">{cat.label}</h3>
                  <p className="text-sm text-white/70">{cat.description}</p>
                </div>
                {cat.disabled && (
                  <div className="absolute top-3 right-3 bg-black/50 text-white/80 text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
                    Coming soon
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Subcategory (only for categories that have them) */}
      {category && !subcategory && selectedCat?.subcategories && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Choose a vibe</h2>
          <p className="text-sm text-gray-500 mb-5">Each color creates a different mood for your TikTok</p>
          <div className="grid grid-cols-2 gap-4">
            {selectedCat.subcategories.map((sub) => (
              <button
                key={sub.value}
                onClick={() => !sub.disabled && setSubcategory(sub.value)}
                disabled={sub.disabled}
                className={`group relative overflow-hidden rounded-2xl transition-all duration-200 ${
                  sub.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                <div className={`aspect-[4/3] bg-gradient-to-br ${sub.gradient} p-6 flex flex-col justify-between`}>
                  <div className="text-4xl">{sub.icon}</div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">{sub.label}</h3>
                    <p className="text-sm text-white/70">{sub.description}</p>
                  </div>
                  {sub.disabled ? (
                    <div className="absolute top-4 right-4 bg-black/30 text-white/70 text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
                      Coming soon
                    </div>
                  ) : (
                    <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/0 group-hover:bg-white/20 flex items-center justify-center transition-all">
                      <Play className="w-5 h-5 text-white/0 group-hover:text-white/90 transition-all" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Music + Generate */}
      {category && subcategory && !videoUrl && !loading && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <Music className="w-4 h-4" />
              Select a track
            </h2>

            {tracksLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing tracks...
              </div>
            ) : (
              <div className="space-y-2">
                {tracks.map((track) => (
                  <button
                    key={track.filename}
                    onClick={() => setSelectedTrack(track.filename)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      selectedTrack === track.filename
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      selectedTrack === track.filename ? 'bg-blue-600' : 'bg-gray-100'
                    }`}>
                      <Music className={`w-5 h-5 ${selectedTrack === track.filename ? 'text-white' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{track.name}</div>
                      <div className="text-xs text-gray-500">{formatTime(track.duration)}</div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="text-center">
                        <div className="font-bold text-gray-700">{track.tempo}</div>
                        <div>BPM</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-gray-700 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          {formatTime(track.drop_time)}
                        </div>
                        <div>Drop</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-gray-700">{formatTime(track.clip_start)}-{formatTime(track.clip_end)}</div>
                        <div>Clip window</div>
                      </div>
                    </div>
                  </button>
                ))}

                {tracks.length === 0 && (
                  <div className="text-center py-8 text-sm text-gray-400">
                    No tracks found. Add .wav or .mp3 files to tiktok-engine/assets/
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedTrack && (
            <div className="flex flex-col items-center pt-4">
              <button
                onClick={handleGenerate}
                className={`flex items-center gap-3 bg-gradient-to-r ${selectedSub ? selectedSub.gradient : 'from-blue-500 to-blue-700'} text-white px-8 py-4 rounded-2xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`}
              >
                <Sparkles className="w-5 h-5" />
                Generate TikTok
              </button>
              <p className="text-xs text-gray-400 mt-3">
                Cuts will auto-sync to the drop at {selectedTrackInfo && formatTime(selectedTrackInfo.drop_time)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative mb-6">
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${selectedSub ? selectedSub.gradient : 'from-blue-400 to-blue-600'} opacity-20 animate-ping absolute inset-0`} />
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${selectedSub ? selectedSub.gradient : 'from-blue-400 to-blue-600'} flex items-center justify-center relative`}>
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Generating your TikTok...</h2>
          <p className="text-sm text-gray-500">Analyzing audio, syncing cuts to drop, exporting</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-600 flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-red-500 text-xs font-bold">!</span>
          </div>
          <div>
            <p className="font-medium mb-1">Generation failed</p>
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      )}

      {/* Preview + Download + Caption */}
      {videoUrl && (
        <div className="space-y-6">
          {/* Video */}
          <div className="bg-gray-950 rounded-2xl overflow-hidden shadow-2xl">
            <video src={videoUrl} controls autoPlay className="w-full max-h-[500px] mx-auto" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              Download MP4
            </button>
            <button
              onClick={() => { setVideoUrl(null); setCaption(null); setHashtags(null); handleGenerate() }}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
          </div>

          {/* Caption & Hashtags */}
          <div className="grid grid-cols-2 gap-4">
            {/* Caption */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Type className="w-4 h-4 text-violet-500" />
                  Caption
                </div>
                {caption && (
                  <button
                    onClick={() => copyToClipboard(caption, 'caption')}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied === 'caption' ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
              {captionLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating caption...
                </div>
              ) : caption ? (
                <div>
                  <p className="text-lg font-semibold text-gray-900">{caption}</p>
                  <button
                    onClick={generateCaption}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mt-3 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    New caption
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateCaption}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Generate caption
                </button>
              )}
            </div>

            {/* Hashtags */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Hash className="w-4 h-4 text-blue-500" />
                  Hashtags
                </div>
                {hashtags && (
                  <button
                    onClick={() => copyToClipboard(hashtags, 'hashtags')}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied === 'hashtags' ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
              {captionLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating hashtags...
                </div>
              ) : hashtags ? (
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    {hashtags.split(' ').filter(Boolean).map((tag, i) => (
                      <span key={i} className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={generateCaption}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mt-3 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    New hashtags
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateCaption}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Generate hashtags
                </button>
              )}
            </div>
          </div>

          {/* Full post text (ready to paste) */}
          {caption && hashtags && (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">Ready to paste</span>
                <button
                  onClick={() => copyToClipboard(`${caption}\n\n${hashtags}`, 'full')}
                  className="flex items-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied === 'full' ? 'Copied!' : 'Copy all'}
                </button>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line">{caption}{'\n\n'}{hashtags}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
