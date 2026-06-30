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
const WHATSAPP = "https://wa.me/972543272340";

// ردود لما الزبون يبعت صوت/صورة/ملف بدل نص (ManyChat ما بيعطينا المحتوى)
const VOICE_REPLY = `أهلين! وصلني تسجيل صوتي 🎤 ما بقدر أسمعه هون للأسف. ممكن تكتبلي طلبك بسرعة لأرد عليك فوراً؟\nوإذا بتفضّل تحكي صوتي، تواصل معنا واتساب مباشر 👇\n${WHATSAPP}`;
const IMAGE_REPLY = `أهلين! وصلتني صورة 📷 لو إلها علاقة بمشروعك حابب تشرحلي بالكتابة شو بتحتاج؟\nأو تواصل معنا واتساب مباشر ونكمّل هناك 👇\n${WHATSAPP}`;
const OTHER_MEDIA_REPLY = `أهلين! وصلني ملف ما بقدر أفتحه هون 🙏 ممكن تكتبلي طلبك بسرعة؟\nأو تواصل واتساب مباشر 👇\n${WHATSAPP}`;

// بيحدّد رد حسب نوع الرسالة لما ما يكون في نص
function nonTextReply(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("audio") || t.includes("voice")) return VOICE_REPLY;
  if (t.includes("image") || t.includes("photo") || t.includes("picture")) return IMAGE_REPLY;
  return OTHER_MEDIA_REPLY;
}

