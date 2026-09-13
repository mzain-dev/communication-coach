-- Personal Communication & English Coach — full schema (Section 3 of the implementation plan).
-- Created up front by the Architect step; Phase 1 only reads/writes users, user_settings,
-- scenarios, speaking_sessions and summaries. The rest exist so later modules need no migrations.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  encrypted_api_key TEXT,
  preferred_model VARCHAR(64),
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scenarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  system_prompt TEXT NOT NULL,
  difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'intermediate',
  is_client_track BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS speaking_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  scenario_id INT NOT NULL,
  transcript TEXT,
  duration_seconds INT NOT NULL DEFAULT 0,
  model_used VARCHAR(64),
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id)
);

CREATE TABLE IF NOT EXISTS writing_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category VARCHAR(64) NOT NULL,
  original_text MEDIUMTEXT NOT NULL,
  corrected_text MEDIUMTEXT,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS listening_exercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  topic VARCHAR(255),
  difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'intermediate',
  transcript MEDIUMTEXT,
  questions JSON,
  answers JSON,
  score INT,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vocabulary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  word VARCHAR(255) NOT NULL,
  definition TEXT,
  example TEXT,
  source_module VARCHAR(64),
  mastery_level INT NOT NULL DEFAULT 0,
  next_review_date DATE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS grammar_errors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  error_type VARCHAR(128) NOT NULL,
  example TEXT,
  session_id INT,
  session_type VARCHAR(32),
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS level_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  skill ENUM('speaking', 'writing', 'listening') NOT NULL,
  level ENUM('beginner', 'intermediate', 'advanced', 'professional') NOT NULL,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  session_id INT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_id INT NOT NULL,
  session_type VARCHAR(32) NOT NULL,
  strengths TEXT,
  weaknesses TEXT,
  score INT,
  action_item TEXT,
  -- Everything else Gemini generated for this session's feedback (mistake-by-mistake
  -- corrections, tone/fluency notes, vocabulary suggestions, etc.) that doesn't have its own
  -- column — shown in full on the session/entry detail page, not just this row's summary.
  details JSON NULL,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS youtube_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  url VARCHAR(512) NOT NULL,
  title VARCHAR(255),
  transcript MEDIUMTEXT,
  date_added DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  linked_speaking_session_id INT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  module VARCHAR(64) NOT NULL,
  minutes_spent INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_user_date_module (user_id, date, module),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
