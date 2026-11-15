const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, hooks, nodes, text, deferred, tick, runtime, defaults } = require('./helpers/account-harness.cjs');
const theme = { mode: 'light', chrome: { foreground: '#111', secondaryForeground: '#555', card: '#fff', border: '#ddd' } };
const application = (kind = 'worker', changes = {}) => ({ id: 5, type: `${kind}_application`, title: 'Application', body: 'Recorded application text.', createdAt: '2026-11-14T08:00:00Z',
  data: { projectId: 7, projectTitle: 'Selected project', requestId: 21, requestStatus: 'pending', [`${kind}Id`]: 42, [`${kind}Name`]: 'Actual applicant' }, ...changes });
async function harness(initial, options = {}) {
  const h = hooks(); let notifications = initial; const replies = [], reads = []; let changes = 0, refreshes = 0;
  const refresh = () => { refreshes++; };
  const Component = load('src/components/homeowner/PendingTeamApplications.tsx', {
    react: h.react, 'react/jsx-runtime': runtime,
    'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable' },
    'expo-router': { useFocusEffect: callback => h.react.useEffect(callback, [callback]) },
    '@/context/NotificationContext': { useNotifications: () => ({ notifications, refresh,
      respond: async (...args) => { replies.push(args); if (options.respond) return options.respond(...args); },
      markRead: async id => { reads.push(id); if (options.readFailure) throw new Error('Read flag unavailable'); },
    }) },
    '@/context/ThemeContext': { useTheme: () => theme }, '@/components/ProfilePhoto': { ProfileAvatar: 'Avatar' },
    '@/components/Sheet': defaults('Sheet'), '@/components/homeowner/TeamProfileDetails': defaults('Profile'),
    '@/components/homeowner/WorkersTabUI': { Action: 'Action', WorkersSectionTitle: 'Title' },
  }).default;
  const render = () => h.render(() => Component({ projectId: 7, onChanged: async () => { changes++; } }));
  return { tree: await render(), render, replies, reads, h, changes: () => changes, refreshes: () => refreshes, setNotifications: value => { notifications = value; } };
}
const action = (tree, label) => nodes(tree, 'Action').find(node => node.props.label === label);

test('application cards and details use the current applicant portrait and drop a removed version', async () => {
  for (const kind of ['worker', 'contractor']) {
    const entry = application(kind);
    entry.data.applicantPhotoUrl = '/api/account/photo/42/first.jpg';
    const app = await harness([entry]);
    assert.equal(nodes(app.tree, 'Avatar')[0].props.url, entry.data.applicantPhotoUrl);
    action(app.tree, 'Application Details').props.onPress();
    let tree = await app.render();
    assert.equal(nodes(tree, 'Avatar')[1].props.url, entry.data.applicantPhotoUrl);
    const changed = { ...entry, data: { ...entry.data, applicantPhotoUrl: '/api/account/photo/42/replacement.png' } };
    app.setNotifications([changed]); tree = await app.render();
    assert.ok(nodes(tree, 'Avatar').every(node => node.props.url === changed.data.applicantPhotoUrl));
    app.setNotifications([{ ...entry, data: { ...entry.data, applicantPhotoUrl: null } }]); tree = await app.render();
    assert.ok(nodes(tree, 'Avatar').every(node => node.props.url === null));
    assert.equal(app.replies.length, 0);
  }
});

test('pending applications include only the selected project, pending inbound requests and unique request identities', async () => {
  const own = application();
  const otherProject = application('worker', { id: 6, data: { ...own.data, projectId: 8 } });
  const approved = application('worker', { id: 7, data: { ...own.data, requestStatus: 'approved' } });
  const invite = application('worker', { id: 8, type: 'worker_invite' });
  const unknown = application('worker', { id: 9, data: { ...own.data, requestStatus: undefined } });
  const app = await harness([own, otherProject, approved, invite, unknown, { ...own, id: 10 }, application('contractor', { id: 11 })]);
  assert.equal(nodes(app.tree, 'Avatar').length, 2); assert.equal(nodes(app.tree, 'Action').filter(node => node.props.label === 'Application Details').length, 2);
  assert.equal(app.refreshes(), 1);
  assert.equal((await harness([])).tree, null);
});

test('Application Details uses the exact application text, project and applicant profile rather than another role route', async () => {
  const app = await harness([application()]); action(app.tree, 'Application Details').props.onPress();
  let tree = await app.render(); assert.equal(nodes(tree, 'Sheet')[0].props.visible, true);
  assert.match(text(tree), /Recorded application text/); assert.match(text(tree), /Selected project/);
  nodes(tree, 'Pressable').find(node => text(node) === 'View Profile').props.onPress(); tree = await app.render();
  assert.equal(nodes(tree, 'Profile')[0].props.member.id, 42); assert.equal(nodes(tree, 'Profile')[0].props.member.role, 'worker');
  assert.equal(nodes(tree, 'Sheet')[0].props.visible, false);
});

test('Approve and Reject reuse notification respond with the correct kind and refresh the actual team only after success', async () => {
  for (const kind of ['worker', 'contractor']) {
    for (const accept of [true, false]) {
      const gate = deferred(); const app = await harness([application(kind)], { respond: () => gate.promise, readFailure: true });
      const answer = action(app.tree, accept ? 'Approve' : 'Reject').props.onPress; answer(); answer();
      await tick(); assert.deepEqual(app.replies, [[21, accept, kind]]); assert.equal(app.changes(), 0);
      gate.resolve(); await tick(); const tree = await app.render();
      assert.equal(tree, null); assert.equal(app.changes(), 1); assert.deepEqual(app.reads, [5]);
      answer(); await tick(); assert.equal(app.replies.length, 1);
    }
  }
});

test('failed decisions keep the application available for retry and retired requests never refresh another project', async () => {
  const app = await harness([application()], { respond: async () => { throw new Error('Request could not be approved'); } });
  action(app.tree, 'Approve').props.onPress(); await tick(); const tree = await app.render();
  assert.match(text(tree), /could not be approved/); assert.equal(action(tree, 'Approve').props.disabled, false); assert.equal(app.changes(), 0);
  const gate = deferred(); const old = await harness([application()], { respond: () => gate.promise });
  action(old.tree, 'Reject').props.onPress(); old.h.unmount(); gate.resolve(); await tick(); assert.equal(old.changes(), 0);
});

test('notification updates remove resolved applications without inventing member or pending records', async () => {
  const own = application(); const app = await harness([own]);
  app.setNotifications([{ ...own, data: { ...own.data, requestStatus: 'approved' } }]);
  assert.equal(await app.render(), null); assert.equal(app.replies.length, 0);
});

test('compact breakpoints preserve usable space and switch to one recommendation column for large text', () => {
  const { workersLayout } = load('src/utils/workersLayout.ts', {});
  for (const width of [320, 360, 375, 390, 430, 768]) {
    for (const fontScale of [1, 1.2, 1.5, 2]) {
      const value = workersLayout(width, fontScale);
      if (value.inlineTeam) assert.ok(value.contentWidth - 22 - 46 - 18 - 140 >= 110, 'name/trade column has useful width');
      if (value.recommendationColumns === 2) assert.ok((value.contentWidth - 10) / 2 >= 160);
      if (fontScale > 1.3) { assert.equal(value.recommendationColumns, 1); assert.equal(value.inlineTeam, false); }
    }
  }
  assert.equal(workersLayout(390).statsColumns, 4); assert.equal(workersLayout(320).statsColumns, 2);
});
