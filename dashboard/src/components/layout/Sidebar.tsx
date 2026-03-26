import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Send,
  Users,
  BarChart3,
  LogOut,
  Video,
  BookOpen,
  UserCircle,
  X,
} from 'lucide-react'

const creatorLinks = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/generate', label: 'Generate Post', icon: Video },
  { to: '/dashboard/submit', label: 'Submit Post', icon: Send },
  { to: '/dashboard/profile', label: 'Generate Profile', icon: UserCircle },
  { to: '/dashboard/guide', label: 'Guide', icon: BookOpen },
]

const adminLinks = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/generate', label: 'Generate Post', icon: Video },
  { to: '/admin/creators', label: 'Creators', icon: Users },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { profile, isAdmin, signOut } = useAuth()
  const location = useLocation()
  const links = isAdmin ? adminLinks : creatorLinks

  return (
    <aside className="w-64 h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-sm font-black">L</span>
          </div>
          <span className="font-bold text-lg tracking-tight">Luca</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-6 pb-4">
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
          {isAdmin ? 'Admin' : 'Creator'}
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {links.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to
          return (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 mx-3 mb-3 rounded-xl bg-white/5">
        <div className="text-sm font-medium text-white truncate">
          {profile?.full_name || 'Creator'}
        </div>
        <div className="text-xs text-gray-500 truncate mt-0.5">
          {profile?.email}
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mt-3"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
