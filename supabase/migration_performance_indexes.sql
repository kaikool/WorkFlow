-- ==============================================================================
-- migration_performance_indexes.sql
-- Thêm indexes tối ưu hiệu năng cho queries dashboard + handover + tasks.
-- ==============================================================================

-- Index cho tasks dashboard: lọc is_archived=FALSE + status (dùng cho dashboard_summary + tasks_dashboard)
CREATE INDEX IF NOT EXISTS idx_tasks_active_status 
  ON tasks(is_archived, status) 
  WHERE is_archived = FALSE;

-- Index cho task_assignees: lookup task_id (cần cho dashboard_summary CTE + tasks_dashboard)
CREATE INDEX IF NOT EXISTS idx_task_assignees_task 
  ON task_assignees(task_id);

-- Index cho handover inbox: filter receiver_id + status (dùng cho dashboard_summary pending_docs + handover page)
CREATE INDEX IF NOT EXISTS idx_handovers_receiver_status 
  ON document_handovers(receiver_id, status);

NOTIFY pgrst, 'reload schema';
