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
    AND type::text IN ('meeting', 'event', 'leave')
    AND COALESCE(use_vehicle, false) = false
    AND vehicle_id IS NULL
    AND driver_id IS NULL
    AND end_time < NOW() - INTERVAL '15 minutes';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_finished_schedules() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_finished_schedules() TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
