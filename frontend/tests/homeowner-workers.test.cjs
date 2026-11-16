const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, hooks, nodes, text, deferred, tick, runtime, defaults } = require('./helpers/account-harness.cjs');
const colors = load('src/theme/colors.ts', {});
const overview = (id = 7, extra = {}) => ({ projectId: id, title: `Project ${id}`, status: 'active', canInvite: true,
  approvedPlan: { budgetBreakdown: [{ category: 'Foundation and Excavation' }], phases: [{ name: 'Masonry' }] },
  team: [], pendingWorkers: [], pendingContractorIds: [], metrics: { total: 0, active: 0, pending: 0, needed: null }, ...extra });
const worker = (id, extra = {}) => ({ id, name: `Recorded worker ${id}`, trade: 'Mason', skills: ['Masonry'], averageRating: null, ratingCount: 0, minDailyWage: null, matchedSkillCount: 1, ...extra });
const contractor = (id, extra = {}) => ({ id, name: `Recorded contractor ${id}`, specialization: 'Residential', skills: ['Masonry'], averageRating: null, ratingCount: 0, matchedSkillCount: 1, ...extra });
async function harness(options = {}) {
  const h = hooks(); let context = { activeProjectKey: options.key ?? '7', ready: true, refreshProjectSelection: async () => { validations++; } };
  let current = options.overview ?? overview(); let recommendations = options.workers ?? [worker(21)];
  const routes = [], invitations = [], contractorInvitations = [], requests = [], searches = [], contractorSearches = []; let validations = 0;
  let theme = { mode: options.mode ?? 'light', chrome: options.mode === 'dark' ? colors.darkChrome : colors.lightChrome };
  const react = h.react;
  const ui = load('src/components/homeowner/WorkersTabUI.tsx', {
    'react/jsx-runtime': runtime,
    'react-native': { Image: 'Image', Text: 'Text', View: 'View', Pressable: 'Pressable', StyleSheet: { create: value => value } },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '@/context/ThemeContext': { useTheme: () => theme }, '@/components/ProfilePhoto': { ProfileAvatar: 'Avatar' },
    '@/components/MessageButton': defaults('Message'), '@/utils/currency': { peso: value => `PHP ${value}` },
    '@/components/teamActionStyles': load('src/components/teamActionStyles.ts', {}),
    '../../../assets/home-hero-house.png': 'house.png', '../../../assets/workers-build-team.png': 'crew.png',
  });
  const expandUI = node => {
    if (Array.isArray(node)) return node.map(expandUI);
    if (!node || typeof node !== 'object') return node;
    const children = node.type === 'Directory'
      ? [node.props.beforeBanner, {type:ui.BuildTeamBanner,props:{canInvite:true,onBrowse:()=>routes.push('/homeowner/find-team')}}, 'Explore Skilled Workers', 'Explore Contractors', node.props.children]
      : Object.values(ui).includes(node.type) ? node.type(node.props) : node.props?.children;
    return { ...node, props: { ...node.props, children: expandUI(children) } };
  };
  const resource = load('src/hooks/useFocusedResource.ts', {
    react, 'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    'expo-router': { useFocusEffect: callback => react.useEffect(callback, [callback]) },
  }, { setInterval: () => 0, clearInterval: () => {} });
  const Screen = load('src/screens/homeowner/WorkersDashboard.tsx', {
    react, 'react/jsx-runtime': runtime,
    'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable', ActivityIndicator: 'Spinner', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: options.width ?? 390, fontScale: options.fontScale ?? 1 }) },
    'expo-router': { router: { push: path => routes.push(path) } }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/ui': { Screen: 'Screen' }, '@/components/ProfilePhoto': { ProfileAvatar: 'Avatar' },
    '@/components/MessageButton': defaults('Message'), '@/components/TeamActivity': defaults('Activity'),
    '@/components/homeowner/TeamProfileDetails': defaults('Details'),
    '@/components/homeowner/PendingTeamApplications': defaults('Pending'), '@/components/homeowner/WorkersTabUI': ui,
    '@/components/homeowner/WorkersDirectory': defaults('Directory'),
    '@/utils/workersLayout': load('src/utils/workersLayout.ts', {}),
    '@/context/PlanContext': { usePlan: () => context }, '@/context/ThemeContext': { useTheme: () => theme },
    '@/hooks/useFocusedResource': resource,
    '@/services/api/homeownerTeam': { fetchHomeownerTeam: async id => { requests.push(id); return options.fetch ? options.fetch(id) : current; } },
    '@/services/api/workers': { searchWorkers: async params => { searches.push(params); if (options.searchError) throw new Error('Search offline'); return recommendations; } },
    '@/services/api/contractors': { searchContractors: async params => { contractorSearches.push(params); if (options.contractorSearchError) throw new Error('Contractors offline'); return options.contractors ?? []; } },
    '@/services/api/projects': {
      assignWorkerToProject: async (...args) => { invitations.push(args); return options.invite ? options.invite(...args) : { status: 'pending' }; },
      assignContractorToProject: async (...args) => { contractorInvitations.push(args); return options.inviteContractor ? options.inviteContractor(...args) : { status: 'pending' }; },
    },
    '@/utils/teamRecommendations': load('src/utils/teamRecommendations.ts', {}), '@/utils/currency': { peso: value => `PHP ${value}` },
  }).default;
  const render = async () => expandUI(await h.render(Screen));
  return { tree: await render(), render, h, routes, invitations, contractorInvitations, requests, searches, contractorSearches, setOverview: value => { current = value; }, setContext: value => { context = { ...context, ...value }; }, setWorkers: value => { recommendations = value; }, setTheme: value => { theme = value; } };
}
const actions = (tree, label) => [...nodes(tree, 'Action').filter(node => node.props.label === label), ...nodes(tree, 'Pressable').filter(node => text(node).trim() === label)];
const metric = (tree, label) => nodes(nodes(tree, 'View').find(node => node.props.accessibilityLabel?.startsWith(`${label}:`)), 'Text')[0]?.props.children;

