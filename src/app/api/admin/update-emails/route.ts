import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * API một lần: cập nhật email toàn bộ user thành @vietinbank.vn
 *
 * Cách dùng:
 *   1. Push code → Vercel auto-deploy
 *   2. Mở browser: https://<domain>/api/admin/update-emails?token=<CRON_SECRET>
 *   3. Xem kết quả JSON
 *
 * Token được so sánh với biến môi trường CRON_SECRET để tránh truy cập trái phép.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY hoặc NEXT_PUBLIC_SUPABASE_URL' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Cập nhật email trong auth.users qua Admin API
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    if (!usersData?.users?.length) {
      return NextResponse.json({ success: true, message: 'Không có user nào', updated: 0 });
    }

    const authResults: { email: string; new_email: string; status: string; error?: string }[] = [];

    for (const user of usersData.users) {
      const oldEmail = user.email || '';
      if (!oldEmail) continue;

      const username = oldEmail.includes('@') ? oldEmail.split('@')[0] : oldEmail;
      const newEmail = `${username}@vietinbank.vn`;

      if (oldEmail === newEmail) {
        authResults.push({ email: oldEmail, new_email: newEmail, status: 'skipped' });
        continue;
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { email: newEmail });
      authResults.push({
        email: oldEmail,
        new_email: newEmail,
        status: updateError ? 'error' : 'updated',
        ...(updateError ? { error: updateError.message } : {}),
      });
    }

    // 2. Cập nhật profiles.ad_account (nếu là email đầy đủ có @)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, ad_account')
      .like('ad_account', '%@%');

    let profileUpdated = 0;
    if (profiles) {
      for (const profile of profiles) {
        if (!profile.ad_account) continue;
        const parts = profile.ad_account.split('@');
        if (parts.length >= 2 && parts[1] !== 'vietinbank.vn') {
          const newAdAccount = `${parts[0]}@vietinbank.vn`;
          const { error: updErr } = await supabase
            .from('profiles')
            .update({ ad_account: newAdAccount })
            .eq('id', profile.id);
          if (!updErr) profileUpdated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      total_users: usersData.users.length,
      auth_updated: authResults.filter(r => r.status === 'updated').length,
      auth_skipped: authResults.filter(r => r.status === 'skipped').length,
      auth_error: authResults.filter(r => r.status === 'error').length,
      auth_detail: authResults,
      profiles_updated: profileUpdated,
      message: `✅ Đã cập nhật email auth.users + ${profileUpdated} profiles.ad_account`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
