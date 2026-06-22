import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, HeadingLevel, TabStopPosition, TabStopType
} from 'docx';
import * as nodemailer from 'nodemailer';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const SCHEDULE_SELECT = `*, metadata, creator:profiles!schedules_created_by_fkey(full_name, title, avatar_url, department_id, role, is_department_head, phone), department:departments!schedules_department_id_fkey(name), vehicle:vehicles(name, plate_number, type), driver:profiles!schedules_driver_id_fkey(id, full_name, title, phone), participants:schedule_participants(profile:profiles(id, full_name, title, avatar_url, role, is_department_head, phone))`;

function formatDateTime(iso: string): { time: string; date: string; full: string } {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return {
    time: `${h} giờ ${m}`,
    date: `ngày ${day} tháng ${month} năm ${year}`,
    full: `${h} giờ ${m} ngày ${day} tháng ${month} năm ${year}`,
  };
}

function vietnameseMonthDay(iso: string): string {
  const d = new Date(iso);
  return `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

async function generateVehicleRequestDocx(schedule: any): Promise<Buffer> {
  const creator = schedule.creator || {};
  const department = schedule.department || {};
  const participants = schedule.participants || [];
  const startFmt = formatDateTime(schedule.start_time);

  const participantList = participants
    .map((p: any) => p.profile)
    .filter(Boolean);

  const sortedParticipants = [...participantList].sort((a: any, b: any) => {
    const roleOrder: Record<string, number> = { director: 0, manager: 1, staff: 2, secretary: 3 };
    return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
  });

  // prettier-ignore
  const children: any[] = [];

  // --- Paragraph helper (multi-run) ---
  const multiRunP = (runs: any[], options: any = {}) =>
    new Paragraph({
      spacing: { after: options.after ?? 120, before: options.before ?? 0 },
      alignment: options.alignment ?? AlignmentType.LEFT,
      indent: options.indent,
      children: runs.map((r: any) => new TextRun({
        text: r.text,
        font: { name: 'Times New Roman', hint: 'eastAsia' },
        size: r.size ?? 24,
        bold: r.bold ?? false,
        italics: r.italics ?? false,
        underline: r.underline ?? false,
      })),
    });

  const p = (text: string, options: any = {}) =>
    new Paragraph({
      spacing: { after: options.after ?? 120, before: options.before ?? 0 },
      alignment: options.alignment ?? AlignmentType.LEFT,
      indent: options.indent,
      children: [
        new TextRun({
          text,
          font: { name: 'Times New Roman', hint: 'eastAsia' },
          size: options.size || 24,
          bold: options.bold ?? false,
          italics: options.italics ?? false,
          underline: options.underline ?? false,
        }),
      ],
    });

  const emptyP = (h?: number) =>
    new Paragraph({
      spacing: { after: 0, before: 0 },
      children: [new TextRun({ text: '', size: h || 24 })],
    });

  // ===== HELPERS =====
  function honorific(gender?: string): string {
    if (gender === 'male') return 'Ông ';
    if (gender === 'female') return 'Bà ';
    return '';
  }

  function zeroPad(n: number, len = 2): string {
    return n.toString().padStart(len, '0');
  }

  // ===== HEADER =====
  children.push(
    new Paragraph({
      spacing: { after: 0 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({ text: 'NGÂN HÀNG TMCP CÔNG THƯƠNG', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true }),
      ],
    }),
    new Paragraph({
      spacing: { after: 0 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({ text: 'VIỆT NAM', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true }),
      ],
    }),
    emptyP(60),
    new Paragraph({
      spacing: { after: 0 },
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true }),
      ],
    }),
    new Paragraph({
      spacing: { after: 0 },
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, italics: true }),
      ],
    }),
    new Paragraph({
      spacing: { after: 0 },
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1 } },
      children: [
        new TextRun({ text: '                                               ', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22 }),
      ],
    }),
    emptyP(80),
    new Paragraph({
      spacing: { after: 0 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'CHI NHÁNH HOÀNG MAI', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true }),
      ],
    }),
    emptyP(120),
    new Paragraph({
      spacing: { after: 120 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'GIẤY ĐỀ NGHỊ SỬ DỤNG XE', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 28, bold: true, underline: { type: 'single' } }),
      ],
    }),
  );

  // ===== Kính gửi =====
  children.push(
    p('Kính gửi: Ban Giám đốc Chi nhánh Hoàng Mai', { bold: true, after: 200 }),
  );

  // ===== Nội dung =====
  // Họ tên và đơn vị trên cùng một dòng (label + value)
  const nameLabel = 'Họ tên : ';
  const deptLabel = 'Đơn vị (phòng/ban): ';
  children.push(
    multiRunP([
      { text: nameLabel, bold: true },
      { text: creator.full_name || '..............................................' },
    ], { after: 120 }),
    multiRunP([
      { text: deptLabel, bold: true },
      { text: department.name || '..................................................' },
    ], { after: 200 }),
  );

  children.push(
    p('Thực hiện kế hoạch công tác đã được Ban lãnh đạo phê duyệt.', { after: 200 }),
    p('- Số lượng xe ô tô: 01 chiếc', { after: 120 }),
  );

  // Số người
  const numPeople = sortedParticipants.length;
  children.push(
    p(`- Số người sử dụng xe: ${zeroPad(numPeople)} người, gồm:`, { after: 120 }),
  );

  sortedParticipants.forEach((profile: any, idx: number) => {
    const h = honorific(profile.gender);
    const displayTitle = profile.title || (profile.role === 'director' ? 'Lãnh đạo' : 'Cán bộ');
    children.push(
      p(`${idx + 1}. ${h}${profile.full_name}  Chức vụ: ${displayTitle}`, { after: 60 }),
    );
  });

  // Thời gian — format theo mẫu: "+ Từ: 08 giờ 30 ngày 14 tháng 05 năm 2026"
  const d = new Date(schedule.start_time);
  const timeStr = `${zeroPad(d.getHours())} giờ ${zeroPad(d.getMinutes())} ngày ${zeroPad(d.getDate())} tháng ${zeroPad(d.getMonth() + 1)} năm ${d.getFullYear()}`;
  children.push(
    p(`- Thời gian: + Từ: ${timeStr}`, { after: 200 }),
  );

  // Nơi đến
  const destinations = schedule.metadata?.destinations;
  const location = destinations
    ? destinations.map((dd: any) => dd.location).filter(Boolean).join(', ')
    : schedule.location || '';
  children.push(
    p(`- Nơi đến công tác: ${location}`, { after: 120 }),
  );

  // Lý do
  const reason = schedule.title || '';
  const desc = schedule.description ? ` - ${schedule.description}` : '';
  children.push(
    p(`- Lý do công tác: ${reason}${desc}`, { after: 200 }),
  );

  // Ngày tháng
  const signingDate = vietnameseMonthDay(schedule.start_time);
  children.push(
    emptyP(60),
    new Paragraph({
      spacing: { after: 60 },
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: `Hà Nội, ${signingDate}`, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24, italics: true }),
      ],
    }),
  );

  // ===== Chữ ký — 3 cột (mẫu CHI NHÁNH HOÀNG MAI) =====
  const cellW = 2500;
  const labelOpts = { font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true };
  const sigTable = () =>
    new Table({
      rows: [
        new TableRow({
          children: [
            // Cột 1: XÁC NHẬN TRƯỞNG PHÒNG/BAN
            new TableCell({
              width: { size: cellW, type: WidthType.DXA },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'XÁC NHẬN TRƯỞNG PHÒNG/BAN', ...labelOpts })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'QUẢN LÝ CÁN BỘ', ...labelOpts })] }),
                new Paragraph({ spacing: { before: 400 }, children: [] }),
              ],
            }),
            // Cột 2: NGƯỜI ĐỀ NGHỊ
            new TableCell({
              width: { size: cellW, type: WidthType.DXA },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NGƯỜI ĐỀ NGHỊ', ...labelOpts })] }),
                new Paragraph({ spacing: { before: 400 }, children: [] }),
              ],
            }),
          ],
        }),
      ],
    });
  children.push(sigTable());
  children.push(emptyP(120));
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'PHÒNG TCTH', ...labelOpts })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'GIÁM ĐỐC DUYỆT', ...labelOpts })],
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

async function sendEmailWithAttachment(params: {
  to: string[];
  subject: string;
  text: string;
  attachmentBuffer: Buffer;
  filename: string;
}) {
  const { to, subject, text, attachmentBuffer, filename } = params;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error(
      'Thiếu cấu hình SMTP. Vui lòng đặt:\n'
      + 'SMTP_HOST (ví dụ: smtp-relay.brevo.com)\n'
      + 'SMTP_PORT (ví dụ: 587)\n'
      + 'SMTP_USER (email gửi)\n'
      + 'SMTP_PASS (SMTP key/password)'
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: '"Workflow - Chi nhánh Hoàng Mai" <workflow.cn136@gmail.com>',
    to: to.join(', '),
    subject,
    text,
    attachments: [{ filename, content: attachmentBuffer }],
  });
}

export async function POST(request: Request) {
  console.log('[VEHICLE-REQUEST] POST handler called, checking env:', {
    SMTP_HOST: process.env.SMTP_HOST ? 'set' : 'unset',
    SMTP_USER: process.env.SMTP_USER ? 'set' : 'unset',
    SMTP_PASS: process.env.SMTP_PASS ? 'set' : 'unset',
  });
  try {
    const { scheduleId, recipients, profileIds } = await request.json();

    if (!scheduleId) {
      return NextResponse.json({ success: false, error: 'Thiếu scheduleId' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Thiếu cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: schedule, error } = await supabase
      .from('schedules')
      .select(SCHEDULE_SELECT)
      .eq('id', scheduleId)
      .single();

    if (error || !schedule) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Không tìm thấy lịch trình' },
        { status: 404 }
      );
    }

    if (schedule.type !== 'trip') {
      return NextResponse.json(
        { success: false, error: 'Chỉ hỗ trợ xuất giấy đề nghị xe cho lịch công tác' },
        { status: 400 }
      );
    }

    // Generate docx
    const docxBuffer = await generateVehicleRequestDocx(schedule);

    // Determine recipients: từ profileIds + recipients (manual email)
    let toList: string[] = [];

    // 1. Resolve emails from profileIds via auth.users (service_role key)
    if (profileIds && Array.isArray(profileIds) && profileIds.length > 0) {
      try {
        // Use Supabase Auth Admin API to get user emails
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) throw authError;

        if (authData?.users) {
          const emailMap = new Map<string, string>();
          for (const u of authData.users) {
            if (u.email) emailMap.set(u.id, u.email);
          }
          toList = profileIds.map((id: string) => emailMap.get(id)).filter(Boolean);
        }
      } catch (err: any) {
        console.error('[VEHICLE-REQUEST] Error fetching user emails:', err);
        throw new Error('Không thể lấy email người nhận từ hệ thống.');
      }
    }

    // 2. Merge manually typed recipients
    if (recipients && Array.isArray(recipients) && recipients.length > 0) {
      const manualEmails = recipients.filter((e: string) => e.trim());
      toList = [...toList, ...manualEmails];
    }

    // 3. Deduplicate
    toList = Array.from(new Set(toList));

    // 4. Fallback: SMTP_RECIPIENT env var
    if (toList.length === 0 && process.env.SMTP_RECIPIENT) {
      toList = process.env.SMTP_RECIPIENT.split(',').map((s: string) => s.trim());
    }

    if (toList.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'Đã tạo file docx thành công. Không có người nhận email nào được cấu hình.',
          requiresRecipient: true,
        },
        { status: 200 }
      );
    }

    const creator = schedule.creator || {};
    const startFmt = formatDateTime(schedule.start_time);
    const subject = `Giấy đề nghị sử dụng xe - ${creator.full_name || ''} - ${startFmt.date}`;
    const text = `Kính gửi Ban Giám đốc,\n\nĐề nghị phê duyệt sử dụng xe cho chuyến công tác:\n`
      + `- Người đề nghị: ${creator.full_name || ''}\n`
      + `- Thời gian: ${startFmt.full}\n`
      + `- Địa điểm: ${schedule.location || ''}\n`
      + `- Lý do: ${schedule.title || ''}\n\nFile đính kèm: Giấy đề nghị sử dụng xe.`;

    await sendEmailWithAttachment({
      to: toList,
      subject,
      text,
      attachmentBuffer: docxBuffer,
      filename: `Giay_de_nghi_xe_${format(new Date(schedule.start_time), 'yyyyMMdd_HHmm')}.docx`,
    });

    return NextResponse.json({ success: true, message: 'Đã gửi email thành công' });
  } catch (error: any) {
    console.error('Export vehicle request error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi không xác định' },
      { status: 500 }
    );
  }
}
