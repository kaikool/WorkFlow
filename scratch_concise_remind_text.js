const fs = require('fs');
const filePath = 'd:/PHUCTD/WorkFlow-main/src/app/dashboard/tasks/[id]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldContentText = "content: `${profile?.full_name} yêu cầu hoàn thành khẩn cấp báo cáo \"${task.title}\" của phòng ${r.departments?.name || 'phòng ban'}`";
const newContentText = "content: `Yêu cầu ${r.departments?.name || 'phòng ban'} khẩn trương hoàn thành báo cáo \"${task.title}\".`";

if (content.includes(oldContentText)) {
  content = content.replace(oldContentText, newContentText);
  console.log("Successfully simplified reminder notification content!");
} else {
  console.log("Could not find exact text, searching via index.");
  const idx = content.indexOf('const handleSendReminderAll = async');
  if (idx !== -1) {
    const contentLineIdx = content.indexOf('content: ', idx);
    if (contentLineIdx !== -1) {
      const endLineIdx = content.indexOf('\n', contentLineIdx);
      const fullLine = content.substring(contentLineIdx, endLineIdx);
      content = content.replace(fullLine, "content: `Yêu cầu ${r.departments?.name || 'phòng ban'} khẩn trương hoàn thành báo cáo \"${task.title}\".`,");
      console.log("Successfully replaced line via index!");
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Completed scratch_concise_remind_text script!");