test('current worker and contractor team cards and recommendations pass saved portrait URLs in both themes', async () => {
  const workerUrl = '/api/account/photo/11/worker.jpg';
  const contractorUrl = '/api/account/photo/12/contractor.png';
  const recommendedUrl = '/api/account/photo/21/recommended.jpg';
  for (const mode of ['light', 'dark']) {
    const app = await harness({ mode, overview: overview(7, { team: [
      { ...worker(11), role: 'worker', status: 'Assigned', photoUrl: workerUrl },
      { id: 12, name: 'Recorded contractor', role: 'contractor', status: 'Assigned', specialization: 'Residential', skills: [], averageRating: null, ratingCount: 0, photoUrl: contractorUrl },
    ] }), workers: [worker(21, { photoUrl: recommendedUrl })] });
    const urls = nodes(app.tree, 'Avatar').map(node => node.props.url);
    for (const url of [workerUrl, contractorUrl, recommendedUrl]) assert.ok(urls.includes(url));
    assert.equal(app.invitations.length, 0);
    app.h.unmount();
  }
});

test('profile details forwards the saved worker or contractor photo to the existing shared avatar', async () => {
  for (const role of ['worker', 'contractor']) {
    const h = hooks();
    const data = { id: 42, name: 'Recorded applicant', photoUrl: '/api/account/photo/42/saved.jpg', yearsExperience: 4, skills: [], ratings: [], averageRating: null, ratingCount: 0 };
    const Details = load('src/components/homeowner/TeamProfileDetails.tsx', {
      react: h.react, 'react/jsx-runtime': runtime,
      'react-native': { ActivityIndicator: 'Spinner', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'Scroll', Text: 'Text', View: 'View' },
      '@expo/vector-icons': { Ionicons: 'Icon' }, '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) },
      '@/hooks/useFocusedResource': { useFocusedResource: () => ({ data, loading: false }) },
      '@/services/api/workers': {}, '@/services/api/contractors': {}, '@/utils/currency': {},
      '@/components/ProfilePhoto': { ProfileAvatar: 'Avatar' },
    }).default;
    const tree = await h.render(() => Details({ member: { id: 42, name: data.name, role }, onClose() {} }));
    assert.equal(nodes(tree, 'Avatar')[0].props.url, data.photoUrl);
  }
});

