-- Migration: tự hoàn thành lịch họp / sự kiện / nghỉ phép không dùng xe
-- Rule: approved + type meeting/event/leave + không xe/lái xe + end_time quá 15 phút => completed.

BEGIN;

CREATE OR REPLACE FUNCTION public.complete_finished_schedules()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE public.schedules
  SET status = 'completed'
  WHERE status = 'approved'
    AND end_time < NOW() - INTERVAL '15 minutes'
    AND (
      (type::text IN ('meeting', 'event', 'leave') AND COALESCE(use_vehicle, false) = false AND vehicle_id IS NULL AND driver_id IS NULL)
      OR
      (type::text = 'trip' AND COALESCE(use_vehicle, false) = false AND vehicle_id IS NULL AND driver_id IS NULL)
    )
    -- KHÔNG auto-complete lịch có BGĐ tham gia (phải có người bấm kết thúc)
    AND NOT EXISTS (
      SELECT 1 FROM schedule_participants sp
      JOIN profiles p ON p.id = sp.profile_id
      WHERE sp.schedule_id = public.schedules.id
        AND p.role = 'director'
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_finished_schedules() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_finished_schedules() TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
