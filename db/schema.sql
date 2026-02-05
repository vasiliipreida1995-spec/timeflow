CREATE TABLE IF NOT EXISTS project_admin_chat_reads (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL,
  message_id BIGINT NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  read_at DATETIME NOT NULL,
  UNIQUE KEY uniq_read (project_id, message_id, user_id),
  KEY idx_project_message (project_id, message_id),
  KEY idx_user (user_id)
);\r\n\r\nCREATE TABLE IF NOT EXISTS app_settings (\r\n  user_id VARCHAR(128) PRIMARY KEY,\r\n  company_name VARCHAR(255),\r\n  timezone VARCHAR(128),\r\n  currency VARCHAR(32),\r\n  language VARCHAR(64),\r\n  max_shift_hours INT,\r\n  min_break_minutes INT,\r\n  confirm_hours INT,\r\n  overtime_policy VARCHAR(128),\r\n  email_sender VARCHAR(255),\r\n  copy_lead VARCHAR(255),\r\n  slack_channel VARCHAR(255),\r\n  telegram_channel VARCHAR(255),\r\n  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\r\n  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP\r\n);\r\n