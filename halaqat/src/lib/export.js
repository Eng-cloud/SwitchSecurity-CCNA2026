/**
 * تصدير التقارير — CSV و Word و PDF.
 *
 * القاعدة هنا صراحة لا ادّعاء: نُخرج ما نستطيع إخراجه فعلًا في المتصفح
 * بلا مكتبات، ونسمّي كلَّ صيغة بما هي:
 *  - CSV: ملفٌّ يفتحه Excel مباشرة (مع BOM حتى تظهر العربية سليمة).
 *  - Word: مستند HTML بترويسة Word، يفتحه Word ويحفظه .docx إن شاء.
 *  - PDF: عبر حوار الطباعة ← «حفظ كـ PDF». توليد PDF حقيقي في المتصفح
 *    يحتاج مكتبة، ووعدُ زرٍّ لا يفي أسوأ من غيابه.
 */

/** يهرّب خلية CSV: الفاصلة وعلامة الاقتباس والسطر الجديد. */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // إمهال المتصفح ليبدأ التنزيل قبل إبطال الرابط.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** جدول HTML مشترك بين صيغتَي Word وما قد يليها. */
function tableHtml({ title, columns, rows, meta }) {
  const head = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeHtml(valueOf(row, column))}</td>`)
          .join('')}</tr>`,
    )
    .join('');

  return `<h1>${escapeHtml(title)}</h1>
${meta ? `<p>${escapeHtml(meta)}</p>` : ''}
<table border="1" cellspacing="0" cellpadding="6" dir="rtl">
<thead><tr>${head}</tr></thead>
<tbody>${body}</tbody>
</table>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function valueOf(row, column) {
  return typeof column.value === 'function' ? column.value(row) : (row[column.key] ?? '');
}

export function exportCsv({ filename, columns, rows }) {
  const lines = [
    columns.map((column) => csvCell(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(valueOf(row, column))).join(',')),
  ];
  // BOM: بدونه يقرأ Excel العربية حروفًا مشوّهة.
  const blob = new Blob([`﻿${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  download(blob, `${filename}.csv`);
}

export function exportWord({ filename, title, columns, rows, meta }) {
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="ar">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif">
${tableHtml({ title, columns, rows, meta })}
</body></html>`;

  const blob = new Blob([`﻿${html}`], { type: 'application/msword;charset=utf-8;' });
  download(blob, `${filename}.doc`);
}

/**
 * PDF عبر حوار الطباعة.
 * لا نولّد بايتات PDF: نفتح الحوار ونترك للمستخدم «حفظ كـ PDF»، وهو ما
 * يفعله عمليًّا، ولا نُوهمه بأننا أنشأنا الملف.
 */
export function exportPdf() {
  window.print();
}

/**
 * يشتق أعمدة التصدير من أعمدة الجدول.
 *
 * القيم الخام لا المنسّقة: Excel يريد رقمًا يجمعه لا نصًّا بأرقام عربية،
 * وعمود الإجراءات يسقط لأنه أزرارٌ لا بيانات.
 */
export function exportColumns(columns) {
  return columns
    .filter((column) => column.key !== 'actions')
    .map((column) => ({ key: column.key, header: column.header }));
}
