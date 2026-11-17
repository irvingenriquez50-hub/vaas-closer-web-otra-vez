import {test} from 'node:test';
import assert from 'node:assert/strict';
import {approvalBadge,openingPreview} from '../lib/template-approval.mjs';
test('approval badges distinguish unsent, pending, approved, rejected and unavailable',()=>{
  assert.equal(approvalBadge('NOT_SUBMITTED').label,'Not yet approved');
  assert.match(approvalBadge('NOT_SUBMITTED').color,/red/);
  assert.match(approvalBadge('PENDING').color,/amber/);
  assert.match(approvalBadge('APPROVED').color,/emerald/);
  for(const s of ['UNKNOWN','REJECTED','PAUSED','DISABLED',undefined])assert.notEqual(approvalBadge(s).label,'Approved');
});
test('preview restores full copy and displays the correct member package prices',()=>{
  const preview=openingPreview({gmvTotal:'12M',market:'Spanish-speaking',shortName:'ruben',gmv30d:'256K',tiktokHandle:'@alwaysshoppin'},[{videos:1,anchor:500},{videos:5,anchor:2250},{videos:10,anchor:4000}]);
  assert.ok(preview.startsWith('• FROM THE VAAS COMMUNITY •\n\nI would love to work with your brand!'));
  assert.match(preview,/All packages include ad usage rights unless otherwise discussed\./);
  assert.match(preview,/1x Video — \$500 per video/);
  assert.match(preview,/5x Videos\/Month — \$2250/);
  assert.match(preview,/10x Videos\/Month — \$4000/);
  assert.match(preview,/Last 30 Days GMV: \$256K USD/);
  assert.ok(preview.endsWith('My TikTok Account: @alwaysshoppin\n\n— The VAAS Community'));
  assert.equal(approvalBadge('CONTENT_MISMATCH').label,'Content mismatch');
});
