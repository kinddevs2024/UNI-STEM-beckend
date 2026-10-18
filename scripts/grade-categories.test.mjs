import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGradeCategory, parseGradePrizes, questionsForGrade } from '../lib/grade-categories.js';
test('accepts precisely school grades 5–11 and Student', () => {
  for (const grade of ['5','6','7','8','9','10','11','student']) assert.equal(parseGradeCategory(grade), grade);
  for (const grade of ['4','12','teacher','',null]) assert.throws(() => parseGradeCategory(grade));
});
test('never falls through to another class question set', () => {
  const rows = [{ gradeCategory: '5', question: 'five' }, { gradeCategory: '6', question: 'six' }, { question: 'old' }];
  assert.deepEqual(questionsForGrade(rows, '5'), [rows[0]]);
  assert.deepEqual(questionsForGrade(rows, 'student'), []);
  assert.deepEqual(questionsForGrade(rows, null), [rows[2]]);
  assert.deepEqual(questionsForGrade([rows[2]], '5'), [rows[2]]);
});
test('prize places are unique per category and names are mandatory', () => {
  const prizes = [{ gradeCategory: '5', place: 1, name: 'Laptop' }, { gradeCategory: '6', place: 1, name: 'Tablet' }];
  assert.equal(parseGradePrizes(prizes).length, 2);
  assert.throws(() => parseGradePrizes([prizes[0], prizes[0]]));
  assert.throws(() => parseGradePrizes([{ ...prizes[0], name: '' }]));
  assert.throws(() => parseGradePrizes([{ ...prizes[0], photo: 'javascript:alert(1)' }]));
});
