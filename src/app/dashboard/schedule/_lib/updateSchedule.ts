// Helper cập nhật lịch trình hiện có — tách khỏi useSchedule để giữ file gốc dưới 500 dòng.

import { checkResourceConflicts } from "./utils";

interface UpdateScheduleParams {
  supabase: any;
  toast: any;
  profile: any;
  allProfiles: any[];
  schedules: any[];
  id: string;
  updates: any;
  findParticipantConflicts: (params: { participantIds: string[]; start: Date; end: Date; ignoreScheduleId?: string }) => Promise<string[]>;
  sendNotifications: (rows: any[]) => Promise<void>;
  setIsDetailOpen: (v: boolean) => void;
  fetchData: () => Promise<void>;
}

export async function updateScheduleAction(p: UpdateScheduleParams) {
  const {
    supabase, toast, profile, allProfiles, schedules, id, updates,
    findParticipantConflicts, sendNotifications, setIsDetailOpen, fetchData,
  } = p;

  try {
    const schedule = schedules.find((s: any) => s.id === id);
    if (!schedule) return;

    const nextStart = updates.start_time ? new Date(updates.start_time) : new Date(schedule.start_time);
    const nextEnd = updates.end_time ? new Date(updates.end_time) : new Date(schedule.end_time);
    if (nextEnd <= nextStart) {
      toast({ variant: "destructive", title: "Lỗi thời gian", description: "Thời gian kết thúc phải sau thời gian bắt đầu." });
      return;
    }

    const isLeave = (updates.type || schedule.type) === 'leave';

    const resourceErrors = isLeave ? [] : checkResourceConflicts({
      roomId: updates.room_id,
      vehicleId: updates.vehicle_id,
      start: nextStart,
      end: nextEnd,
      schedules,
      ignoreScheduleId: id
    });

    if (resourceErrors.length > 0) {
      toast({ variant: "destructive", title: "Tài nguyên đang bận", description: resourceErrors[0] });
      return;
    }

    const { participant_ids, ...scheduleUpdates } = updates;
    const nextParticipantIds = Array.isArray(participant_ids)
      ? Array.from(new Set([schedule.created_by, ...participant_ids].filter(Boolean)))
      : (schedule.participants || []).map((q: any) => q.profile?.id).filter(Boolean);
    const participantConflicts = isLeave ? [] : await findParticipantConflicts({
      participantIds: nextParticipantIds,
      start: nextStart,
      end: nextEnd,
      ignoreScheduleId: id
    });

    const { error } = await supabase.from('schedules').update(scheduleUpdates).eq('id', id);
    if (error) throw error;

    const oldParticipantIds = (schedule.participants || [])
      .map((q: any) => q.profile?.id)
      .filter(Boolean);
    let finalParticipantIds = oldParticipantIds;
    let addedParticipantIds: string[] = [];

    if (Array.isArray(participant_ids)) {
      finalParticipantIds = Array.from(new Set([schedule.created_by, ...participant_ids].filter(Boolean)));
      addedParticipantIds = finalParticipantIds.filter((uid: string) => !oldParticipantIds.includes(uid));

      const { error: deleteError } = await supabase.from('schedule_participants').delete().eq('schedule_id', id);
      if (deleteError) throw deleteError;

      if (finalParticipantIds.length > 0) {
        const { error: insertError } = await supabase.from('schedule_participants').insert(
          finalParticipantIds.map((uid: string) => ({ schedule_id: id, profile_id: uid }))
        );
        if (insertError) throw insertError;
      }
    }

    // Loại trừ lái xe khỏi thông báo cập nhật lịch chung
    const notifyTargets = finalParticipantIds.filter((uid: string) => {
      if (!uid || uid === profile?.id) return false;
      const target = allProfiles.find((x: any) => x.id === uid);
      return target?.role !== 'driver';
    });

    if (notifyTargets.length > 0) {
      await sendNotifications(
        notifyTargets.map((uid: string) => ({
          user_id: uid,
          title: addedParticipantIds.includes(uid) ? "Bạn được thêm vào lịch trình" : `Lịch trình đã được cập nhật`,
          content: addedParticipantIds.includes(uid)
            ? `${profile?.full_name || 'Người dùng'} đã thêm bạn vào lịch trình "${scheduleUpdates.title || schedule.title}".`
            : `${profile?.full_name || 'Người dùng'} vừa cập nhật lịch trình "${scheduleUpdates.title || schedule.title}".`,
          link: "/dashboard/schedule"
        }))
      );
    }

    if (participantConflicts.length > 0) {
      toast({ title: "Cảnh báo trùng lịch", description: participantConflicts[0] });
    } else {
      toast({ title: "Thành công", description: "Đã cập nhật lịch trình." });
    }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setIsDetailOpen(false);
    fetchData();
  } catch (error: any) {
    toast({ variant: "destructive", title: "Lỗi", description: error.message });
  }
}
