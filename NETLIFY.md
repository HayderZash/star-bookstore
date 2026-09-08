# ربط متجر «مكتبة النجم» على Netlify

الموقع: https://star-bookstore.netlify.app/

## 1) متغيرات البيئة في Netlify
من لوحة Netlify: Site configuration → Environment variables → Add a variable،
أضف التالي ثم أعد النشر (Deploys → Trigger deploy → Clear cache and deploy site):

| الاسم | القيمة |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | توكن البوت من BotFather (بوت `@Star_Library_1_bot`) |
| `TELEGRAM_CHAT_ID` | `8080788386` |
| `ORDER_WEBHOOK_SECRET` | `9c10707d879862322d8dbf18916406f5dc76cf083a550c90` |
| `AI_PROXY_SECRET` | نفس القيمة المحفوظة في لوحة الإدارة ← إعدادات الذكاء (اختياري) |

ملاحظة: عنوان قاعدة البيانات والمفتاح العام مضمّنان في البناء تلقائياً،
فلا حاجة لإضافة أي متغير خاص بقاعدة البيانات.

## 2) كيف تصل إشعارات الطلبات
عند إنشاء أي طلب جديد ترسل قاعدة البيانات نداءً إلى:

```
POST https://star-bookstore.netlify.app/api/public/telegram/order
Header: x-webhook-secret: <ORDER_WEBHOOK_SECRET>
```

وتقوم دالة Netlify (`netlify/functions/telegram-order.mts`) بإرسال رسالة تيليكرام
تحتوي رقم الطلب واسم الزبون والهاتف والمحافظة والمنتجات والمجاميع.

العنوان والمفتاح محفوظان في إعدادات المتجر بالمفاتيح
`netlify_webhook_url` و `netlify_webhook_secret`، والمفتاح مخفي عن الزوار والزبائن.

## 3) الاختبار
1. أرسل `/start` للبوت مرة واحدة (تم بالفعل).
2. نفّذ طلباً تجريبياً من الموقع.
3. إن لم تصل رسالة: Netlify → Logs → Functions → `telegram-order` وتحقق من
   وجود المتغيرات الثلاثة أعلاه وتطابق قيمة `ORDER_WEBHOOK_SECRET`.
