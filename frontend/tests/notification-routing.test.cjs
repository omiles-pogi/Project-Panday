const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.join(__dirname, '../src/utils/notificationRoutes.ts');
const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const exportsObject = {};
vm.runInNewContext(outputText, { exports: exportsObject }, { filename });
const { notificationRoute } = exportsObject;
const notification = (type, data) => ({ type, data });

test('tapping historical bidding pushes cannot open a removed screen for any role', () => {
  for (const type of ['quote_request_received', 'quote_bid_received', 'quote_bid_awarded', 'quote_bid_not_selected', 'quote_request_cancelled']) {
    for (const role of ['homeowner', 'contractor', 'supplier', 'worker', 'admin', 'superadmin']) {
      assert.equal(notificationRoute(notification(type, { quoteRequestId: 1, projectTitle: 'Old project' }), role), null);
    }
  }
});

test('material requests and supplier price confirmations still open their existing destinations', () => {
  const data = { materialRequestId: 12, supplierFulfillmentId: 24 };
  for (const type of ['supplier_fulfillment_received', 'supplier_price_confirmation', 'material_request_approved']) {
    assert.equal(notificationRoute(notification(type, data), 'supplier'), '/supplier/fulfillment?fulfillmentId=24');
    assert.equal(notificationRoute(notification(type, data), 'homeowner'), '/homeowner/approvals/12');
    assert.equal(notificationRoute(notification(type, data), 'contractor'), '/contractor/material-request/12');
  }
});

test('chat and project invitation notifications retain their existing destinations', () => {
  assert.equal(notificationRoute(notification('new_message', { conversationId: 8 }), 'homeowner'), '/homeowner/messages/8');
  assert.equal(notificationRoute(notification('new_message', { conversationId: 8 }), 'contractor'), '/contractor/chat/8');
  assert.equal(notificationRoute(notification('worker_invite', { requestId: 9 }), 'worker'), '/worker/invite/9');
  assert.equal(notificationRoute(notification('contractor_invite', { requestId: 9 }), 'contractor'), '/contractor/invite/9');
});

test('project updates explicitly open details while other roles retain their original project routes', () => {
  const update = notification('project_completion_submitted', { projectId: 7 });
  assert.equal(notificationRoute(update, 'homeowner'), '/homeowner/project-overview?projectId=7');
  assert.equal(notificationRoute(update, 'contractor'), '/contractor/projects?projectId=7');
  assert.equal(notificationRoute(update, 'worker'), '/worker/assignments?projectId=7');
});
