# Create Branding — بوت إنستغرام (Instagram Messaging API الرسمي)

يستقبل رسائل DM → يفهمها بعقل Claude → يردّ بالعربي → يرسل ديمو → يسجّل بالـ CRM (Google Sheets).

## المتطلبات (مرة وحدة)
1. حساب Instagram **Business/Creator** مربوط بصفحة فيسبوك.
2. App على developers.facebook.com (نوع Business) + منتج **Instagram**.
3. صلاحيات: `instagram_business_basic` + `instagram_business_manage_messages`.
4. **للتجربة:** تقدر تضيف لحد 25 مستخدم تجريبي (Roles → Testers) وتشتغل **بدون App Review**.
   **للإنتاج (ناس حقيقيين):** قدّم `instagram_business_manage_messages` لـ App Review.

## التشغيل
```bash
npm install
# عيّن المتغيّرات:
#   VERIFY_TOKEN=أي_نص_سري
#   IG_TOKEN=توكن_الصفحة/إنستا
#   ANTHROPIC_API_KEY=مفتاح_Claude
#   SHEETS_WEBHOOK_URL=رابط_Apps_Script
npm start
```
انشره على Render / Railway / VPS (لازم HTTPS عام).

## إعداد الـ Webhook بـ Meta
- Callback URL = `https://YOUR_DOMAIN/webhook`
- Verify Token = نفس `VERIFY_TOKEN`
- اشترك بحقل **messages** تحت Instagram webhooks.

## الـ CRM
انسخ `append-to-sheet.gs` بشيت الـ CRM (Apps Script) وانشره كـ Web app، وحط رابطه بـ `SHEETS_WEBHOOK_URL`.

## قاعدة الـ 24 ساعة
تقدر تردّ بحرية خلال 24 ساعة من آخر رسالة بعتها الزبون. ما في إرسال بارد عبر الـ API.

تصميم: Create Branding
