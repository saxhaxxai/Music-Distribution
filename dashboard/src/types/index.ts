export interface User {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'ugc_creator'
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  platform: 'tiktok' | 'instagram'
  handle: string
  display_name: string | null
  follower_count: number
  created_at: string
}

export interface Post {
  id: string
  url: string
  platform: 'tiktok' | 'instagram'
  platform_post_id: string | null
  account_id: string
  submitted_by: string
  status: 'pending' | 'approved' | 'rejected'
  published_at: string | null
  created_at: string
  analytics?: Analytics[]
}

export interface Analytics {
  id: string
  post_id: string
  views: number
  likes: number
  comments: number
  shares: number
  bookmarks: number
  engagement_rate: number
  fetched_at: string
}

export interface DateRange {
  start: string
  end: string
}
