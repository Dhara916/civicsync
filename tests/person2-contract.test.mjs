import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseWorkTypeFilter, fromDatabaseProjectStatus, fromDatabaseReportCategory, fromDatabaseReportStatus, fromDatabaseWorkType, toDatabaseProjectStatus, toDatabaseReportCategory } from '../.test-build/integrations/person2Contract.js';

test('Person 2 ongoing status round-trips to the UI progress state', () => {
  assert.equal(fromDatabaseProjectStatus('ongoing'), 'in_progress');
  assert.equal(toDatabaseProjectStatus('in_progress'), 'ongoing');
  assert.throws(() => fromDatabaseProjectStatus('unknown'));
});

test('legacy project work types remain readable and detailed types remain exact', () => {
  assert.equal(fromDatabaseWorkType('water_pipeline'), 'water');
  assert.equal(fromDatabaseWorkType('road_repair'), 'road_resurfacing');
  assert.equal(fromDatabaseWorkType('sewer_drainage'), 'sewer_drainage');
  assert.equal(fromDatabaseWorkType('other'), 'other');
  assert.deepEqual(databaseWorkTypeFilter('sewer'), ['sewer', 'sewer_drainage']);
  assert.deepEqual(databaseWorkTypeFilter('road_resurfacing'), ['road_resurfacing', 'road_repair']);
});

test('legacy and detailed report categories preserve their stored value', () => {
  for (const category of ['quality', 'safety', 'delay', 'damage', 'safety_hazard', 'road_damage', 'water_leak', 'access_blocked', 'noise', 'other']) {
    assert.equal(fromDatabaseReportCategory(category), category);
    assert.equal(toDatabaseReportCategory(category), category);
  }
  assert.throws(() => fromDatabaseReportCategory('unknown'));
});

test('Person 2 report lifecycle labels map to the citizen UI vocabulary', () => {
  assert.equal(fromDatabaseReportStatus('open'), 'submitted');
  assert.equal(fromDatabaseReportStatus('under_review'), 'acknowledged');
  assert.equal(fromDatabaseReportStatus('resolved'), 'resolved');
  assert.equal(fromDatabaseReportStatus('dismissed'), 'rejected');
  assert.throws(() => fromDatabaseReportStatus('unknown'));
});
