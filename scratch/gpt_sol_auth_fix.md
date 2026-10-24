### 1) شرح مختصر بالعربية

في Vercel، ملف SQLite المحلي ليس قاعدة بيانات مشتركة بين حاويات Serverless؛ لذلك قد يكون JWT صحيحًا لكن المستخدم غير موجود في نسخة قاعدة البيانات الحالية. الحل المطلوب: التحقق من JWT أولًا، ثم استخدام بياناته إذا لم يوجد المستخدم محليًا. التوكن غير الصالح أو المنتهي يجب أن يظل مرفوضًا.

### 2) تعديل `server/middleware/auth.js`

استخدم `jwt` و`db` و`JWT_SECRET` الموجودين في مشروعك، مع الحفاظ على نفس إعدادات التحقق المستخدمة حاليًا:

```js
function resolveUser(token) {
  let decoded;

  try {
    // نفس السر المستخدم عند إصدار التوكن.
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    // توقيع غير صحيح، توكن منتهي، أو توكن غير صالح.
    return null;
  }

  if (
    !decoded ||
    typeof decoded !== 'object' ||
    decoded.id == null ||
    typeof decoded.role !== 'string'
  ) {
    return null;
  }

  const user = db
    .prepare('SELECT id, name, role, grade FROM users WHERE id = ?')
    .get(decoded.id);

  // Fallback فقط إذا كانت نتيجة الاستعلام null أو undefined.
  return user ?? {
    id: decoded.id,
    name: decoded.name,
    role: decoded.role,
    grade: decoded.grade,
  };
}
```

بهذا تكون النتيجة مستخدمًا أو `null`. في الـmiddleware:

```js
const user = resolveUser(token);

if (!user) {
  return res.status(401).json({
    error: 'جلسة غير صالحة - يرجى تسجيل الدخول مرة أخرى',
  });
}

req.user = user;
return next();
```

غياب الصف المحلي وحده لن يسبب `401`. أما أخطاء قاعدة البيانات فلا يجري إخفاؤها بهذا الـfallback.

### 3) معالجة `401` في `src/utils/api.js`

إذا كنت تستخدم `fetch`، أضف هذا داخل دالة الطلبات المشتركة، **مباشرة بعد الطلب وقبل قراءة `response.json()`**، مع إبقاء إعدادات الرابط وheaders الحالية:

```js
const response = await fetch(url, options);

if (response.status === 401) {
  localStorage.clear();
  window.location.hash = '#/login';

  // أوقف معالجة الاستجابة كأن الطلب نجح.
  throw new Error('انتهت الجلسة - يرجى تسجيل الدخول مرة أخرى');
}

// أكمل معالجة الحالات الأخرى وقراءة الاستجابة كما في الكود الحالي.
```

`localStorage.clear()` يمسح جميع بيانات الموقع؛ إذا أردت الحفاظ على التفضيلات، احذف مفاتيح المصادقة فقط بدلًا منه.

**تنبيه مهم:** هذا حل مؤقت لغياب المستخدم في SQLite المحلي، وليس حلًا لاستمرارية البيانات. كما أنه قد يُبقي توكن حساب محذوف أو محظور مقبولًا حتى انتهاء صلاحيته. الحل الإنتاجي هو قاعدة بيانات مشتركة ودائمة، مع آلية لإبطال الجلسات عند الحاجة.