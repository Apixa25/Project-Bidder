-- Track cron job execution history for admin visibility
CREATE TABLE cron_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed')),
  error_message TEXT,
  items_processed INT DEFAULT 0,
  details JSONB DEFAULT '{}'
);

CREATE INDEX idx_cron_runs_job ON cron_job_runs(job_name, started_at DESC);
ALTER TABLE cron_job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY cron_runs_admin ON cron_job_runs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );
