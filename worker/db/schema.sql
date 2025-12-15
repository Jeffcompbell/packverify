-- 用户表
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  photo_url TEXT,
  quota INTEGER DEFAULT 10,
  used INTEGER DEFAULT 0,
  is_admin INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  image_count INTEGER DEFAULT 0,
  qil_fields TEXT,
  qil_input_text TEXT,
  FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
);

-- 图片表
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  description TEXT,
  ocr_text TEXT,
  specs TEXT,
  issues TEXT,
  deterministic_issues TEXT,
  diffs TEXT,
  issues_by_model TEXT,
  status TEXT DEFAULT 'pending',
  analyzing_started_at INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
);

-- 配额使用记录表
CREATE TABLE IF NOT EXISTS quota_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  image_name TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  timestamp INTEGER NOT NULL,
  token_usage TEXT,
  FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
);

-- 检测配置表
CREATE TABLE IF NOT EXISTS detection_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  rules TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
);

-- 批量报告表
CREATE TABLE IF NOT EXISTS batch_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  config_id TEXT,
  status TEXT DEFAULT 'pending',
  total_images INTEGER DEFAULT 0,
  processed_images INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE,
  FOREIGN KEY (config_id) REFERENCES detection_configs(id) ON DELETE SET NULL
);

-- 批量报告图片表
CREATE TABLE IF NOT EXISTS batch_report_images (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  storage_key TEXT,
  status TEXT DEFAULT 'pending',
  result TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (report_id) REFERENCES batch_reports(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_session_id ON images(session_id);
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_usage_user_id ON quota_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_usage_timestamp ON quota_usage(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_detection_configs_user_id ON detection_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_reports_user_id ON batch_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_reports_status ON batch_reports(status);
CREATE INDEX IF NOT EXISTS idx_batch_report_images_report_id ON batch_report_images(report_id);
