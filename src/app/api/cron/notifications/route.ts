import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel cron job to check deadlines and birthdays
// Must be configured in vercel.json: { "crons": [{ "path": "/api/cron/notifications", "schedule": "0 8 * * *" }] }

export async function GET(request: Request) {
  try {
    // Validate cron secret if deployed
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Thiếu biến môi trường: cần NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const notifications: any[] = [];
    const now = new Date();

    // 0. AUTO-ARCHIVE & CLEANUP định kỳ (chạy ở cron, không chạy ở client nữa)
    try {
      await supabase.rpc('auto_archive_and_cleanup');
    } catch (cleanupErr) {
      console.error('Auto-archive error:', cleanupErr);
    }

    // 1. CHECK OVERDUE TASKS
    const { data: overdueTasks } = await supabase
      .from('tasks')
      .select('id, title, assignee_id, created_by, due_date, status, task_type')
      .lt('due_date', now.toISOString())
      .neq('status', 'done')
      .neq('status', 'closed')
      .neq('status', 'late');

    if (overdueTasks && overdueTasks.length > 0) {
      // Mark them as late
      await supabase
        .from('tasks')
        .update({ status: 'late' })
        .in('id', overdueTasks.map(t => t.id));

      // Create notifications
      overdueTasks.forEach(task => {
        // Notify Assignee
        if (task.assignee_id) {
          notifications.push({
            user_id: task.assignee_id,
            title: 'Công việc quá hạn',
            content: `Công việc "${task.title}" của bạn đã quá hạn. Vui lòng cập nhật tiến độ ngay!`,
            link: `/dashboard/tasks/${task.id}`
          });
        }
        // Notify Creator
        if (task.created_by && task.created_by !== task.assignee_id) {
          notifications.push({
            user_id: task.created_by,
            title: 'Cảnh báo quá hạn',
            content: `Công việc "${task.title}" mà bạn giao đã bị quá hạn.`,
            link: `/dashboard/tasks/${task.id}`
          });
        }
      });
    }

    // 2. CHECK APPROACHING DEADLINES (Due in next 24 hours)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { data: upcomingTasks } = await supabase
      .from('tasks')
      .select('id, title, assignee_id')
      .gte('due_date', now.toISOString())
      .lte('due_date', tomorrow.toISOString())
      .neq('status', 'done')
      .neq('status', 'closed');

    if (upcomingTasks && upcomingTasks.length > 0) {
      upcomingTasks.forEach(task => {
        if (task.assignee_id) {
          notifications.push({
            user_id: task.assignee_id,
            title: 'Sắp đến hạn',
            content: `Công việc "${task.title}" sẽ đến hạn vào ngày mai. Hãy đảm bảo hoàn thành nhé!`,
            link: `/dashboard/tasks/${task.id}`
          });
        }
      });
    }

    // 3. CHECK BIRTHDAYS
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();
    
    // We cannot easily query extract(month from birthday) with postgrest without RPC, 
    // so we fetch profiles with birthdays and filter in memory since profiles count is usually small per company.
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, birthday, department_id')
      .not('birthday', 'is', null);

    if (profiles && profiles.length > 0) {
      const birthdayPeople = profiles.filter(p => {
        if (!p.birthday) return false;
        const bDate = new Date(p.birthday);
        return bDate.getMonth() + 1 === currentMonth && bDate.getDate() === currentDay;
      });

      if (birthdayPeople.length > 0) {
        // Notify everyone in their department
        for (const person of birthdayPeople) {
          if (person.department_id) {
            const { data: colleagues } = await supabase
              .from('profiles')
              .select('id')
              .eq('department_id', person.department_id)
              .neq('id', person.id);
              
            if (colleagues) {
              colleagues.forEach(c => {
                notifications.push({
                  user_id: c.id,
                  title: 'Sinh nhật đồng nghiệp \uD83C\uDF82',
                  content: `Hôm nay là sinh nhật của ${person.full_name}. Hãy gửi lời chúc mừng nhé!`,
                  link: `/dashboard/team/${person.id}`
                });
              });
            }
          }
          
          // Notify the birthday person
          notifications.push({
            user_id: person.id,
            title: 'Chúc mừng sinh nhật! \uD83C\uDF89',
            content: `Tập thể công ty chúc bạn một tuổi mới đầy thành công và hạnh phúc!`,
            link: `/dashboard/profile`
          });
        }
      }
    }

    // Insert all notifications
    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    return NextResponse.json({ 
      success: true, 
      processed_overdue: overdueTasks?.length || 0,
      processed_upcoming: upcomingTasks?.length || 0,
      notifications_sent: notifications.length 
    });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
