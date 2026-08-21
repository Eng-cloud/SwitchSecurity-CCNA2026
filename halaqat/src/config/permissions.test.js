import { describe, expect, it } from 'vitest';
import { can, permissionsOf, searchScope, ACTIONS } from './permissions.js';

describe('مصفوفة الصلاحيات', () => {
  it('المصحف للطالب والمعلم وولي الأمر — لا للمشرف ولا للإدارة', () => {
    // أداة تعليم لا أداة إشراف: من دوره إداري أو إشرافي لا يحتاجها.
    for (const role of ['student', 'teacher', 'parent']) {
      expect(can(role, ACTIONS.QURAN_READ)).toBe(true);
    }
    for (const role of ['supervisor', 'admin']) {
      expect(can(role, ACTIONS.QURAN_READ)).toBe(false);
    }
  });

  it('الطباعة والتصدير للمشرف والإدارة فقط', () => {
    // المعلم يقرأ تقارير حلقته ولا يُخرجها من المنصة.
    for (const role of ['supervisor', 'admin']) {
      expect(can(role, ACTIONS.REPORTS_PRINT)).toBe(true);
    }
    for (const role of ['teacher', 'student', 'parent']) {
      expect(can(role, ACTIONS.REPORTS_PRINT)).toBe(false);
    }
  });

  it('المشرف يدير المعلمين والطلاب داخل حلقاته', () => {
    expect(can('supervisor', ACTIONS.TEACHERS_MANAGE)).toBe(true);
    expect(can('supervisor', ACTIONS.STUDENTS_MANAGE)).toBe(true);
  });

  it('إنشاء الحلقات وحذفها للإدارة وحدها، وإدارةُ القائم للمشرف معها', () => {
    // الحلقة كيانٌ في هيكل المنصة: بناؤه وهدمه قرارٌ إداري لا إشرافي.
    expect(can('admin', ACTIONS.CIRCLES_MANAGE)).toBe(true);
    for (const role of ['supervisor', 'teacher', 'student', 'parent']) {
      expect(can(role, ACTIONS.CIRCLES_MANAGE)).toBe(false);
    }

    // أمّا تعيين المعلم وضبط الموعد فإدارةٌ للقائم يشترك فيها المشرف.
    for (const role of ['admin', 'supervisor']) {
      expect(can(role, ACTIONS.CIRCLES_ASSIGN)).toBe(true);
    }
    for (const role of ['teacher', 'student', 'parent']) {
      expect(can(role, ACTIONS.CIRCLES_ASSIGN)).toBe(false);
    }
  });

  it('إدارة المستخدمين والمشرفين للإدارة وحدها', () => {
    expect(can('admin', ACTIONS.USERS_MANAGE)).toBe(true);
    expect(can('admin', ACTIONS.SUPERVISORS_MANAGE)).toBe(true);
    expect(can('supervisor', ACTIONS.USERS_MANAGE)).toBe(false);
    expect(can('supervisor', ACTIONS.SUPERVISORS_MANAGE)).toBe(false);
  });

  it('طلبات التسجيل: ولي الأمر ينشئ، والمشرف والإدارة يراجعان', () => {
    expect(can('parent', ACTIONS.ENROLLMENT_CREATE)).toBe(true);
    expect(can('supervisor', ACTIONS.ENROLLMENT_REVIEW)).toBe(true);
    expect(can('admin', ACTIONS.ENROLLMENT_REVIEW)).toBe(true);
    expect(can('parent', ACTIONS.ENROLLMENT_REVIEW)).toBe(false);
    expect(can('teacher', ACTIONS.ENROLLMENT_REVIEW)).toBe(false);
  });

  it('تعيين المساعد وتوكيله للمعلم وحده', () => {
    expect(can('teacher', ACTIONS.ASSISTANT_ASSIGN)).toBe(true);
    expect(can('teacher', ACTIONS.DELEGATION_MANAGE)).toBe(true);
    expect(can('student', ACTIONS.ASSISTANT_ASSIGN)).toBe(false);
    expect(can('student', ACTIONS.DELEGATION_MANAGE)).toBe(false);
    expect(can('supervisor', ACTIONS.ASSISTANT_ASSIGN)).toBe(false);
    expect(can('supervisor', ACTIONS.DELEGATION_MANAGE)).toBe(false);
    expect(can('admin', ACTIONS.ASSISTANT_ASSIGN)).toBe(false);
  });

  it('المعلم لا يملك صلاحيات المشرف — لا خلط بين الدورين', () => {
    // إضافة الطلاب وحذفهم للمشرف والإدارة، لا للمعلم.
    expect(can('teacher', ACTIONS.STUDENTS_MANAGE)).toBe(false);
    expect(can('teacher', ACTIONS.TEACHERS_MANAGE)).toBe(false);
    expect(can('teacher', ACTIONS.CIRCLES_MANAGE)).toBe(false);
    expect(can('teacher', ACTIONS.SUPERVISORS_MANAGE)).toBe(false);
    expect(can('teacher', ACTIONS.USERS_MANAGE)).toBe(false);
    expect(can('teacher', ACTIONS.ENROLLMENT_REVIEW)).toBe(false);
  });

  it('صلاحيات المعلم محصورة في حلقته', () => {
    expect(permissionsOf('teacher').sort()).toEqual(
      [
        ACTIONS.QURAN_READ,
        ACTIONS.ASSISTANT_ASSIGN,
        ACTIONS.DELEGATION_MANAGE,
        ACTIONS.DISTINGUISHED_VIEW,
        ACTIONS.TASKS_ASSIGN,
        ACTIONS.ATTENDANCE_RECORD,
        ACTIONS.COVERAGE_MANAGE,
        ACTIONS.TAJWEED_VIEW,
        ACTIONS.NOTES_WRITE,
      ].sort(),
    );
  });

  it('تعيين المهام للمعلم وحده — هو من يتابع طلابه', () => {
    expect(can('teacher', ACTIONS.TASKS_ASSIGN)).toBe(true);
    for (const role of ['student', 'supervisor', 'admin', 'parent']) {
      expect(can(role, ACTIONS.TASKS_ASSIGN)).toBe(false);
    }
  });

  it('متميزو الشهر للمعلم والمشرف والإدارة لا للطالب وولي الأمر', () => {
    expect(can('teacher', ACTIONS.DISTINGUISHED_VIEW)).toBe(true);
    expect(can('supervisor', ACTIONS.DISTINGUISHED_VIEW)).toBe(true);
    expect(can('admin', ACTIONS.DISTINGUISHED_VIEW)).toBe(true);
    expect(can('student', ACTIONS.DISTINGUISHED_VIEW)).toBe(false);
    expect(can('parent', ACTIONS.DISTINGUISHED_VIEW)).toBe(false);
  });

  it('المشرف لا يعيّن مساعدًا ولا يوكّل — هذه علاقة معلم بطلابه', () => {
    expect(can('supervisor', ACTIONS.ASSISTANT_ASSIGN)).toBe(false);
    expect(can('supervisor', ACTIONS.DELEGATION_MANAGE)).toBe(false);
    expect(can('supervisor', ACTIONS.TASKS_ASSIGN)).toBe(false);
  });

  it('الحضور بيد من يُسأل عن انعقاد الحلقة: المعلم ومشرفه', () => {
    // المشرف مسؤول عن انعقاد حلقاته، فيملك تسجيل الحضور فيها كاملًا.
    for (const role of ['teacher', 'supervisor', 'admin']) {
      expect(can(role, ACTIONS.ATTENDANCE_RECORD)).toBe(true);
    }
    for (const role of ['student', 'parent']) {
      expect(can(role, ACTIONS.ATTENDANCE_RECORD)).toBe(false);
    }
  });

  it('التغطية اليومية عملٌ ميداني: المعلم ومشرفه، لا الإدارة', () => {
    for (const role of ['teacher', 'supervisor']) {
      expect(can(role, ACTIONS.COVERAGE_MANAGE)).toBe(true);
    }
    for (const role of ['admin', 'student', 'parent']) {
      expect(can(role, ACTIONS.COVERAGE_MANAGE)).toBe(false);
    }
  });

  it('تقرير التغطية للمشرف والإدارة: تُقرأ في آخر الشهر ولا يُتدخَّل في يومها', () => {
    for (const role of ['supervisor', 'admin']) {
      expect(can(role, ACTIONS.COVERAGE_REPORT)).toBe(true);
    }
    for (const role of ['teacher', 'student', 'parent']) {
      expect(can(role, ACTIONS.COVERAGE_REPORT)).toBe(false);
    }
  });

  it('التجويد: يشاهده الطالب والمعلم والإدارة، ويضيفه من الإدارة فقط', () => {
    for (const role of ['student', 'teacher', 'admin']) {
      expect(can(role, ACTIONS.TAJWEED_VIEW)).toBe(true);
    }
    for (const role of ['supervisor', 'parent']) {
      expect(can(role, ACTIONS.TAJWEED_VIEW)).toBe(false);
    }

    // الإضافة صلاحية إدارية، ثم تضيق داخل الخدمة على الإدارة العليا.
    expect(can('admin', ACTIONS.TAJWEED_MANAGE)).toBe(true);
    for (const role of ['student', 'teacher', 'supervisor', 'parent']) {
      expect(can(role, ACTIONS.TAJWEED_MANAGE)).toBe(false);
    }
  });

  it('دور غير معروف بلا صلاحيات', () => {
    expect(permissionsOf('unknown')).toEqual([]);
    expect(can('unknown', ACTIONS.QURAN_READ)).toBe(false);
  });

  it('نطاق البحث يختلف بحسب الدور', () => {
    expect(searchScope('student').students).toBe('none');
    expect(searchScope('teacher').students).toBe('circle');
    expect(searchScope('supervisor').students).toBe('supervised');
    expect(searchScope('admin').students).toBe('all');
    expect(searchScope('parent').students).toBe('children');
    // الإدارة بلا مصحف فلا تظهر لها نتائج السور
    expect(searchScope('admin').surahs).toBe(false);
  });
});
