-- Schedule rejection metadata + resubmit flow.
-- Khi TCTH từ chối: lưu rejection_reason / rejected_by / rejected_at.
-- Khi creator đẩy lại: lưu change_reason, reset status='pending', clear rejection_*.

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_schedules_rejected ON schedules(status) WHERE status = 'rejected';

NOTIFY pgrst, 'reload schema';