const SYSTEM = `إنت مساعد ذكي للرد على رسائل إنستغرام (DM) لوكالة "Create Branding" — استوديو إبداعي بشمال البلاد بيخدم الأعمال المحلية (تصميم، مواقع، سوشال ميديا، صور وفيديو AI, أتمتة).

دورك: ترد بسرعة وبقيمة، تجمع lead (اسم + نوع المشروع)، وتحوّل المهتم الجاد للواتساب المباشر.

نبرتك: لهجة شامية ودية ومختصرة (جملة-جملتين). ما تضغط، ما توعد بمواعيد تسليم، ما تخترع خدمات أو أسعار مش مذكورة.

مهم جداً: جاوب على سؤال الزبون مباشرة. لو سأل عن الأسعار اعطيه الأسعار، لو سأل عن الخدمات عددها له. ما تكرر نفس سؤال "شو نوع شغلك" إذا الزبون سأل سؤال واضح.

الأسعار (قُلها بس إذا سأل):
- تصميم لوجو: ١٣٠٠ شيكل (٣ اقتراحات)
- هوية بصرية كاملة: ابتداءً من ٢٥٠٠ شيكل
- بوست سوشال ميديا: ١٠٠ شيكل للبوست / ١٠ بوستات بـ ٦٥٠ شيكل
- صفحة هبوط: ١٨٠٠ شيكل
- موقع تعريفي: ٦٠٠٠ شيكل
- متجر إلكتروني: ابتداءً من ٧٥٠٠ شيكل
- إدارة سوشال ميديا: ابتداءً من ١٨٠٠ شيكل بالشهر
- صورة AI: ١٥٠ شيكل
- فيديو AI ٣٠ ثانية مع مونتاج: ٨٠٠ شيكل / فيديو دقيقة: ١٣٠٠ شيكل
- أتمتة/بوت: حسب المشروع — اسأله شو بدّه الأتمتة تعمل وحوّله للواتساب

لما الزبون يصير جاد (سأل سعر، قال بدّي أبدأ): حوّله للواتساب المباشر: ${WHATSAPP}

أرجع JSON بس بدون أي نص إضافي وبدون علامات markdown:
{"intent":"greeting|price|example|timeline|services|ready_to_book|objection|other","reply":"الرد بالعربي","action":"send_demo|book_meeting|answer|handoff|none","sector":"beauty|restaurant|retail|realestate|other|unknown"}`;

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
        if (!igsid || ev.message?.is_echo) continue;
        const text = ev.message?.text;
        // لو الرسالة مش نص (صوت/صورة/attachment) → رد لطيف حسب النوع
        if (!text) {
          const att = ev.message?.attachments?.[0];
          if (att) await sendIG(igsid, nonTextReply(att.type));
          continue;
        }
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
    const clean = raw.replace(/```json|```/g, "").trim();

    // جرّب تلقط الـ JSON من أي مكان بالرد (حتى لو محاط بكلام)
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed && parsed.reply) return parsed;
      } catch (_) { /* بنكمّل للحل الاحتياطي تحت */ }
    }

    // ما في JSON صالح؟ استعمل النص اللي رجّعه Claude نفسه كرد (البوت ما بيقف ولا بيكرر نفسه)
    return { intent: "other", reply: clean || "أهلين! كيف بقدر أساعدك؟ 😊", action: "none", sector: "unknown" };
  } catch (e) {
    console.error("brain error", e);
    return { intent: "other", reply: "أهلين! كيف بقدر أساعدك؟ احكيلي شو بتدوّر عليه 😊", action: "answer", sector: "unknown" };
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

// ====== مسار ManyChat ======
// ManyChat بيبعت POST فيه رسالة المستخدم، والسيرفر بيرجّع الردّ مباشرة بصيغة JSON.
// بـ ManyChat: External Request → Method POST → Body JSON:
//   {"id":"{{user_id}}","text":"{{last_input_text}}","type":"{{last_reply_type}}"}
// والردّ بيرجع فيه version+content (Dynamic Block) + bot_reply (لخطوة Send Message اليدوية).
app.post("/manychat", async (req, res) => {
  try {
    const id = String(req.body.id || req.body.subscriber_id || "anon");
    const text = (req.body.text || req.body.message || "").toString().trim();
    const type = (req.body.type || "").toString().toLowerCase();

    // لو النوع مش نص (صوت/صورة/فيديو)، أو ما في نص أصلاً → رد لطيف حسب النوع
    const isNonText = (type && !text.length) ||
                      type.includes("audio") || type.includes("voice") ||
                      type.includes("image") || type.includes("photo") ||
                      type.includes("video") || type.includes("file") || type.includes("attachment");
    if (isNonText || !text) {
      const reply = nonTextReply(type);
      logToSheet({ igsid: id, message: `[${type || "media"}]`, intent: "non_text", action: "ask_to_type", sector: "unknown", reply });
      return res.json(mcReply(reply));
    }

    const history = convos.get(id) || [];
    history.push({ role: "user", content: text });

    const brain = await callBrain(history);
    history.push({ role: "assistant", content: brain.reply });
    convos.set(id, history.slice(-12));

    // سجّل بالـ CRM (ما بيوقف الردّ)
    logToSheet({ igsid: id, message: text, intent: brain.intent, action: brain.action, sector: brain.sector, reply: brain.reply });

    // ابنِ الردّ: نص + (لو لازم) رابط الديمو كرسالة ثانية
    const messages = [{ type: "text", text: brain.reply }];
    if (brain.action === "send_demo") {
      messages.push({ type: "text", text: `تفضّل شوف نموذج موقع عملناه 👇\n${DEMO}` });
    }
    // bot_reply: عشان خطوة Send Message بـ ManyChat تلاقي الحقل وتعرضه
    return res.json({ version: "v2", content: { messages }, bot_reply: brain.reply });
  } catch (e) {
    console.error("manychat error", e);
    return res.json(mcReply("أهلين! كيف بقدر أساعدك؟ احكيلي شو بتدوّر عليه 😊"));
  }
});

function mcReply(text) {
  return { version: "v2", content: { messages: [{ type: "text", text }] }, bot_reply: text };
}

app.get("/", (_, res) => res.send("Create Branding IG bot is running ✅"));
app.listen(PORT, () => console.log("listening on " + PORT));
