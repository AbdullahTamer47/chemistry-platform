The omitted route body means local variable names must be assumed. Below uses `sessionQuestions`, `attemptId`, and your existing grading variables. **`serverTimeSpent` must be calculated in seconds from the persisted session start—not `req.body.time_spent`.**

This uses **log-only enforcement**, keeping stored scores, ranks, and pass status consistent. Optional server-owned `concept_key` values select curated feedback; otherwise, the official explanation provides question-specific reinforcement.

```javascript
// SECTION 1: After existing grading, before persisting the attempt.
// serverTimeSpent must be an unrounded, server-calculated duration.
if (!Number.isFinite(serverTimeSpent) || serverTimeSpent < 0) {
  console.error("exam_session_timer_invalid", {
    exam_id: req.params.id
  });

  return res.status(409).json({
    error: "تعذّر التحقق من زمن جلسة الامتحان."
  });
}

const nonEmptyText = (value) =>
  typeof value === "string" ? value.trim() : "";

const feedbackByConcept = new Map([
  ["iron_oxidation", {
    concept_reinforcement:
      "تتبّع عدد أكسدة الحديد قبل موازنة التفاعل. ميّز بين FeO وFe₂O₃ وFe₃O₄؛ الأخير يحتوي على الحديد بحالتي الأكسدة +2 و+3.",
    learning_action:
      "راجع معادلات أكسدة الحديد واختزاله، واكتب أعداد الأكسدة ثم أعد موازنة المعادلة."
  }],
  ["limiting_reagent", {
    concept_reinforcement:
      "وازن المعادلة ثم حوّل كميات المتفاعلات إلى مولات. قارن عدد المولات مقسوماً على معامل كل متفاعل؛ القيمة الأصغر تحدّد المادة المحدِّدة للتفاعل.",
    learning_action:
      "أعد حساب عدد مولات المادة المحدِّدة للتفاعل، ثم احسب كمية الناتج باستخدام معاملات المعادلة."
  }],
  ["stoichiometry", {
    concept_reinforcement:
      "ابدأ بالعلاقة n = m / M، ثم استخدم النسب المولية من المعادلة الموزونة. لا تقارن الكتل مباشرةً دون تحويلها إلى مولات.",
    learning_action:
      "راجع حساب الكتلة المولية، وأعد الحل مع كتابة الوحدات في كل خطوة، ثم حل مسألتين على النسب المولية."
  }],
  ["redox", {
    concept_reinforcement:
      "الأكسدة فقد إلكترونات وزيادة عدد الأكسدة، والاختزال اكتساب إلكترونات وانخفاض عدد الأكسدة. العامل المؤكسِد يُختزل والعامل المختزِل يتأكسد.",
    learning_action:
      "حدّد أعداد الأكسدة والعاملين المؤكسِد والمختزِل، ثم اكتب نصفي التفاعل ووازن الإلكترونات."
  }],
  ["chemical_equilibrium", {
    concept_reinforcement:
      "ميّز بين تغيّر موضع الاتزان وتغيّر ثابت الاتزان؛ عند ثبات درجة الحرارة لا تتغيّر قيمة K. لا تدخل المواد الصلبة والسوائل النقية في تعبير ثابت الاتزان.",
    learning_action:
      "اكتب تعبير ثابت الاتزان من المعادلة الموزونة، ثم راجع أثر التغيّر المطلوب باستخدام مبدأ لوشاتلييه."
  }],
  ["electrochemistry", {
    concept_reinforcement:
      "الأكسدة تحدث عند الأنود والاختزال عند الكاثود. ميّز بين الخلية الجلفانية وخلية التحليل الكهربائي عند تحديد إشارات الأقطاب.",
    learning_action:
      "ارسم الخلية وحدّد الأنود والكاثود واتجاه انتقال الإلكترونات، ثم اكتب تفاعل كل قطب."
  }],
  ["qualitative_analysis", {
    concept_reinforcement:
      "اربط الأيون بالكاشف وشروط الاختبار والملاحظة الناتجة؛ لون الراسب وحده قد لا يكفي للتمييز بين الأيونات.",
    learning_action:
      "راجع جدول الكواشف والاختبارات التأكيدية للأيون المطلوب، واكتب المعادلة الأيونية للاختبار."
  }],
  ["organic_reactions", {
    concept_reinforcement:
      "حدّد المجموعة الوظيفية أولاً، ثم اربط نوع الكاشف وشروط التفاعل بالتحوّل العضوي المطلوب؛ اسم المركب وحده لا يحدّد الناتج.",
    learning_action:
      "راجع تفاعلات المجموعة الوظيفية في السؤال، واكتب المتفاعل والكاشف والشروط والناتج، ثم حل سؤالاً مشابهاً."
  }]
]);

// Use canonical server-issued questions, not client-submitted question data.
const questionById = new Map(
  sessionQuestions.map((question) => [String(question.id), question])
);

const enhancedResults = results.map((result) => {
  // Leave correct answers and their grading fields unchanged.
  if (result.is_correct !== false) {
    return result;
  }

  const question = questionById.get(String(result.question_id)) || {};
  const conceptKey = (
    nonEmptyText(question.concept_key) ||
    nonEmptyText(result.concept_key)
  ).toLowerCase();

  const feedback = feedbackByConcept.get(conceptKey);
  const explanation =
    nonEmptyText(question.explanation) ||
    nonEmptyText(result.explanation);

  const topic =
    nonEmptyText(question.topic) ||
    nonEmptyText(result.topic);

  const fallbackReinforcement = explanation
    ? `ركّز على الفكرة الكيميائية في الحل النموذجي: ${explanation}`
    : topic
      ? `راجع قاعدة «${topic}» واربط معطيات هذا السؤال بالمطلوب قبل اختيار الإجابة.`
      : "راجع القاعدة الكيميائية التي يختبرها هذا السؤال، وحدّد المعطيات والمطلوب قبل إعادة الحل.";

  const fallbackAction = topic
    ? `راجع درس «${topic}»، ثم أعد حل هذا السؤال دون النظر للإجابة وحل سؤالين على الفكرة نفسها.`
    : "راجع الحل النموذجي لهذا السؤال، ثم أعد حله دون النظر للإجابة وحل سؤالين على الفكرة نفسها.";

  return {
    ...result,
    // Preserve authored feedback; fill missing or whitespace-only values.
    concept_reinforcement:
      nonEmptyText(result.concept_reinforcement) ||
      nonEmptyText(question.concept_reinforcement) ||
      feedback?.concept_reinforcement ||
      fallbackReinforcement,
    learning_action:
      nonEmptyText(result.learning_action) ||
      nonEmptyText(question.learning_action) ||
      feedback?.learning_action ||
      fallbackAction
  };
});

// Keep the existing attempt persistence and rank calculation.
// If results are persisted, serialize enhancedResults instead of results.

// SECTION 2: Replace the final successful submission response block.
const speedWarning =
  sessionQuestions.length >= 10 && serverTimeSpent < 15;

if (speedWarning) {
  // Log a timing anomaly, not a definitive cheating accusation.
  // Do not log submitted answers or the entire request body.
  console.warn("exam_speed_warning", {
    exam_id: req.params.id,
    attempt_id: attemptId,
    question_count: sessionQuestions.length,
    server_time_spent_seconds: serverTimeSpent
  });
}

return res.json({
  attempt_id: attemptId,
  score,
  earned_points: earnedPoints,
  total_points: totalPoints,
  results: enhancedResults,
  rank,
  passed,
  speed_warning: speedWarning
});
```

Retain any additional fields from your existing response. For reliably targeted feedback, populate `concept_key` or an official explanation for every server-side question.