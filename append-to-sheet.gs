// Google Apps Script — انسخه في Extensions → Apps Script داخل شيت الـ CRM
// ثم Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone
// خُد رابط الـ Web app وحطّه بمتغيّر SHEETS_WEBHOOK_URL بالسيرفر.
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const d = JSON.parse(e.postData.contents);
  const now = new Date();
  // أعمدة الشيت: التاريخ | الاسم | القطاع | البلد | تلفون | إنستغرام | المصدر | المرحلة | آخر تفاعل | موعد | ملاحظات
  sheet.appendRow([
    now, "", d.sector || "", "", "", d.igsid || "", "Instagram", "ردّ",
    now, "", (d.intent || "") + " | " + (d.reply || "")
  ]);
  return ContentService.createTextOutput("ok");
}