test('workers dashboard orders real project sections, omits fake data and preserves the existing browse destination', async () => {
  const app = await harness(); const body = text(app.tree);
  assert.ok(body.indexOf('Team Overview') < body.indexOf('Build Your Team'));
  assert.ok(body.indexOf('Build Your Team') < body.indexOf('Current Team'));
  assert.ok(body.indexOf('Build Your Team') < body.indexOf('Explore Skilled Workers'));
  assert.ok(body.indexOf('Explore Contractors') < body.indexOf('Current Team'));
  assert.equal(nodes(app.tree,'Directory').length,1);
  assert.equal(nodes(app.tree,'Pending')[0].props.projectId,7);
  assert.ok(body.indexOf('Current Team') < body.indexOf('Recommended Workers for Your Project'));
  assert.match(body, /No team members yet/); assert.match(body, /Needed/); assert.doesNotMatch(body, /staffing headcount target/);
  nodes(app.tree, 'Pressable').find(node => node.props.accessibilityLabel === 'Team statistics information').props.onPress();
  assert.match(text(await app.render()), /staffing headcount target/);
  assert.doesNotMatch(body, /match score|100%|Available now|PHP 0/);
  assert.equal(app.requests[0], 7); assert.ok(app.searches[0].skills.includes('Masonry'));
  actions(app.tree, 'Browse Skilled Workers')[0].props.onPress(); assert.deepEqual(app.routes, ['/homeowner/find-team']);
  assert.equal(metric(app.tree, 'Needed'), '—'); assert.equal(metric(app.tree, 'Total Team'), 0);
});

test('current team preview expands and View, worker messaging and real assignment activity keep the correct IDs', async () => {
  const team = [11, 12, 13, 14].map(id => ({ ...worker(id), role: 'worker', status: 'Assigned' }));
  const app = await harness({ overview: overview(7, { team, metrics: { total: 4, active: 4, pending: 0, needed: null } }) });
  assert.equal(nodes(app.tree, 'Message').length, 3);
  actions(app.tree, 'View All')[0].props.onPress(); let tree = await app.render(); assert.equal(nodes(tree, 'Message').length, 4);
  const message = nodes(tree, 'Message')[0].props;
  assert.equal(message.projectId, 7); assert.equal(message.workerId, 11); assert.equal(message.contractorId, undefined);
  assert.equal(message.chatPath(123), '/homeowner/messages/123');
  actions(tree, 'View')[0].props.onPress(); tree = await app.render(); assert.equal(nodes(tree, 'Details')[0].props.member.id, 11);
  const tasks = actions(tree, 'Tasks')[0]; assert.equal(tasks.props.accessibilityLabel, 'Assignment');
  tasks.props.onPress(); tree = await app.render(); assert.equal(nodes(tree, 'Activity')[0].props.projectId, 7);
  assert.match(text(tree), /Individual schedules are not recorded/);
});

test('only backend skill matches are recommended; existing members are excluded and pending applications cannot be invited again', async () => {
  const app = await harness({ overview: overview(7, { team: [{ ...worker(21), role: 'worker', status: 'Assigned' }], pendingWorkers: [{ workerId: 23, initiatedBy: 'worker' }] }),
    workers: [worker(21), worker(22, { matchedSkillCount: 0 }), worker(23), worker(24, { minDailyWage: 700, averageRating: 4.5, ratingCount: 2 })] });
  const identities = nodes(app.tree, 'Identity').map(node => node.props.person.id);
  assert.deepEqual(identities, [21, 23, 24]);
  assert.equal(actions(app.tree, 'Application Pending')[0].props.disabled, true);
  assert.match(text(app.tree), /PHP 700/); assert.doesNotMatch(text(app.tree), /PHP 0/);
});

