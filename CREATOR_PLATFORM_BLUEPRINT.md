# Creator Platform Blueprint

Guide complet pour créer une plateforme de gestion de créateurs UGC avec tracking TikTok, dashboard admin, et générateur de contenu.

---

## Table des matières

1. [Architecture générale](#1-architecture-générale)
2. [Stack technique](#2-stack-technique)
3. [Base de données (Supabase)](#3-base-de-données-supabase)
4. [Système d'authentification & rôles](#4-système-dauthentification--rôles)
5. [Dashboard Créateur UGC](#5-dashboard-créateur-ugc)
6. [Connexion compte TikTok](#6-connexion-compte-tiktok)
7. [Soumission & tracking des posts](#7-soumission--tracking-des-posts)
8. [Système de scraping analytics](#8-système-de-scraping-analytics)
9. [Système CPM & paiements](#9-système-cpm--paiements)
10. [Dashboard Admin](#10-dashboard-admin)
11. [Générateur de Slideshow](#11-générateur-de-slideshow)
12. [Gamification](#12-gamification)
13. [Notifications (Email + Discord)](#13-notifications-email--discord)
14. [Déploiement](#14-déploiement)
15. [Structure des fichiers](#15-structure-des-fichiers)

---

## 1. Architecture générale

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Dashboard │  │ Dashboard │  │  Slideshow   │  │
│  │ Créateur  │  │   Admin   │  │  Generator   │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│       └──────────────┼───────────────┘           │
│                      │                           │
└──────────────────────┼───────────────────────────┘
                       │
              ┌────────▼────────┐
              │    Supabase     │
              │  (Auth + DB +   │
              │ Edge Functions) │
              └────────┬────────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
    ┌──────▼──┐ ┌──────▼──┐ ┌─────▼─────┐
    │  Apify  │ │ Discord │ │  Email    │
    │Scrapers │ │   Bot   │ │ (Resend)  │
    └─────────┘ └─────────┘ └───────────┘
```

**Flux principal :**
1. Créateur se connecte → lie son compte TikTok
2. Créateur soumet des posts (URL TikTok)
3. Le système scrape les stats automatiquement (toutes les 2 min)
4. Les analytics sont stockées en time-series
5. Le CPM est calculé à partir des views
6. L'admin voit tout dans son dashboard

---

## 2. Stack technique

| Outil | Usage |
|-------|-------|
| **React + TypeScript** | Frontend SPA |
| **Vite** | Build tool |
| **TailwindCSS** | Styling |
| **shadcn/ui** | Composants UI |
| **Supabase** | Auth, Database (PostgreSQL), Edge Functions, Storage |
| **Apify** | Scraping TikTok/Instagram stats |
| **Resend** | Emails transactionnels |
| **Discord.js** | Bot notifications |
| **Recharts** | Graphiques/charts |

### Installation initiale

```bash
# Créer le projet
npm create vite@latest creator-platform -- --template react-ts
cd creator-platform

# Dépendances principales
npm install @supabase/supabase-js react-router-dom
npm install @tanstack/react-query  # Data fetching/caching
npm install recharts               # Charts
npm install date-fns               # Date manipulation
npm install lucide-react            # Icons

# UI (shadcn)
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog tabs table badge input select
```

---

## 3. Base de données (Supabase)

### Tables principales

#### `users` — Utilisateurs de la plateforme

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'ugc_creator',
    -- Rôles: 'admin', 'ugc_creator', 'account_manager'
  application_status TEXT DEFAULT 'pending',
    -- Status: 'pending', 'approved', 'rejected'
  contract_option TEXT,
    -- Ex: 'retainer_cpm', 'fixed_monthly'
  discord_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- Soft delete
);
```

#### `accounts` — Comptes TikTok/Instagram liés

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'tiktok', 'instagram', 'youtube'
  handle TEXT NOT NULL,   -- @username
  display_name TEXT,
  follower_count INT DEFAULT 0,
  avatar_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(platform, handle)
);
```

#### `posts` — Posts soumis par les créateurs

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  platform TEXT NOT NULL,        -- 'tiktok', 'instagram', 'youtube'
  platform_post_id TEXT,         -- ID extrait de l'URL
  account_id UUID REFERENCES accounts(id),
  submitted_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  content_type TEXT DEFAULT 'ugc_video', -- 'ugc_video', 'slideshow'
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `analytics` — Snapshots time-series des stats

```sql
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  bookmarks INT DEFAULT 0,
  engagement_rate DECIMAL(5,2),
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'apify' -- D'où vient la donnée
);

-- Index pour requêtes rapides
CREATE INDEX idx_analytics_post_id ON analytics(post_id);
CREATE INDEX idx_analytics_fetched_at ON analytics(fetched_at);
```

#### `cpm_payments` — Paiements mensuels agrégés

```sql
CREATE TABLE cpm_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  month DATE NOT NULL,           -- Premier jour du mois
  total_views INT DEFAULT 0,
  total_posts INT DEFAULT 0,
  total_cpm DECIMAL(10,2) DEFAULT 0,
  fixed_fee DECIMAL(10,2) DEFAULT 0,
  total_payout DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'paid'
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, month)
);
```

#### `cpm_post_breakdown` — Tracking CPM par post/jour

```sql
CREATE TABLE cpm_post_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id),
  user_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  views_start INT DEFAULT 0,
  views_end INT DEFAULT 0,
  views_delta INT DEFAULT 0,   -- Vues gagnées ce jour
  cpm_earned DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `analytics_jobs` — File d'attente du scraping

```sql
CREATE TABLE analytics_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_ids UUID[] NOT NULL,
  batch_number INT,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `failed_posts_queue` — Retry pour posts échoués

```sql
CREATE TABLE failed_posts_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id),
  failure_reason TEXT,
  retry_count INT DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

```sql
-- Activer RLS sur toutes les tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Les créateurs ne voient que leurs propres données
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "posts_read_own" ON posts
  FOR SELECT USING (
    submitted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Les admins voient tout
CREATE POLICY "admin_full_access" ON posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## 4. Système d'authentification & rôles

### Context React pour les rôles

```typescript
// src/contexts/UserRoleContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UserRoleContextType {
  role: string | null;
  isAdmin: boolean;
  isUGCCreator: boolean;
  isAccountManager: boolean;
  loading: boolean;
}

const UserRoleContext = createContext<UserRoleContextType>({
  role: null, isAdmin: false, isUGCCreator: false,
  isAccountManager: false, loading: true,
});

export function UserRoleProvider({ children }) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);

      const { data } = await supabase
        .from('users')
        .select('role, application_status')
        .eq('id', user.id)
        .single();

      if (data?.application_status === 'approved') {
        setRole(data.role);
      }
      setLoading(false);
    }
    fetchRole();
  }, []);

  return (
    <UserRoleContext.Provider value={{
      role,
      isAdmin: role === 'admin',
      isUGCCreator: role === 'ugc_creator',
      isAccountManager: role === 'account_manager',
      loading,
    }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export const useUserRole = () => useContext(UserRoleContext);
```

### Routes protégées

```typescript
// src/App.tsx
function App() {
  return (
    <UserRoleProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/application-pending" element={<Pending />} />

        {/* Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/creators" element={<AdminRoute><Creators /></AdminRoute>} />
        <Route path="/dashboard/leaderboard" element={<AdminRoute><Leaderboard /></AdminRoute>} />
      </Routes>
    </UserRoleProvider>
  );
}
```

---

## 5. Dashboard Créateur UGC

### Ce que voit le créateur

```
┌─────────────────────────────────────────────┐
│  Overview  │  Calendar  │  Account          │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │Views │  │Posts │  │ CPM  │  │Earn- │   │
│  │12.5K │  │ 34   │  │$18.75│  │ings  │   │
│  │ +15% │  │ +3   │  │      │  │$487  │   │
│  └──────┘  └──────┘  └──────┘  └──────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │       Views Over Time (Chart)        │   │
│  │  Line chart - 30 jours              │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │       Posts This Week (12/12)        │   │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%        │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │       Viral Videos Section           │   │
│  │  Videos > 10K views                  │   │
│  └──────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### Composants clés

```
src/components/dashboard/
├── StatsGrid.tsx          # Cartes de stats (Views, Posts, CPM, Earnings)
├── AnalyticsChart.tsx     # Graphique views over time (Recharts)
├── DailyPostsChart.tsx    # Posts par jour
├── DailySpendChart.tsx    # Dépenses par jour
├── ViralVideosSection.tsx # Section vidéos virales
├── CalendarView.tsx       # Vue calendrier
├── AccountView.tsx        # Gestion du compte
├── SubmitPostModal.tsx    # Modal soumission de post
├── FilterBar.tsx          # Filtres (date, plateforme, compte)
├── TabNav.tsx             # Navigation par onglets
└── Header.tsx             # En-tête du dashboard
```

### Hook principal — `useDashboardAnalytics`

```typescript
// src/hooks/useDashboardAnalytics.ts
export function useDashboardAnalytics(userId: string, dateRange: DateRange) {
  return useQuery({
    queryKey: ['dashboard-analytics', userId, dateRange],
    queryFn: async () => {
      // 1. Récupérer les posts du user
      const { data: posts } = await supabase
        .from('posts')
        .select('*, analytics(*)')
        .eq('submitted_by', userId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);

      // 2. Calculer les métriques
      const totalViews = posts.reduce((sum, p) => {
        const latestAnalytics = p.analytics
          .sort((a, b) => new Date(b.fetched_at) - new Date(a.fetched_at))[0];
        return sum + (latestAnalytics?.views || 0);
      }, 0);

      const totalPosts = posts.length;

      // 3. Calculer CPM
      const cpmRate = 1.50; // $1.50 per 1000 views
      const postCap = 350;  // $350 max par post
      const monthlyCap = 5000; // $5000 max par mois

      let totalCPM = 0;
      posts.forEach(post => {
        const views = getLatestViews(post);
        const postCpm = Math.min((views / 1000) * cpmRate, postCap);
        totalCPM += postCpm;
      });
      totalCPM = Math.min(totalCPM, monthlyCap);

      // 4. Posts cette semaine (Lun-Dim)
      const { start: weekStart, end: weekEnd } = getCurrentWeekBoundaries();
      const postsThisWeek = posts.filter(p =>
        new Date(p.created_at) >= weekStart &&
        new Date(p.created_at) <= weekEnd
      ).length;

      return {
        totalViews,
        totalPosts,
        totalCPM,
        postsThisWeek,
        weeklyTarget: 12,
        weeklyTargetMet: postsThisWeek >= 12,
        posts,
      };
    },
  });
}
```

---

## 6. Connexion compte TikTok

### Option A : Saisie manuelle du handle (recommandé pour commencer)

Le créateur entre son @username TikTok. Pas besoin d'OAuth TikTok.

```typescript
// src/components/dashboard/CreateAccountsModal.tsx
function CreateAccountsModal({ userId, onClose }) {
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState('tiktok');

  async function handleSubmit() {
    const { error } = await supabase.from('accounts').insert({
      user_id: userId,
      platform,
      handle: handle.startsWith('@') ? handle : `@${handle}`,
    });

    if (!error) onClose();
  }

  return (
    <Dialog>
      <Select value={platform} onChange={setPlatform}>
        <Option value="tiktok">TikTok</Option>
        <Option value="instagram">Instagram</Option>
      </Select>
      <Input
        placeholder="@votre_handle"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
      />
      <Button onClick={handleSubmit}>Lier le compte</Button>
    </Dialog>
  );
}
```

### Option B : TikTok OAuth (avancé)

Si tu veux accéder à l'API officielle TikTok :

1. Créer une app sur TikTok for Developers (developers.tiktok.com)
2. Implémenter OAuth 2.0 flow
3. Stocker le `access_token` et `refresh_token`
4. Utiliser l'API `/video/list/` pour récupérer les vidéos

> **Recommandation** : Commencer par l'option A + scraping Apify. L'API TikTok officielle est restrictive et lente à obtenir (review process).

---

## 7. Soumission & tracking des posts

### Modal de soumission de post

```typescript
// Détection automatique de la plateforme depuis l'URL
function detectPlatform(url: string): string | null {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return null;
}

// Extraction de l'ID du post depuis l'URL
function extractPostId(url: string, platform: string): string | null {
  switch (platform) {
    case 'tiktok': {
      // https://www.tiktok.com/@user/video/1234567890
      const match = url.match(/video\/(\d+)/);
      return match?.[1] || null;
    }
    case 'instagram': {
      // https://www.instagram.com/reel/ABC123/
      const match = url.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
      return match?.[2] || null;
    }
    case 'youtube': {
      // https://youtube.com/shorts/ABC123
      const match = url.match(/shorts\/([A-Za-z0-9_-]+)/);
      return match?.[1] || null;
    }
    default: return null;
  }
}

async function submitPost(url: string, accountId: string, userId: string) {
  const platform = detectPlatform(url);
  const platformPostId = extractPostId(url, platform);

  const { data, error } = await supabase.from('posts').insert({
    url,
    platform,
    platform_post_id: platformPostId,
    account_id: accountId,
    submitted_by: userId,
    status: 'pending',
    content_type: 'ugc_video',
    published_at: new Date().toISOString(),
  });

  return { data, error };
}
```

### Validation côté frontend

```typescript
function validatePostUrl(url: string): { valid: boolean; error?: string } {
  // 1. URL valide ?
  try { new URL(url); } catch { return { valid: false, error: 'URL invalide' }; }

  // 2. Plateforme supportée ?
  const platform = detectPlatform(url);
  if (!platform) return { valid: false, error: 'Plateforme non supportée' };

  // 3. Post ID extractible ?
  const postId = extractPostId(url, platform);
  if (!postId) return { valid: false, error: "Impossible d'extraire l'ID du post" };

  return { valid: true };
}
```

---

## 8. Système de scraping analytics

### Architecture du scraping

```
┌─────────────┐     ┌──────────────────┐     ┌─────────┐
│  Cron Job   │────>│ create-analytics │────>│analytics│
│ (2 min)     │     │     -jobs        │     │ _jobs   │
└─────────────┘     └──────────────────┘     └────┬────┘
                                                   │
                    ┌──────────────────┐            │
                    │ process-analytics│<───────────┘
                    │      -job        │
                    └───────┬──────────┘
                            │
                    ┌───────▼──────────┐
                    │   Apify Actors   │
                    │  (TikTok, IG)    │
                    └───────┬──────────┘
                            │
                    ┌───────▼──────────┐
                    │  analytics table │
                    │  (time-series)   │
                    └──────────────────┘
```

### Edge Function — Scraping avec Apify

```typescript
// supabase/functions/process-analytics-job/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APIFY_TOKENS = Deno.env.get('APIFY_API_TOKENS')?.split(',') || [];
let tokenIndex = 0;

// Rotation des tokens pour éviter le rate limit
function getNextToken(): string {
  const token = APIFY_TOKENS[tokenIndex % APIFY_TOKENS.length];
  tokenIndex++;
  return token;
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 1. Récupérer le prochain job en attente
  const { data: job } = await supabase
    .from('analytics_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!job) return new Response('No jobs');

  // 2. Marquer comme en cours
  await supabase
    .from('analytics_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', job.id);

  // 3. Récupérer les posts
  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .in('id', job.post_ids);

  // 4. Scraper chaque post via Apify
  for (const post of posts) {
    try {
      const stats = await scrapePost(post);

      await supabase.from('analytics').insert({
        post_id: post.id,
        views: stats.views,
        likes: stats.likes,
        comments: stats.comments,
        shares: stats.shares,
        bookmarks: stats.bookmarks,
        engagement_rate: calculateEngagement(stats),
        source: 'apify',
      });
    } catch (error) {
      await supabase.from('failed_posts_queue').insert({
        post_id: post.id,
        failure_reason: error.message,
      });
    }
  }

  // 5. Marquer le job comme terminé
  await supabase
    .from('analytics_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', job.id);

  return new Response('OK');
});

async function scrapePost(post: any) {
  const token = getNextToken();

  const actors: Record<string, string> = {
    tiktok: 'GdWCkxBtKJbY3Eb9W',
    instagram: 'shu8hvrXbJbY3Eb9W',
    youtube: 'streamers~youtube-shorts-scraper',
  };

  const actorId = actors[post.platform];

  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postURLs: [post.url],
        resultsLimit: 1,
      }),
    }
  );

  if (response.status === 402) throw new Error('Apify quota exceeded');
  if (response.status === 429) throw new Error('Apify rate limited');

  const run = await response.json();
  return parseApifyResult(run, post.platform);
}

function calculateEngagement(stats: any): number {
  if (!stats.views || stats.views === 0) return 0;
  return ((stats.likes + stats.comments + stats.shares) / stats.views) * 100;
}
```

### Configuration Cron dans Supabase

Dans le dashboard Supabase > Database > Extensions > activer `pg_cron` :

```sql
-- Scraper les analytics toutes les 2 minutes
SELECT cron.schedule(
  'create-analytics-jobs',
  '*/2 * * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/create-analytics-jobs',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- Retry les posts échoués toutes les 30 minutes
SELECT cron.schedule(
  'retry-failed-analytics',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/retry-failed-analytics',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);
```

---

## 9. Système CPM & paiements

### Constantes de configuration

```typescript
// src/constants/contracts.ts
export const CPM_CONFIG = {
  RATE: 1.50,              // $1.50 pour 1000 vues
  CPM_WINDOW_DAYS: 28,     // Fenêtre de 28 jours
  POST_CAP: 350,           // $350 max par post
  MONTHLY_CAP: 5000,       // $5,000 max par user par mois
  WEEKLY_POST_TARGET: 12,  // 12 posts par semaine (Lun-Dim)
  FIXED_FEE_PER_POST: 6.25,
};
```

### Calcul du CPM

```typescript
function calculateCPM(posts: Post[], analytics: Analytics[]): CPMResult {
  const { RATE, POST_CAP, MONTHLY_CAP } = CPM_CONFIG;
  let totalCPM = 0;

  const breakdown = posts.map(post => {
    const latestStats = analytics
      .filter(a => a.post_id === post.id)
      .sort((a, b) => new Date(b.fetched_at) - new Date(a.fetched_at))[0];

    const views = latestStats?.views || 0;
    const rawCPM = (views / 1000) * RATE;
    const cappedCPM = Math.min(rawCPM, POST_CAP);

    totalCPM += cappedCPM;

    return { postId: post.id, views, rawCPM, cappedCPM };
  });

  totalCPM = Math.min(totalCPM, MONTHLY_CAP);

  return { totalCPM, breakdown };
}
```

---

## 10. Dashboard Admin

### Ce que voit l'admin

```
┌──────────────────────────────────────────────────────────┐
│  Overview │ Creators │ Leaderboard │ Payouts │ Calendar  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │Total     │  │Total     │  │Active    │  │Monthly │  │
│  │Views     │  │Posts     │  │Creators  │  │Spend   │  │
│  │1.2M     │  │ 1,450    │  │   42     │  │$12.5K  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │            Views Over Time (All creators)        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │            Daily Spend Chart                     │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Action Items                                    │    │
│  │  - 3 posts pending review                        │    │
│  │  - 2 new applications                            │    │
│  │  - 5 payouts to approve                          │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Pages admin

```
src/pages/admin/
├── Applications.tsx   # Gérer les candidatures (approve/reject)
├── Leaderboard.tsx    # Classement des créateurs
└── Payouts.tsx        # Gestion des paiements
```

### Hook admin — Données globales

```typescript
// src/hooks/useAdminDashboard.ts
export function useAdminDashboard(dateRange: DateRange) {
  return useQuery({
    queryKey: ['admin-dashboard', dateRange],
    queryFn: async () => {
      const { data: posts } = await supabase
        .from('posts')
        .select('*, analytics(*), users!submitted_by(full_name, role)')
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);

      const totalViews = sumLatestViews(posts);
      const totalPosts = posts.length;
      const activeCreators = new Set(posts.map(p => p.submitted_by)).size;
      const totalSpend = calculateTotalCPM(posts);

      const dailyViews = groupByDay(posts, 'views');
      const dailySpend = groupByDay(posts, 'cpm');

      const { count: pendingApps } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('application_status', 'pending');

      const pendingPosts = posts.filter(p => p.status === 'pending').length;

      return {
        totalViews, totalPosts, activeCreators, totalSpend,
        dailyViews, dailySpend,
        actionItems: { pendingPosts, pendingApplications: pendingApps },
      };
    },
  });
}
```

---

## 11. Générateur de Slideshow

### Architecture

```
┌──────────────────┐     ┌───────────────────┐
│  Frontend Form   │────>│  Edge Function     │
│  (React)         │     │  generate-slideshow│
│                  │     │                    │
│ - Select sport   │     │ - Fetch data API   │
│ - Select teams   │     │ - Generate images  │
│ - Choose format  │     │ - Return slides    │
└──────────────────┘     └───────────────────┘
```

### Page Slideshow Generator

```typescript
// src/pages/SlideshowGenerator.tsx
function SlideshowGenerator() {
  const [format, setFormat] = useState('target_avoid');
  const [sport, setSport] = useState('nfl');
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const { data } = await supabase.functions.invoke('generate-slideshow', {
      body: { format, sport },
    });
    setSlides(data.slides);
    setLoading(false);
  }

  return (
    <div>
      <h1>Slideshow Generator</h1>

      <Select value={format} onChange={setFormat}>
        <Option value="target_avoid">Target / Avoid</Option>
        <Option value="top_5">Top 5</Option>
        <Option value="comparison">Comparison</Option>
      </Select>

      <Select value={sport} onChange={setSport}>
        <Option value="nfl">NFL</Option>
        <Option value="nba">NBA</Option>
      </Select>

      <Button onClick={generate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Slideshow'}
      </Button>

      <div className="grid grid-cols-3 gap-4">
        {slides.map((slide, i) => (
          <SlidePreview key={i} slide={slide} />
        ))}
      </div>

      {slides.length > 0 && (
        <Button onClick={() => downloadSlides(slides)}>
          Download All
        </Button>
      )}
    </div>
  );
}
```

---

## 12. Gamification

### Composants

| Composant | Description |
|-----------|-------------|
| `StreakTracker` | Compteur de jours consécutifs avec au moins 1 post |
| `MilestoneBadges` | Badges débloqués (10 posts, 100K views, etc.) |
| `OnboardingChecklist` | Progression d'onboarding (lier TikTok, 1er post, etc.) |
| `LevelCompletionModal` | Notification quand le créateur monte de niveau |
| `WeeklyRecapModal` | Résumé hebdomadaire des performances |

### Milestones

```typescript
const MILESTONES = [
  { id: 'first_post', label: 'First Post', condition: (s) => s.totalPosts >= 1 },
  { id: '10_posts', label: '10 Posts', condition: (s) => s.totalPosts >= 10 },
  { id: '1k_views', label: '1K Views', condition: (s) => s.totalViews >= 1000 },
  { id: '10k_views', label: '10K Views', condition: (s) => s.totalViews >= 10000 },
  { id: '100k_views', label: '100K Views', condition: (s) => s.totalViews >= 100000 },
  { id: 'weekly_target', label: 'Weekly Target', condition: (s) => s.postsThisWeek >= 12 },
  { id: '7_day_streak', label: '7 Day Streak', condition: (s) => s.streak >= 7 },
];
```

---

## 13. Notifications (Email + Discord)

### Emails avec Resend

```typescript
// supabase/functions/send-notification/index.ts
import { Resend } from 'npm:resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

async function sendWelcomeEmail(user: { email: string; full_name: string }) {
  await resend.emails.send({
    from: 'noreply@votredomaine.com',
    to: user.email,
    subject: 'Bienvenue sur la plateforme !',
    html: `<h1>Salut ${user.full_name}!</h1><p>Ton compte a été approuvé...</p>`,
  });
}
```

### Discord Webhook

```typescript
async function sendDiscordNotification(webhookUrl: string, message: string) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message }),
  });
}

// Notifications possibles :
// - Nouveau post soumis -> channel #posts
// - Post viral (>10K views) -> channel #viral
// - Nouveau créateur approuvé -> channel #team
// - Payout envoyé -> DM au créateur
```

---

## 14. Déploiement

### Frontend

```bash
npm run build
# Déployer sur Vercel / Netlify / Cloudflare Pages
```

### Edge Functions (Supabase)

```bash
npx supabase functions deploy process-analytics-job --no-verify-jwt
npx supabase functions deploy create-analytics-jobs --no-verify-jwt
npx supabase functions deploy generate-slideshow --no-verify-jwt
```

### Secrets à configurer

```bash
npx supabase secrets set APIFY_API_TOKENS="token1,token2,token3"
npx supabase secrets set RESEND_API_KEY="re_xxx"
npx supabase secrets set DISCORD_BOT_TOKEN="xxx"
```

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_ANON_KEY` | Clé publique (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé privée (edge functions uniquement) |
| `APIFY_API_TOKENS` | Tokens Apify (virgules) |
| `RESEND_API_KEY` | Clé API Resend |
| `DISCORD_BOT_TOKEN` | Token du bot Discord |
| `DISCORD_WEBHOOK_URL` | URL webhook Discord |

---

## 15. Structure des fichiers

```
creator-platform/
├── src/
│   ├── App.tsx                          # Routes
│   ├── lib/
│   │   └── supabase.ts                 # Client Supabase
│   ├── contexts/
│   │   └── UserRoleContext.tsx          # Gestion des rôles
│   ├── constants/
│   │   └── contracts.ts                # Config CPM, caps, targets
│   ├── utils/
│   │   └── dateUtils.ts                # Helpers dates UTC
│   ├── hooks/
│   │   ├── useDashboardAnalytics.ts    # Stats dashboard
│   │   ├── useChartAnalytics.ts        # Données charts
│   │   ├── useUserProfile.ts           # Profil utilisateur
│   │   ├── useLeaderboardData.ts       # Classement
│   │   └── useUGCPayouts.ts            # Paiements UGC
│   ├── pages/
│   │   ├── Index.tsx                    # Dashboard principal
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── SlideshowGenerator.tsx
│   │   └── admin/
│   │       ├── Applications.tsx
│   │       ├── Leaderboard.tsx
│   │       └── Payouts.tsx
│   └── components/
│       ├── dashboard/
│       │   ├── StatsGrid.tsx
│       │   ├── AnalyticsChart.tsx
│       │   ├── SubmitPostModal.tsx
│       │   ├── ViralVideosSection.tsx
│       │   ├── StreakTracker.tsx
│       │   ├── MilestoneBadges.tsx
│       │   ├── FilterBar.tsx
│       │   ├── TabNav.tsx
│       │   └── CalendarView.tsx
│       ├── admin/
│       │   ├── ApplicationCard.tsx
│       │   └── TeamAssignmentModal.tsx
│       └── ui/                          # shadcn/ui
├── supabase/
│   ├── migrations/
│   │   ├── 001_users.sql
│   │   ├── 002_accounts.sql
│   │   ├── 003_posts.sql
│   │   ├── 004_analytics.sql
│   │   ├── 005_cpm_payments.sql
│   │   └── 006_jobs.sql
│   └── functions/
│       ├── process-analytics-job/
│       ├── create-analytics-jobs/
│       ├── retry-failed-analytics/
│       ├── generate-slideshow/
│       └── send-notification/
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## Checklist de mise en place

- [ ] Créer le projet Supabase
- [ ] Exécuter les migrations SQL (tables, RLS, index)
- [ ] Setup le frontend React + Vite + TailwindCSS + shadcn
- [ ] Implémenter l'auth (signup, login, rôles)
- [ ] Créer le dashboard créateur (stats, charts, submit post)
- [ ] Implémenter la connexion de comptes TikTok
- [ ] Créer l'edge function de scraping + configurer Apify
- [ ] Configurer les cron jobs (pg_cron)
- [ ] Implémenter le système CPM
- [ ] Créer le dashboard admin (overview, applications, payouts)
- [ ] Ajouter la gamification (streaks, milestones)
- [ ] Configurer les notifications (email + Discord)
- [ ] Créer le générateur de slideshow
- [ ] Déployer le frontend (Vercel/Netlify)
- [ ] Déployer les edge functions
- [ ] Tester le flow complet end-to-end
