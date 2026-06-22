const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle
} = require('docx');
const fs = require('fs');

const creator = { full_name: 'Lê Thị Minh Huyền', title: 'Cán bộ QHKHDN', role: 'staff', gender: 'female' };
const department = { name: 'Phòng KHDN' };
const participants = [
  { profile: { full_name: 'Lương Thị Như Quỳnh', title: 'Phó giám đốc', role: 'director', gender: 'female' } },
  { profile: { full_name: 'Nguyễn Thị Thu Hương', title: 'Trưởng Phòng KHDN', role: 'manager', gender: 'female' } },
  { profile: { full_name: 'Lê Thị Minh Huyền', title: 'Cán bộ QHKHDN', role: 'staff', gender: 'female' } },
];
const start_time = '2026-05-14T08:30:00';
const location = '21 Lê Đức Thọ';
const title = 'Chúc mừng sinh nhật Giám đốc công ty HTSC';
const description = '';

function honorific(gender) { if (gender === 'male') return 'Ông '; if (gender === 'female') return 'Bà '; return ''; }
function zeroPad(n, len) { return n.toString().padStart(len, '0'); }

function multiRunP(runs, options = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? 120, before: options.before ?? 0 },
    alignment: options.alignment ?? AlignmentType.LEFT,
    indent: options.indent,
    children: runs.map(r => new TextRun({
      text: r.text,
      font: { name: 'Times New Roman', hint: 'eastAsia' },
      size: r.size ?? 24,
      bold: r.bold ?? false,
      italics: r.italics ?? false,
      underline: r.underline ?? false,
    })),
  });
}

function p(text, options = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? 120, before: options.before ?? 0 },
    alignment: options.alignment ?? AlignmentType.LEFT,
    indent: options.indent,
    children: [new TextRun({
      text,
      font: { name: 'Times New Roman', hint: 'eastAsia' },
      size: options.size || 24,
      bold: options.bold ?? false,
      italics: options.italics ?? false,
      underline: options.underline ?? false,
    })],
  });
}

function emptyP(h) {
  return new Paragraph({
    spacing: { after: 0, before: 0 },
    children: [new TextRun({ text: '', size: h || 24 })],
  });
}

const children = [];

// ===== HEADER =====
children.push(
  new Paragraph({
    spacing: { after: 0 },
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: 'NGÂN HÀNG TMCP CÔNG THƯƠNG', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true })],
  }),
  new Paragraph({
    spacing: { after: 0 },
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: 'VIỆT NAM', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true })],
  }),
  emptyP(60),
  new Paragraph({
    spacing: { after: 0 },
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true })],
  }),
  new Paragraph({
    spacing: { after: 0 },
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, italics: true })],
  }),
  new Paragraph({
    spacing: { after: 0 },
    alignment: AlignmentType.RIGHT,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1 } },
    children: [new TextRun({ text: '                                               ', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22 })],
  }),
  emptyP(80),
  new Paragraph({
    spacing: { after: 0 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'CHI NHÁNH HOÀNG MAI', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true })],
  }),
  emptyP(120),
  new Paragraph({
    spacing: { after: 120 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'GIẤY ĐỀ NGHỊ SỬ DỤNG XE', font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 28, bold: true, underline: { type: 'single' } })],
  }),
);

// ===== Kính gửi =====
children.push(
  p('Kính gửi: Ban Giám đốc Chi nhánh Hoàng Mai', { bold: true, after: 200 }),
);

// ===== Nội dung =====
children.push(
  multiRunP([
    { text: 'Họ tên : ', bold: true },
    { text: creator.full_name },
  ], { after: 120 }),
  multiRunP([
    { text: 'Đơn vị (phòng/ban): ', bold: true },
    { text: department.name },
  ], { after: 200 }),
  p('Thực hiện kế hoạch công tác đã được Ban lãnh đạo phê duyệt.', { after: 200 }),
  p('- Số lượng xe ô tô: 01 chiếc', { after: 120 }),
);

// Số người
const sorted = [...participants].map(p => p.profile);
const numPeople = sorted.length;
children.push(p(`- Số người sử dụng xe: ${zeroPad(numPeople, 2)} người, gồm:`, { after: 120 }));

sorted.forEach((profile, idx) => {
  const h = honorific(profile.gender);
  const displayTitle = profile.title || (profile.role === 'director' ? 'Lãnh đạo' : 'Cán bộ');
  children.push(p(`${idx + 1}. ${h}${profile.full_name}  Chức vụ: ${displayTitle}`, { after: 60 }));
});

// Thời gian
const d = new Date(start_time);
const timeStr = `${zeroPad(d.getHours(), 2)} giờ ${zeroPad(d.getMinutes(), 2)} ngày ${zeroPad(d.getDate(), 2)} tháng ${zeroPad(d.getMonth() + 1, 2)} năm ${d.getFullYear()}`;
children.push(p(`- Thời gian: + Từ: ${timeStr}`, { after: 200 }));

// Nơi đến
children.push(p(`- Nơi đến công tác: ${location}`, { after: 120 }));

// Lý do
children.push(
  p(`- Lý do công tác: ${title}${description ? ` - ${description}` : ''}`, { after: 200 }),
);

// Ngày tháng ký
const signingDate = `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
children.push(
  emptyP(60),
  new Paragraph({
    spacing: { after: 60 },
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: `Hà Nội, ${signingDate}`, font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 24, italics: true })],
  }),
);

// Chữ ký - bảng 2 cột
const cellW = 2500;
const labelOpts = { font: { name: 'Times New Roman', hint: 'eastAsia' }, size: 22, bold: true };
children.push(new Table({
  rows: [
    new TableRow({
      children: [
        new TableCell({
          width: { size: cellW, type: WidthType.DXA },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'XÁC NHẬN TRƯỞNG PHÒNG/BAN', ...labelOpts })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'QUẢN LÝ CÁN BỘ', ...labelOpts })] }),
            new Paragraph({ spacing: { before: 400 }, children: [] }),
          ],
        }),
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
}));

children.push(emptyP(120));
children.push(
  new Paragraph({ spacing: { after: 40 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PHÒNG TCTH', ...labelOpts })] }),
  new Paragraph({ spacing: { after: 40 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'GIÁM ĐỐC DUYỆT', ...labelOpts })] }),
);

const doc = new Document({
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children,
  }],
});

async function main() {
  const buf = await Packer.toBuffer(doc);
  const outPath = 'D:/Antigravity/136HUB/WorkFlow/_test-output.docx';
  fs.writeFileSync(outPath, buf);
  console.log('✅ Generated: ' + outPath);
}
main().catch(console.error);
