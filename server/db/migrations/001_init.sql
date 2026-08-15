CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('Admin','Supervisor','Agent')),
  designation    TEXT,
  phone          TEXT,
  cnic           TEXT,
  status         TEXT NOT NULL DEFAULT 'Active',
  avatar         TEXT,
  shift          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaigns (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  client              TEXT,
  category            TEXT,
  monthly_target_pkr  NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission_rate     NUMERIC(5,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'Active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaign_agents (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, agent_id)
);

CREATE TABLE sales (
  id            TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id),
  agent_id      TEXT NOT NULL REFERENCES users(id),
  amount        NUMERIC(14,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  sale_date     TIMESTAMPTZ NOT NULL DEFAULT now(),
  agent_notes   TEXT,
  qa_notes      TEXT,
  verified_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attendance_logs (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES users(id),
  log_date    DATE NOT NULL,
  clock_in    TEXT,
  clock_out   TEXT,
  status      TEXT NOT NULL DEFAULT 'Present',
  total_hours TEXT
);

CREATE TABLE targets (
  agent_id             TEXT PRIMARY KEY REFERENCES users(id),
  daily_target_pkr     NUMERIC(14,2) DEFAULT 0,
  daily_achieved_pkr   NUMERIC(14,2) DEFAULT 0,
  weekly_target_pkr    NUMERIC(14,2) DEFAULT 0,
  weekly_achieved_pkr  NUMERIC(14,2) DEFAULT 0,
  monthly_target_pkr   NUMERIC(14,2) DEFAULT 0,
  monthly_achieved_pkr NUMERIC(14,2) DEFAULT 0
);

CREATE TABLE callbacks (
  id            TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone         TEXT,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id),
  agent_id      TEXT NOT NULL REFERENCES users(id),
  due_date      TIMESTAMPTZ,
  priority      TEXT DEFAULT 'Medium',
  status        TEXT NOT NULL DEFAULT 'Pending',
  notes         TEXT
);

CREATE TABLE leads (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  phone             TEXT,
  email             TEXT,
  address           TEXT,
  campaign_id       TEXT NOT NULL REFERENCES campaigns(id),
  source            TEXT,
  assigned_agent_id TEXT REFERENCES users(id),
  status            TEXT NOT NULL DEFAULT 'New',
  last_contact      DATE,
  next_callback     TIMESTAMPTZ,
  notes             TEXT
);

CREATE TABLE payroll (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES users(id),
  month           TEXT NOT NULL,
  base_salary_pkr NUMERIC(14,2) DEFAULT 0,
  commission_pkr  NUMERIC(14,2) DEFAULT 0,
  bonus_pkr       NUMERIC(14,2) DEFAULT 0,
  deductions_pkr  NUMERIC(14,2) DEFAULT 0,
  net_salary_pkr  NUMERIC(14,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid','Pending')),
  payment_date    TEXT
);

CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  channel    TEXT NOT NULL,
  sender_id  TEXT NOT NULL REFERENCES users(id),
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE kb_articles (
  id       TEXT PRIMARY KEY,
  category TEXT,
  title    TEXT NOT NULL,
  summary  TEXT,
  content  TEXT
);

CREATE TABLE tickets (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES users(id),
  subject     TEXT NOT NULL,
  category    TEXT,
  priority    TEXT DEFAULT 'Medium',
  status      TEXT NOT NULL DEFAULT 'Open',
  ticket_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT
);

CREATE INDEX idx_sales_campaign ON sales(campaign_id);
CREATE INDEX idx_sales_agent ON sales(agent_id);
CREATE INDEX idx_leads_campaign ON leads(campaign_id);
CREATE INDEX idx_leads_agent ON leads(assigned_agent_id);
CREATE INDEX idx_callbacks_agent ON callbacks(agent_id);
CREATE INDEX idx_messages_channel ON messages(channel, created_at);
CREATE INDEX idx_payroll_agent ON payroll(agent_id);
CREATE INDEX idx_attendance_agent ON attendance_logs(agent_id);
CREATE INDEX idx_tickets_agent ON tickets(agent_id);
