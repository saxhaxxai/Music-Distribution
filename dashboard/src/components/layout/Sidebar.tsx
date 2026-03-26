import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Send,
  Users,
  BarChart3,
  LogOut,
  Music,
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
    <aside className="w-64 h-screen bg-gray-950 text-white flex flex-col">
      <div className="p-6 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-lg">Luca</span>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <p className="text-sm text-gray-400 px-6 pt-3">
        {isAdmin ? 'Admin' : 'Creator'}
      </p>

      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to
          return (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="text-sm text-gray-400 mb-3 truncate">
          {profile?.full_name || profile?.email}
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
