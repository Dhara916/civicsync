import test from 'node:test';
import assert from 'node:assert/strict';
import {daysLate,formatDate,initials,humanize} from '../.test-build/lib/format.js';
test('date-only formatting does not shift a day across time zones',()=>assert.match(formatDate('2030-01-01'),/1 Jan 2030/));
test('missing dates are labelled, not fabricated',()=>assert.equal(formatDate(null),'Not recorded'));
test('invalid timestamps are visibly invalid',()=>assert.equal(formatDate('invalid'),'Invalid date'));
test('overdue calculation never produces negative days',()=>{assert.equal(daysLate('2030-01-10',new Date(2030,0,5)),0);assert.equal(daysLate('2030-01-01',new Date(2030,0,3)),2);assert.equal(daysLate('invalid'),0);});
test('initials are derived from user-supplied names',()=>{assert.equal(initials('  Ada Lovelace '),'AL');assert.equal(initials(''),'C');});
test('enum labels are human-readable',()=>assert.equal(humanize('access_blocked'),'Access blocked'));