test('worker and contractor recommendations preserve endpoint ranking and exclude assigned or unmatched people using the approved plan',async()=>{
  for(const mode of ['light','dark']){
    const app=await harness({mode,overview:overview(7,{team:[{...contractor(41),role:'contractor',status:'Assigned'}]}),
      workers:[worker(23,{score:90}),worker(22,{score:70}),worker(24,{matchedSkillCount:0})],
      contractors:[contractor(43,{photoUrl:'/api/account/photo/43/saved.jpg',averageRating:4.8,ratingCount:5}),contractor(42),contractor(41),contractor(44,{matchedSkillCount:0})]});
    const cards=nodes(app.tree,'RecommendedWorkerCard');
    assert.deepEqual(cards.map(card=>card.props.worker.id),[23,22,43,42]);
    assert.deepEqual(Array.from(app.searches[0].skills),Array.from(app.contractorSearches[0].skills));
    assert.ok(app.searches[0].skills.includes('Masonry'));
    assert.ok(nodes(app.tree,'Avatar').some(node=>node.props.url==='/api/account/photo/43/saved.jpg'));
    assert.doesNotMatch(text(app.tree),/AI match score|100%|PHP 0/);
    assert.equal(nodes(app.tree,'Directory').length,1);
    assert.ok(text(app.tree).indexOf('Explore Contractors')<text(app.tree).indexOf('Recommended Workers for Your Project'));
  }
});

test('recommended contractors keep profile viewing and guarded invitations on the selected project',async()=>{
  const gate=deferred();const app=await harness({contractors:[contractor(43)],inviteContractor:()=>gate.promise});
  const card=nodes(app.tree,'RecommendedWorkerCard').find(node=>node.props.worker.id===43);
  card.props.onView();let tree=await app.render();assert.equal(nodes(tree,'Details')[0].props.member.role,'contractor');
  assert.equal(nodes(tree,'Details')[0].props.member.id,43);
  card.props.onInvite();card.props.onInvite();await tick();assert.deepEqual(app.contractorInvitations,[[7,43]]);
  app.setOverview(overview(7,{pendingContractorIds:[43]}));gate.resolve({status:'pending'});tree=await app.render();
  const saved=nodes(tree,'RecommendedWorkerCard').find(node=>node.props.worker.id===43);
  assert.equal(saved.props.disabled,true);assert.equal(saved.props.inviteLabel,'Invite Sent');
});

test('empty and failed recommendations leave the complete directory and the active project recommendation section visible',async()=>{
  const empty=await harness({workers:[worker(23,{matchedSkillCount:0})],contractors:[contractor(43,{matchedSkillCount:0})]});
  assert.match(text(empty.tree),/Recommended Workers for Your Project/);assert.match(text(empty.tree),/No recommendations available yet/);
  assert.equal(nodes(empty.tree,'Directory').length,1);
  const partial=await harness({searchError:true,contractors:[contractor(43)]});
  assert.deepEqual(nodes(partial.tree,'RecommendedWorkerCard').map(n=>n.props.worker.id),[43]);
  assert.match(text(partial.tree),/current team is still available/);assert.equal(nodes(partial.tree,'Directory').length,1);
  const other=await harness({contractorSearchError:true});
  assert.deepEqual(nodes(other.tree,'RecommendedWorkerCard').map(n=>n.props.worker.id),[21]);
});

test('without a current construction project recommendations are hidden and no plan matching requests run',async()=>{
  for(const options of [{key:'draft:new'},{overview:overview(7,{status:'not_started',canInvite:false})},{overview:overview(7,{status:'completed'})}]){
    const app=await harness(options);
    assert.equal(nodes(app.tree,'Directory').length,1);assert.doesNotMatch(text(app.tree),/Recommended Workers for Your Project/);
    assert.equal(app.searches.length,0);assert.equal(app.contractorSearches.length,0);
  }
  const noPlan=await harness({overview:overview(7,{approvedPlan:null})});
  assert.match(text(noPlan.tree),/No recommendations available yet/);assert.equal(noPlan.searches.length,0);assert.equal(noPlan.contractorSearches.length,0);
});

test('duplicate invite taps send one existing API request and refresh the true pending count after success', async () => {
  const gate = deferred();
  const app = await harness({ invite: () => gate.promise });
  const send = actions(app.tree, 'Invite')[0].props.onPress;
  send(); send(); await tick(); assert.deepEqual(app.invitations, [[7, 21]]);
  app.setOverview(overview(7, { pendingWorkers: [{ workerId: 21, initiatedBy: 'homeowner' }], metrics: { total: 0, active: 0, pending: 1, needed: null } }));
  gate.resolve({ status: 'pending' }); await tick(); const tree = await app.render();
  assert.equal(actions(tree, 'Invite Sent')[0].props.disabled, true); assert.ok(app.requests.length >= 2);
  assert.equal(metric(tree, 'Pending'), 1);
  assert.doesNotMatch(text(tree), /Sending/);
});

