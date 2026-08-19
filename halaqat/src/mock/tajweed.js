/**
 * محتوى التجويد — أحكام مختصرة وأمثلتها.
 *
 * البيانات هنا ثابتة ومقروءة: هي المرجع الذي تُبنى عليه بطاقات قسم
 * التجويد وأسئلة اختباره معًا، فلا يفترق ما يُدرَّس عمّا يُختبر فيه.
 */

export const TAJWEED_CATEGORIES = [
  { id: 'noon', name: 'أحكام النون الساكنة والتنوين' },
  { id: 'meem', name: 'أحكام الميم الساكنة' },
  { id: 'madd', name: 'المدود' },
  { id: 'qalqalah', name: 'القلقلة' },
];

export const TAJWEED_RULES = [
  {
    id: 'idhhar',
    categoryId: 'noon',
    name: 'الإظهار',
    definition: 'إخراج النون الساكنة أو التنوين واضحةً من مخرجها بلا غنّة ظاهرة.',
    letters: 'ء هـ ع ح غ خ',
    example: 'مَنْ آمَنَ',
    exampleSurah: 'البقرة',
  },
  {
    id: 'idgham',
    categoryId: 'noon',
    name: 'الإدغام',
    definition: 'إدخال النون الساكنة أو التنوين في الحرف الذي بعدها فيصيران حرفًا مشدّدًا.',
    letters: 'ي ر م ل و ن',
    example: 'مَنْ يَعْمَلْ',
    exampleSurah: 'الزلزلة',
  },
  {
    id: 'iqlab',
    categoryId: 'noon',
    name: 'الإقلاب',
    definition: 'قلب النون الساكنة أو التنوين ميمًا مخفاةً بغنّة عند الباء.',
    letters: 'ب',
    example: 'مِنْ بَعْدِ',
    exampleSurah: 'البقرة',
  },
  {
    id: 'ikhfa',
    categoryId: 'noon',
    name: 'الإخفاء',
    definition: 'النطق بالنون الساكنة أو التنوين بصفةٍ بين الإظهار والإدغام مع الغنّة.',
    letters: 'ما بقي من الحروف',
    example: 'مِنْ شَرِّ',
    exampleSurah: 'الفلق',
  },
  {
    id: 'idghamMithlain',
    categoryId: 'meem',
    name: 'إدغام المتماثلين الصغير',
    definition: 'إدغام الميم الساكنة في ميمٍ بعدها مع الغنّة.',
    letters: 'م',
    example: 'لَهُمْ مَا',
    exampleSurah: 'البقرة',
  },
  {
    id: 'ikhfaShafawi',
    categoryId: 'meem',
    name: 'الإخفاء الشفوي',
    definition: 'إخفاء الميم الساكنة عند الباء مع الغنّة.',
    letters: 'ب',
    example: 'تَرْمِيهِمْ بِحِجَارَةٍ',
    exampleSurah: 'الفيل',
  },
  {
    id: 'maddTabee',
    categoryId: 'madd',
    name: 'المدّ الطبيعي',
    definition: 'مدُّ حرف المدّ حركتين إذا لم يأتِ بعده همزٌ ولا سكون.',
    letters: 'ا و ي',
    example: 'قَالَ',
    exampleSurah: 'يوسف',
  },
  {
    id: 'maddMuttasil',
    categoryId: 'madd',
    name: 'المدّ المتصل',
    definition: 'أن يأتي الهمز بعد حرف المدّ في كلمةٍ واحدة، فيُمدّ أربع حركات أو خمسًا.',
    letters: 'ء',
    example: 'جَاءَ',
    exampleSurah: 'النصر',
  },
  {
    id: 'qalqalahSughra',
    categoryId: 'qalqalah',
    name: 'القلقلة الصغرى',
    definition: 'اضطراب الحرف الساكن في وسط الكلمة حتى يُسمع له نبرة.',
    letters: 'ق ط ب ج د',
    example: 'يَجْعَلُونَ',
    exampleSurah: 'البقرة',
  },
  {
    id: 'qalqalahKubra',
    categoryId: 'qalqalah',
    name: 'القلقلة الكبرى',
    definition: 'قلقلة الحرف الموقوف عليه في آخر الكلمة، وهي أظهر من الصغرى.',
    letters: 'ق ط ب ج د',
    example: 'الْفَلَقْ',
    exampleSurah: 'الفلق',
  },
];

export function getRule(ruleId) {
  return TAJWEED_RULES.find((rule) => rule.id === ruleId) ?? null;
}

export function getCategory(categoryId) {
  return TAJWEED_CATEGORIES.find((category) => category.id === categoryId) ?? null;
}

/**
 * مقاطع وروابط البداية.
 *
 * تُبذر لتكون للقسم محتوى منذ أول فتح، وتُنسب إلى الإدارة العليا لأنها
 * الجهة الوحيدة التي تملك الإضافة — والنسبة في القائمة تُظهر ذلك.
 */
export function seedTajweedItems(nowIso) {
  const base = [
    {
      id: 'tajweed-1',
      ruleId: 'ikhfa',
      kind: 'clip',
      title: 'الإخفاء الحقيقي — شرح وتطبيق',
      url: 'https://example.org/tajweed/ikhfa.mp3',
      description: 'شرح مختصر لحروف الإخفاء مع أمثلة مقروءة من قصار السور.',
      durationLabel: '٦ دقائق',
    },
    {
      id: 'tajweed-2',
      ruleId: 'madd',
      kind: 'link',
      title: 'جدول المدود ومقاديرها',
      url: 'https://example.org/tajweed/madd-table',
      description: 'جدول يجمع أنواع المدّ ومقدار كلٍّ منها بالحركات.',
      durationLabel: null,
    },
    {
      id: 'tajweed-3',
      ruleId: 'qalqalahKubra',
      kind: 'clip',
      title: 'القلقلة الكبرى عند الوقف',
      url: 'https://example.org/tajweed/qalqalah.mp3',
      description: 'تطبيق عملي على الوقف بالقلقلة في أواخر الآيات.',
      durationLabel: '٤ دقائق',
    },
  ];

  return base.map((item) => ({
    ...item,
    // «مدود» ليست معرِّف حكم: نصحّحها إلى أول أحكام المدّ.
    ruleId: item.ruleId === 'madd' ? 'maddTabee' : item.ruleId,
    addedBy: 'user-admin',
    addedByName: 'سارة القحطاني',
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}
