// Checks the real, published lesson files against the content rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLessons } from './lesson-rules.js';
import { flatten } from '../js/lessons.js';
import { readJson } from './helpers.js';

const index = readJson('lessons/index.json');
const lessons = index.lessons.map(l => readJson('lessons/' + l.file));

test('every published lesson passes every check', () => assert.deepEqual(validateLessons(lessons), []));
test('the index ids match the files', () => assert.deepEqual(lessons.map(l => l.id), index.lessons.map(l => l.id)));
test('lesson 1 has its 69 checked phrases', () => assert.equal(flatten([lessons[0]]).phrases.length, 69));
