import {test} from 'node:test';
import assert from 'node:assert/strict';
import {approvalBadge} from '../lib/template-approval.mjs';
test('approval badges distinguish unsent, pending, approved, rejected and unavailable',()=>{
  assert.equal(approvalBadge('NOT_SUBMITTED').label,'Not yet approved');
  assert.match(approvalBadge('NOT_SUBMITTED').color,/red/);
  assert.match(approvalBadge('PENDING').color,/amber/);
  assert.match(approvalBadge('APPROVED').color,/emerald/);
  for(const s of ['UNKNOWN','REJECTED','PAUSED','DISABLED',undefined])assert.notEqual(approvalBadge(s).label,'Approved');
});