test('failed invitation unlocks retry without inventing a pending request; stale invitation completion after unmount cannot refresh another project', async () => {
  const app = await harness({ invite: async () => { throw new Error('Invite failed'); } });
  actions(app.tree, 'Invite')[0].props.onPress(); await tick(); let tree = await app.render();
  assert.match(text(tree), /Invite failed/); assert.equal(actions(tree, 'Invite')[0].props.disabled, false);
  const gate = deferred(); const old = await harness({ invite: () => gate.promise });
  actions(old.tree, 'Invite')[0].props.onPress(); old.h.unmount(); gate.resolve({ status: 'pending' }); await tick();
  assert.equal(old.requests.length, 1);
});

test('no selected project or an unfinished draft shows the public directory without global/default team reads', async () => {
  const empty = await harness({ key: 'draft:unique' }); assert.equal(empty.requests.length, 0);
  assert.equal(nodes(empty.tree, 'Directory').length, 1);
  const draft = await harness({ overview: overview(7, { canInvite: false, status: 'not_started', approvedPlan: null }) });
  assert.equal(draft.searches.length, 0); assert.equal(nodes(draft.tree, 'Directory').length, 1);
});

test('one directory remains visible while the selected project loads and when team loading fails',async()=>{
  const pending=deferred();const app=await harness({fetch:()=>pending.promise});
  assert.equal(nodes(app.tree,'Directory').length,1);assert.equal(nodes(app.tree,'Spinner').length,1);
  assert.equal(nodes(app.tree,'Directory')[0].props.renderInvite(worker(11),'worker').props.disabled,true);
  pending.resolve(overview());const tree=await app.render();
  assert.equal(nodes(tree,'Directory').length,1);assert.equal(nodes(tree,'Pending').length,1);assert.equal(nodes(tree,'Spinner').length,0);
  const failed=await harness({fetch:async()=>{throw Error('Team offline');}});
  assert.equal(nodes(failed.tree,'Directory').length,1);assert.match(nodes(failed.tree,'Directory')[0].props.teamError,/offline/);
});

test('directory invitations for workers and contractors use the selected project once and reflect persisted pending/assigned records',async()=>{
  const workerGate=deferred(),contractorGate=deferred();
  const app=await harness({invite:()=>workerGate.promise,inviteContractor:()=>contractorGate.promise});
  const action=nodes(app.tree,'Directory')[0].props.renderInvite;
  const workerAction=action(worker(31),'worker'),contractorAction=action({id:32},'contractor');
  assert.equal(workerAction.props.disabled,false);assert.equal(contractorAction.props.disabled,false);
  workerAction.props.onPress();workerAction.props.onPress();contractorAction.props.onPress();contractorAction.props.onPress();await tick();
  assert.deepEqual(app.invitations,[[7,31]]);assert.deepEqual(app.contractorInvitations,[[7,32]]);
  app.setOverview(overview(7,{pendingWorkers:[{workerId:31,initiatedBy:'homeowner'}],pendingContractorIds:[32],metrics:{total:0,active:0,pending:2,needed:null}}));
  workerGate.resolve({status:'pending'});contractorGate.resolve({status:'pending'});let tree=await app.render();
  for(const [id,role]of [[31,'worker'],[32,'contractor']]) assert.equal(nodes(tree,'Directory')[0].props.renderInvite({id},role).props.disabled,true);
  app.setOverview(overview(7,{team:[{id:31,role:'worker',name:'Joined',skills:[],trade:'Mason',averageRating:null,ratingCount:0}],pendingContractorIds:[32]}));
  await nodes(tree,'Pending')[0].props.onChanged();tree=await app.render();
  assert.equal(nodes(tree,'Directory')[0].props.renderInvite({id:31},'worker').props.label,'On Project');
  assert.equal(nodes(tree,'Directory').length,1);
});

test('directory invitations stay disabled without a verified eligible project',async()=>{
  for(const options of [{key:'draft:one'},{overview:overview(7,{status:'not_started',canInvite:false})}]){
    const app=await harness(options);const render=nodes(app.tree,'Directory')[0].props.renderInvite;
    for(const role of ['worker','contractor']) { const action=render({id:31},role);assert.equal(action.props.disabled,true);action.props.onPress(); }
    assert.equal(app.invitations.length,0);assert.equal(app.contractorInvitations.length,0);
  }
});

