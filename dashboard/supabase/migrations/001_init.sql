-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'ugc_creator',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TikTok/Instagram accounts linked by creators
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT,
  follower_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, handle)
);

-- Posts submitted by creators
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_post_id TEXT,
  account_id UUID REFERENCES accounts(id),
  submitted_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics snapshots (time-series)
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
  source TEXT DEFAULT 'apify'
);

CREATE INDEX idx_analytics_post_id ON analytics(post_id);
CREATE INDEX idx_analytics_fetched_at ON analytics(fetched_at);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Creators see their own data
CREATE POLICY "users_read_own" ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "accounts_read_own" ON accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "accounts_insert_own" ON accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "posts_read_own" ON posts FOR SELECT
  USING (
    submitted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "posts_insert_own" ON posts FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "analytics_read" ON analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = analytics.post_id
      AND (posts.submitted_by = auth.uid()
           OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- Admin full access
CREATE POLICY "admin_users" ON users FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_accounts" ON accounts FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_posts" ON posts FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_analytics" ON analytics FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
