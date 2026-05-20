DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
CREATE POLICY "Authenticated users can create notifications"
ON notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can delete schedule_participants" ON schedule_participants;
CREATE POLICY "Anyone can delete schedule_participants" ON schedule_participants FOR DELETE
USING (
    auth.uid() IS NOT NULL AND (
        profile_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM schedules s
            WHERE s.id = schedule_participants.schedule_id AND s.created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p
            LEFT JOIN departments d ON p.department_id = d.id
            WHERE p.id = auth.uid()
            AND (p.role IN ('admin', 'secretary', 'hr_officer') OR d.name = 'Tổ chức Tổng hợp')
        )
    )
);

CREATE OR REPLACE FUNCTION public.check_schedule_participant_conflicts(
  p_participant_ids uuid[],
  p_start timestamptz,
  p_end timestamptz,
  p_ignore_schedule_id uuid DEFAULT NULL
)
RETURNS TABLE (
  schedule_id uuid,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  status schedule_status,
  profile_id uuid,
  full_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.title,
    s.start_time,
    s.end_time,
    s.status,
    p.id,
    p.full_name
  FROM schedules s
  JOIN schedule_participants sp ON sp.schedule_id = s.id
  JOIN profiles p ON p.id = sp.profile_id
  WHERE s.status <> 'rejected'
    AND (p_ignore_schedule_id IS NULL OR s.id <> p_ignore_schedule_id)
    AND sp.profile_id = ANY(p_participant_ids)
    AND s.start_time < p_end
    AND s.end_time > p_start;
$$;

GRANT EXECUTE ON FUNCTION public.check_schedule_participant_conflicts(uuid[], timestamptz, timestamptz, uuid) TO authenticated;