test('late project A reads cannot overwrite project B; recommendation failures preserve the real team', async () => {
  const a = deferred(); const b = deferred();
  const app = await harness({ fetch: id => id === 7 ? a.promise : b.promise });
  app.setContext({ activeProjectKey: '8' }); await app.render();
  b.resolve(overview(8)); await tick(); let tree = await app.render(); assert.match(text(tree), /Project 8/);
  a.resolve(overview(7)); await tick(); tree = await app.render(); assert.match(text(tree), /Project 8/); assert.doesNotMatch(text(tree), /Project 7/);
  const offline = await harness({ searchError: true, overview: overview(7, { team: [{ ...worker(41), role: 'worker', status: 'Assigned' }] }) });
  assert.equal(nodes(offline.tree, 'Message').length, 1); assert.match(text(offline.tree), /current team is still available/);
});

test('light and dark dashboard surfaces follow theme tokens and worker profile details use only the existing profile API', async () => {
  for (const mode of ['light', 'dark']) {
    const app = await harness({ mode });
    const surfaces = nodes(app.tree, 'View').filter(node => Array.isArray(node.props.style) && node.props.style.some(style => style?.borderRadius === 18));
    assert.ok(surfaces.some(node => node.props.style.some(style => style?.backgroundColor === (mode === 'light' ? '#ffffff' : '#1a1d27'))));
  }
  const h = hooks(); const calls = [];
  const Details = load('src/components/homeowner/TeamProfileDetails.tsx', {
    react: h.react, 'react/jsx-runtime': runtime, 'react-native': { ActivityIndicator: 'Spinner', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'Scroll', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) },
    '@/hooks/useFocusedResource': { useFocusedResource: loader => { calls.push(loader); return { data: null, loading: true }; } },
    '@/services/api/workers': { fetchWorkerProfile: async id => { calls.push(id); return worker(id); } },
    '@/services/api/contractors': {}, '@/components/ProfilePhoto': { ProfileAvatar: 'Avatar' }, '@/utils/currency': {},
  }).default;
  await h.render(() => Details({ member: { id: 42, name: 'Recorded name', role: 'worker' }, onClose() {} }));
  await calls[0](); assert.equal(calls.at(-1), 42);
});

test('team client rejects invalid, mismatched or completed project snapshots without choosing a fallback', async () => {
  const requests = []; let response = overview(7);
  const api = load('src/services/api/homeownerTeam.ts', { '@/services/api/client': { apiFetch: async path => { requests.push(path); return response; } } });
  await assert.rejects(api.fetchHomeownerTeam(0)); assert.equal(requests.length, 0);
  assert.equal((await api.fetchHomeownerTeam(7)).projectId, 7); assert.equal(requests[0], '/api/projects/7/team-overview');
  response = overview(8); await assert.rejects(api.fetchHomeownerTeam(7), /no longer available/);
  response = overview(7, { status: 'completed' }); await assert.rejects(api.fetchHomeownerTeam(7), /no longer available/);
});

test('worker message navigation ignores a conversation response after its project is retired', async () => {
  const h = hooks(); const gate = deferred(); let current = true; const requests = [], routes = [];
  const Message = load('src/components/MessageButton.tsx', {
    react: h.react, 'react/jsx-runtime': runtime, '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native': { ActivityIndicator: 'Spinner', Pressable: 'Pressable', Text: 'Text', View: 'View' },
    'expo-router': { router: { push: route => routes.push(route) } },
    '@/components/teamActionStyles': load('src/components/teamActionStyles.ts', {}),
    '@/services/api/chat': { startConversation: async (...args) => { requests.push(args); return gate.promise; } },
  }).default;
  const tree = await h.render(() => Message({ projectId: 7, workerId: 42, label: 'Message worker', chatPath: id => `/homeowner/messages/${id}`, isCurrent: () => current }));
  nodes(tree, 'Pressable')[0].props.onPress(); assert.deepEqual(requests, [[7, undefined, 42]]);
  current = false; gate.resolve({ id: 99 }); await tick(); assert.equal(routes.length, 0);
});
