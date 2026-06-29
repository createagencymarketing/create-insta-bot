// Instagram DM automation — Create Branding
// Official Instagram Messaging API (Graph API v21.0) + Claude brain + Google Sheets CRM
// Node 18+ (global fetch). Deploy on any HTTPS host (Render / Railway / VPS).

import express from "express";
const app = express();
app.use(express.json());

const {
  VERIFY_TOKEN,          // أي نص سري تخترعه — لازم يطابق اللي بتحطه بإعداد Webhook
  IG_TOKEN,              // Instagram/Page access token
  ANTHROPIC_API_KEY,     // مفتاح Claude API
  SHEETS_WEBHOOK_URL,    // رابط Google Apps Script web app (انظر append-to-sheet.gs)
  PORT = 3000,
} = process.env;

const DEMO = "https://id-preview--3de624f6-c149-49ae-bd64-c3d619e28306.lovable.app";

const SYSTEM = `أنت مساعد ذكي للردّ على رسائل إنستغرام (DM) لوكالة "Create Branding" — تصميم وبناء مواقع للمصالح في شمال البلاد، صاحبها باسل.
دورك: تحويل المهتم إلى حجز مكالمة أو إرسال نموذج موقع (ديمو)، والإجابة على الأسئلة الشائعة.
قواعد: لهجة شامية ودّية ومختصرة (جملة-جملتين). ما تضغط وما توعد بإشي مش مؤكد. ما تخترع إنه عملنا إلهم موقع. الأسعار تقريبية: موقع تعريفي يبدأ ~₪1500، وللعرض الدقيق ادفع لمكالمة قصيرة.
أرجع JSON فقط بدون أي نص إضافي:
{"intent":"greeting|price|example|timeline|services|ready_to_book|objection|other","reply":"الردّ بالعربي","action":"send_demo|book_meeting|answer|handoff|none","sector":"beauty|restaurant|retail|realestate|other|unknown"}`;

// ذاكرة محادثة بسيطة بالـ RAM (للإنتاج استبدلها بقاعدة بيانات)
const convos = new Map();

// 1) التحقق من الويبهوك (Meta بتطلبه مرة عند الإعداد)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

// 2) استقبال الرسائل
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // أكّد الاستلام فوراً
  try {
    for (const entry of req.body.entry || []) {
      for (const ev of entry.messaging || []) {
        const igsid = ev.sender?.id;
        const text = ev.message?.text;
        if (!igsid || !text || ev.message?.is_echo) continue;
        await handleMessage(igsid, text);
      }
    }
  } catch (e) { console.error("webhook error", e); }
});

async function handleMessage(igsid, text) {
  const history = convos.get(igsid) || [];
  history.push({ role: "user", content: text });

  const brain = await callBrain(history);
  await sendIG(igsid, brain.reply);
  if (brain.action === "send_demo") await sendIG(igsid, `تفضّل شوف نموذج موقع عملناه 👇\n${DEMO}`);

  history.push({ role: "assistant", content: brain.reply });
  convos.set(igsid, history.slice(-12)); // احتفظ بآخر 12 رسالة

  // سجّل/حدّث بالـ CRM
  await logToSheet({ igsid, message: text, intent: brain.intent, action: brain.action, sector: brain.sector, reply: brain.reply });
}

// 3) العقل — Claude
async function callBrain(history) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: SYSTEM, messages: history }),
    });
    const data = await r.json();
    const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error("brain error", e);
    return { intent: "other", reply: "أهلين! بساعدك تعمل موقع لمصلحتك. شو نوع شغلك؟", action: "answer", sector: "unknown" };
  }
}

// 4) إرسال رسالة إنستغرام (نافذة 24 ساعة)
async function sendIG(igsid, text) {
  try {
    await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${IG_TOKEN}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: { id: igsid }, message: { text } }),
    });
  } catch (e) { console.error("send error", e); }
}

// 5) تسجيل بالـ CRM عبر Google Apps Script
async function logToSheet(row) {
  if (!SHEETS_WEBHOOK_URL) return;
  try {
    await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row),
    });
  } catch (e) { console.error("sheet error", e); }
}

app.get("/", (_, res) => res.send("Create Branding IG bot is running ✅"));
app.listen(PORT, () => console.log("listening on " + PORT));
