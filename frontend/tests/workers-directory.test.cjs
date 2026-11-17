const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, hooks, nodes, text, runtime, defaults, deferred, tick, theme } = require('./helpers/account-harness.cjs');
const worker = (id, extra = {}) => ({ id, name: `Worker ${id}`, trade: 'Mason', skills: ['Masonry'], averageRating: null, ratingCount: 0, matchedSkillCount: 0, ...extra });
const contractor = (id, extra = {}) => ({ id, name: `Contractor ${id}`, specialization: 'Residential', companyName: 'Construction Company', skills: ['Renovation'], averageRating: 4.5, ratingCount: 2, matchedSkillCount: 0, ...extra });

async function directory(options = {}) {
  const h = hooks(), calls = [], routes = []; let attempts = 0;
  const resource = load('src/hooks/useFocusedResource.ts', {
    react: h.react, 'expo-router': { useFocusEffect: fn => h.react.useEffect(fn, [fn]) },
    'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
  }, { setInterval: () => 0, clearInterval() {} });
  const Screen = load('src/components/homeowner/WorkersDirectory.tsx', {
    react: h.react, 'react/jsx-runtime': runtime,
    'react-native': { ActivityIndicator: 'Spinner', Text: 'Text', TextInput: 'Search', Pressable: 'Button', View: 'View', Keyboard: { dismiss() {} } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { router: { push: path => routes.push(path) } },
    '@/components/ui': { Field: 'Field', Screen: 'Screen' }, '@/components/ProfilePhoto': { ProfileAvatar: 'Avatar' },
    '@/context/ThemeContext': { useTheme: () => options.theme ?? theme }, '@/hooks/useFocusedResource': resource,
    '@/services/api/workers': { searchWorkers: async params => { calls.push(['workers', params]); return options.workers ? options.workers(params) : [worker(11), worker(12, { trade: 'Electrician', skills: ['Wiring'] })]; } },
    '@/services/api/contractors': { searchContractors: async params => { calls.push(['contractors', params]); return options.contractors ? options.contractors(params) : [contractor(21)]; } },
    './WorkersTabUI': Object.fromEntries(['Action','BuildTeamBanner','Identity','Skills','WorkersSectionTitle'].map(name => [name, name])),
    './TeamProfileDetails': defaults('Profile'),
    './WorkersFilterDrawer': defaults('FilterDrawer'),
    '@/utils/workersFilters': load('src/utils/workersFilters.ts', {}),
    './ProjectHiringPrompt': { ...defaults('ProjectPrompt'), useHiringProjectPrompt: () => ({ disabled: options.unverified, requireProject: () => attempts++ }) },
  }).default;
  const render = () => h.render(() => Screen(options.props ?? {}));
  return { render, tree: await render(), calls, routes, attempts: () => attempts, h };
}
const action = (tree, label) => nodes(tree, 'Action').find(n => n.props.accessibilityLabel === label || n.props.label === label);
const change = (tree, label, value) => nodes(tree, 'Search').find(n => n.props.accessibilityLabel === label).props.onChangeText(value);
const openFilters = async app => { nodes(await app.render(), 'Button').find(n => n.props.accessibilityLabel === 'Filter workers').props.onPress(); return nodes(await app.render(),'FilterDrawer')[0]; };

test('Explore Skilled Workers and Explore Contractors forward saved portrait URLs without requiring a project', async () => {
  const workerUrl = '/api/account/photo/11/worker.jpg'; const contractorUrl = '/api/account/photo/21/contractor.png';
  const app = await directory({ workers: async () => [worker(11, { photoUrl: workerUrl })], contractors: async () => [contractor(21, { photoUrl: contractorUrl })] });
  assert.deepEqual(nodes(app.tree, 'Avatar').map(node => node.props.url), [workerUrl, contractorUrl]);
  assert.equal(app.attempts(), 0);
});

test('the unverified/no-project directory reads both approved APIs without AI requirements or project endpoints', async () => {
  const app = await directory({ unverified: true });
  assert.deepEqual(app.calls.map(call => call[0]), ['workers','contractors']);
  assert.ok(app.calls.every(call => call[1].skills.length === 0));
  assert.deepEqual(nodes(app.tree, 'Identity').map(n => n.props.person.id), [11,12,21]);
  assert.ok(nodes(app.tree, 'Identity').every(n => n.props.person.matchedSkillCount === 0), 'normal browse includes non-AI matches');
  assert.deepEqual(nodes(app.tree, 'WorkersSectionTitle').map(n => text(n)), ['Explore Skilled Workers','Explore Contractors']);
  assert.equal(nodes(app.tree, 'BuildTeamBanner')[0].props.canInvite, true);
  nodes(app.tree, 'BuildTeamBanner')[0].props.onBrowse(); assert.deepEqual(app.routes, ['/homeowner/find-team']);
  assert.equal(nodes(app.tree, 'ProjectPrompt').length, 1);
});

test('public worker/contractor profiles open without a project, and Invite uses only the guarded planning prompt', async () => {
  const app = await directory();
  assert.equal(action(app.tree,'Invite to Project').props.disabled,true);
  for (const [name, id, role] of [['Worker 11',11,'worker'],['Contractor 21',21,'contractor']]) {
    action(app.tree, `View ${name}'s profile`).props.onPress();
    const tree = await app.render(); assert.deepEqual({ ...nodes(tree, 'Profile')[0].props.member }, { id, name, role });
    nodes(tree, 'Profile')[0].props.onClose(); await app.render();
  }
  const count = app.calls.length; action(app.tree,'Invite to Project').props.onPress();
  assert.equal(app.attempts(), 1); assert.equal(app.calls.length, count);
});

test('committed drawer filters use the existing role-specific API and preserve the independent search query', async () => {
  const app = await directory(); let drawer=await openFilters(app);
  assert.equal(nodes(app.tree,'Field').length,0);
  drawer.props.onApply({type:'worker',specialty:'Mason',skills:['Masonry'],minRate:'',maxRate:''}); drawer.props.onClose();let tree=await app.render();
  assert.deepEqual(nodes(tree,'Identity').map(n=>n.props.person.id),[11]);
  assert.equal(app.calls.filter(c=>c[0]==='workers').at(-1)[1].trade,'Mason');
  assert.deepEqual(Array.from(app.calls.filter(c=>c[0]==='workers').at(-1)[1].skills),['Masonry']);
  assert.match(nodes(tree,'Button').find(n=>n.props.accessibilityLabel==='Filter workers').props.accessibilityHint,/3 active/);
  drawer=await openFilters(app);assert.equal(drawer.props.initial.specialty,'Mason');drawer.props.onClear();drawer.props.onClose();tree=await app.render();
  change(tree,'Search workers and contractors','Construction Company');tree=await app.render();
  assert.deepEqual(nodes(tree,'Identity').map(n=>n.props.person.id),[21]);
  drawer=await openFilters(app);drawer.props.onApply({type:'contractor',specialty:'Residential',skills:['Renovation'],minRate:'',maxRate:''});drawer.props.onClose();tree=await app.render();
  assert.equal(nodes(tree,'Search')[0].props.value,'Construction Company');assert.deepEqual(nodes(tree,'Identity').map(n=>n.props.person.id),[21]);
  assert.ok(app.calls.filter(c=>c[0]==='workers').every(c=>!('specialization'in c[1])));assert.ok(app.calls.filter(c=>c[0]==='contractors').every(c=>!('trade'in c[1])));
});

test('each directory handles failure independently and never presents an API failure as an empty list', async () => {
  let fail=true; const app=await directory({ workers:async()=>{if(fail)throw Error('Connection unavailable');return [];} });
  assert.match(text(app.tree).replace(/\s+/g,' '),/Could not load approved workers/); assert.doesNotMatch(text(app.tree),/No approved workers/);
  assert.deepEqual(nodes(app.tree,'Identity').map(n=>n.props.person.id),[21]);
  fail=false; action(app.tree,'Retry workers').props.onPress(); const tree=await app.render();
  assert.match(text(tree).replace(/\s+/g,' '),/No approved workers are available yet/); assert.doesNotMatch(text(tree),/Connection unavailable/);
});

test('a stale directory result cannot replace the results of newer filters', async () => {
  const old=deferred();let count=0;const app=await directory({workers:()=>{if(++count===1)throw Error('Unavailable');if(count===2)return old.promise;return Promise.resolve([worker(13,{minDailyWage:700})]);}});
  action(app.tree,'Retry workers').props.onPress();await app.render();const drawer=await openFilters(app);
  drawer.props.onApply({type:'worker',specialty:'',skills:[],minRate:'600',maxRate:''});drawer.props.onClose();let tree=await app.render();
  old.resolve([worker(99,{minDailyWage:900})]);tree=await app.render();assert.deepEqual(nodes(tree,'Identity').map(n=>n.props.person.id),[13]);
  app.h.unmount();
});

function flow(options={}) {
  const h=hooks(),routes=[],resumed=[],alerts=[];let creates=0;
  const context={ready:true,planningSessionsReady:true,activeProjectKey:'draft:blank',planningSessions:[],resumePlanningSession:key=>{resumed.push(key);return true;},refreshProjectSelection:async()=>{},...options};
  const module=load('src/components/homeowner/ProjectHiringPrompt.tsx',{
    react:h.react,'react/jsx-runtime':runtime,'react-native':{Alert:{alert:(...args)=>alerts.push(args)},Text:'Text',View:'View'},
    'expo-router':{router:{push:path=>routes.push(path)}},'@/context/PlanContext':{usePlan:()=>context},'@/context/ThemeContext':{useTheme:()=>theme},
    '@/hooks/useNewProjectFlow':{useNewProjectFlow:()=>({creatingProject:false,requestNewProject:()=>creates++,createError:null})},
    './WorkersTabUI':{Action:'Action',WorkersSectionTitle:'Title'},
  });
  return{render:()=>h.render(module.useHiringProjectPrompt),routes,resumed,alerts,creates:()=>creates,required:module.PROJECT_REQUIRED};
}

test('project actions are explicit, preserve unfinished conversations, and cannot create while selection is unverified', async()=>{
  const empty=flow();let current=await empty.render();assert.equal(empty.creates(),0);assert.equal(current.label,'Start a Project');
  current.requireProject();assert.equal(empty.alerts[0][1],empty.required);assert.equal(empty.creates(),0);
  empty.alerts[0][2][1].onPress();assert.equal(empty.creates(),1);
  const draft=flow({planningSessions:[{key:'draft:saved',title:'Saved project'}]});current=await draft.render();assert.equal(current.label,'Continue Project');current.start();
  assert.deepEqual(draft.resumed,['draft:saved']);assert.deepEqual(draft.routes,['/homeowner/project-chat']);assert.equal(draft.creates(),0);
  const checking=flow({ready:false,planningSessionsReady:false});current=await checking.render();current.start();current.requireProject();
  assert.equal(checking.creates(),0);assert.equal(checking.alerts[0][2].length,1);assert.equal(current.disabled,true);
  const selected=flow({activeProjectKey:'7',planningSessions:[{key:'draft:unrelated',title:'Other draft'}]});current=await selected.render();current.start();
  assert.deepEqual(selected.resumed,[]);assert.equal(selected.creates(),0);assert.deepEqual(selected.routes,['/homeowner/project-chat']);
});

test('Workers and Find Your Team routes expose browsing without a full-screen lifecycle gate while retaining per-project keys',()=>{
  let context={activeProjectKey:'draft:one',ready:false};
  for(const [file,name] of [['src/app/(app)/homeowner/(tabs)/marketplace.tsx','Dashboard'],['src/app/(app)/homeowner/find-team.tsx','Browse']]){
    const Route=load(file,{'react/jsx-runtime':runtime,'expo-router':{useLocalSearchParams:()=>({})},'@/context/PlanContext':{usePlan:()=>context},'@/screens/homeowner/WorkersDashboard':defaults('Dashboard'),'@/screens/homeowner/FindWorkers':defaults('Browse')}).default;
    const first=Route();assert.equal(first.type,name);context={activeProjectKey:'7',ready:true};assert.notEqual(Route().key,first.key);context={activeProjectKey:'draft:one',ready:false};
  }
});

async function browser(options={}) {
  const h=hooks(),calls=[],routes=[];let prompts=0;
  let current=h;
  const react=Object.fromEntries(Object.keys(h.react).map(name=>[name,(...args)=>current.react[name](...args)]));
  const context={ready:options.ready??true,activeProjectKey:options.key??'draft:blank',refreshProjectSelection:async()=>{calls.push(['validate']);}};
  const Component=load('src/screens/homeowner/FindWorkers.tsx',{
    react,'react/jsx-runtime':runtime,'expo-router':{useFocusEffect:fn=>h.react.useEffect(fn,[fn])},
    'react-native':{Text:'Text',View:'View',Pressable:'Pressable',ActivityIndicator:'Spinner'},'@expo/vector-icons':{Ionicons:'Icon'},
    '@/components/ui':Object.fromEntries(['Badge','Card','Field','PageHeader','Screen','SubmitButton'].map(n=>[n,n])),
    '@/context/PlanContext':{usePlan:()=>context},'@/context/ThemeContext':{useTheme:()=>theme},
    '@/services/api/workers':{searchWorkers:async params=>{calls.push(['workers',params]);return options.workers?options.workers(params):[worker(11)];}},
    '@/services/api/contractors':{searchContractors:async params=>{calls.push(['contractors',params]);return[contractor(21)];}},
    '@/services/api/projects':{
      fetchActiveDashboard:async id=>{calls.push(['dashboard',id]);return options.dashboard ? options.dashboard(id) : {project:options.project??null};},
      fetchHiringWages:async id=>{calls.push(['wages',id]);return{workers:[],contractors:[]};},
      assignWorkerToProject:async (...args)=>calls.push(['invite-worker',...args]),
      assignContractorToProject:async (...args)=>calls.push(['invite-contractor',...args]),
    },
    '@/services/api/homeownerTeam':{fetchHomeownerTeam:async id=>{calls.push(['team',id]);if(options.teamError)throw new Error('Team unavailable');return{
      recommendations:options.recommendations??null,
      pendingWorkers:calls.filter(c=>c[0]==='invite-worker'&&c[1]===id).map(c=>({workerId:c[2]})),
      pendingContractorIds:calls.filter(c=>c[0]==='invite-contractor'&&c[1]===id).map(c=>c[2]),
    };}},
    '@/utils/currency':{},'@/utils/wage':{}, '@/components/ProfilePhoto':{ProfileAvatar:'Avatar'},
    '@/components/homeowner/TeamProfileDetails':defaults('Profile'),
    '@/components/homeowner/WorkersDirectory':defaults('Directory'),
    '@/components/homeowner/TeamRecommendations':{...defaults('Recommendations'),RecommendationFacts:'Facts'},
    '@/components/homeowner/ProjectHiringPrompt':{...defaults('ProjectPrompt'),useHiringProjectPrompt:()=>({requireProject:()=>prompts++})},
  }).default;
  const render=()=>{current=h;return h.render(Component);};
  const renderCard=async node=>{const child=hooks();current=child;const result=await child.render(()=>node.type(node.props));current=h;return result;};
  return{render,renderCard,context,tree:await render(),calls,routes,prompts:()=>prompts,h};
}

test('the existing advanced browser loads unfiltered records before project hydration and exposes public profiles',async()=>{
  const app=await browser({ready:false});
  const shared=await directory({props:nodes(app.tree,'Directory')[0].props});
  assert.deepEqual(shared.calls.map(c=>c[0]),['workers','contractors']);
  assert.ok(shared.calls.every(c=>c[1].skills.length===0));
  assert.equal(nodes(shared.tree,'BuildTeamBanner').length,0);
  const card=nodes(shared.tree,'WorkerCard')[0];assert.equal(card.props.projectId,null);card.props.onView();
  let tree=await app.render();assert.equal(nodes(tree,'Profile')[0].props.member.id,11);
  assert.equal(nodes(shared.tree,'ContractorCard')[0].props.contractor.id,21);assert.equal(nodes(shared.tree,'ContractorCard')[0].props.projectId,null);
  nodes(shared.tree,'ContractorCard')[0].props.onNeedsProject();
  assert.equal(app.prompts(),1);
  assert.equal(app.calls.length,0);
});

test('Find Your Team shows only the selected project recommendation snapshot and keeps manual cards independent',async()=>{
  const match={...worker(11),matchedSkills:['Painting'],reason:'Recorded Painting matches the saved repainting phase.',estimatedDays:7,estimatedWage:3500,budgetFit:true,bestMatch:true};
  const recommendations={projectId:7,projectTitle:'Approved room repainting',planApproved:true,workers:[match],contractors:[]};
  const app=await browser({key:'7',project:{id:7,title:'Approved room repainting',status:'active',workers:[],contractors:[]},recommendations});
  let tree=app.tree;
  const recommended=nodes(nodes(tree,'Directory')[0].props.header,'Recommendations')[0].props;
  assert.equal(recommended.data.projectId,7);assert.equal(recommended.data.workers[0].id,11);
  assert.equal(recommended.renderWorker(match).props.recommendation.reason,match.reason);
  assert.equal(recommended.renderWorker(match).props.projectId,7);
  assert.equal(nodes(tree,'Directory')[0].props.workerTitle,'Other Skilled Workers');
  assert.equal(nodes(tree,'Directory')[0].props.renderWorker(worker(11)).props.recommendation,undefined);
  recommended.renderWorker(match).props.onView();tree=await app.render();assert.equal(nodes(tree,'Profile')[0].props.member.id,11);
  app.context.activeProjectKey='8';tree=await app.render();
  assert.equal(nodes(nodes(tree,'Directory')[0].props.header,'Recommendations')[0].props.data,null);
});

test('Find Your Team errors preserve manual browsing and repeated recommended/manual invitation taps share one lock',async()=>{
  const error=await browser({key:'7',project:{id:7,title:'Approved',status:'active',workers:[],contractors:[]},teamError:true});
  assert.equal(nodes(error.tree,'Directory').length,1);
  assert.equal(nodes(nodes(error.tree,'Directory')[0].props.header,'Recommendations')[0].props.failed,true);
  const match={...worker(11),matchedSkills:['Masonry']};
  const app=await browser({key:'7',project:{id:7,title:'Approved',status:'active',workers:[],contractors:[]},recommendations:{projectId:7,planApproved:true,workers:[match],contractors:[]}});
  const a=await app.renderCard(nodes(nodes(app.tree,'Directory')[0].props.header,'Recommendations')[0].props.renderWorker(match));
  const b=await app.renderCard(nodes(app.tree,'Directory')[0].props.renderWorker(match));
  nodes(a,'AssignButton')[0].props.onPress();nodes(b,'AssignButton')[0].props.onPress();await tick();
  assert.equal(app.calls.filter(c=>c[0]==='invite-worker').length,1);
  assert.deepEqual(app.calls.find(c=>c[0]==='invite-worker'),['invite-worker',7,11]);
});

test('the advanced browser enables project actions only for the exact eligible project, never a draft or completed project',async()=>{
  for(const status of ['not_started','completed','active']){
    const app=await browser({key:'7',project:{id:7,title:'Selected project',status,workers:[],contractors:[]}});
    const card=nodes(app.tree,'Directory')[0].props.renderWorker(worker(11));
    const active=status==='active';assert.equal(card.props.projectId,active?7:null);
    assert.equal(nodes(app.tree,'Directory')[0].props.showProjectPrompt,!active);
    assert.equal(app.calls.filter(c=>c[0]==='team').length,active?1:0);assert.equal(app.calls.filter(c=>c[0]==='wages').length,active?1:0);
    assert.ok(app.calls.filter(c=>['dashboard','team','wages'].includes(c[0])).every(c=>c[1]===7));
  }
});

test('old project responses cannot enable invitations after the selected project changes',async()=>{
  const old=deferred();const app=await browser({key:'7',dashboard:id=>id===7?old.promise:Promise.resolve({project:{id:8,title:'New',status:'active',workers:[],contractors:[]}})});
  app.context.activeProjectKey='8';let tree=await app.render();
  old.resolve({project:{id:7,title:'Old',status:'active',workers:[],contractors:[]}});tree=await app.render();
  assert.equal(nodes(tree,'Directory')[0].props.renderWorker(worker(11)).props.projectId,8);
  assert.equal(app.calls.some(c=>c[0]==='team'&&c[1]===7),false);
  app.h.unmount();
});

test('standalone directory retains both invitation APIs, selected project, pending states and profile actions',async()=>{
  const app=await browser({key:'7',project:{id:7,title:'Current',status:'active',workers:[],contractors:[]}});
  for(const [role,person]of [['worker',worker(11)],['contractor',contractor(21)]]){
    const props=nodes(await app.render(),'Directory')[0].props;
    const card=role==='worker'?props.renderWorker(person):props.renderContractor(person);
    const rendered=await app.renderCard(card);
    await nodes(rendered,'AssignButton')[0].props.onPress();
    assert.deepEqual(app.calls.find(c=>c[0]==='invite-'+role),['invite-'+role,7,person.id]);
    const next=nodes(await app.render(),'Directory')[0].props;
    assert.equal((role==='worker'?next.renderWorker(person):next.renderContractor(person)).props.pending,true);
    card.props.onView();assert.equal(nodes(await app.render(),'Profile')[0].props.member.id,person.id);
  }
  assert.equal(app.context.activeProjectKey,'7');
});

test('fresh PandAI directory entries remount local filters without changing project context or the Workers tab',()=>{
  const context={activeProjectKey:'7',ready:true};let directorySession='first';
  const Route=load('src/app/(app)/homeowner/find-team.tsx',{'react/jsx-runtime':runtime,'expo-router':{useLocalSearchParams:()=>({directorySession})},'@/context/PlanContext':{usePlan:()=>context},'@/screens/homeowner/FindWorkers':defaults('Browse')}).default;
  const first=Route();directorySession='second';assert.notEqual(Route().key,first.key);assert.equal(context.activeProjectKey,'7');
});

test('the reused directory preserves theme surfaces and restores both user types when drawer filters are cleared',async()=>{
  for(const card of ['#fff','#1c222b']){
    const app=await directory({theme:{...theme,chrome:{...theme.chrome,card}}});
    assert.equal(nodes(app.tree,'Button').find(n=>n.props.accessibilityLabel==='Filter workers').props.style.backgroundColor,card);
    let drawer=await openFilters(app);drawer.props.onApply({type:'worker',specialty:'Mason',skills:[],minRate:'',maxRate:''});drawer.props.onClose();
    assert.deepEqual(nodes(await app.render(),'Identity').map(n=>n.props.person.id),[11]);
    drawer=await openFilters(app);drawer.props.onClear();drawer.props.onClose();
    assert.deepEqual(nodes(await app.render(),'Identity').map(n=>n.props.person.id),[11,12,21]);
  }
});

test('adding project-management sections keeps one loaded directory, existing photos and both unfiltered API requests',async()=>{
  const props={beforeBanner:null,children:null,showProjectPrompt:true};
  const app=await directory({props,workers:async()=>[worker(11,{photoUrl:'/api/account/photo/11/saved.jpg'})]});
  assert.equal(nodes(app.tree,'Screen').length,1);assert.deepEqual(app.calls.map(c=>c[0]),['workers','contractors']);
  props.beforeBanner={type:'Overview',props:{children:'Team Overview'}};
  props.children={type:'Management',props:{children:['Pending Applications','Current Team','Recommended Workers']}};
  props.showProjectPrompt=false;
  const tree=await app.render();
  assert.deepEqual(app.calls.map(c=>c[0]),['workers','contractors'],'project sections do not remount or refetch the directory');
  assert.equal(nodes(tree,'Screen').length,1);assert.equal(nodes(tree,'Overview').length,1);assert.equal(nodes(tree,'Management').length,1);
  assert.equal(nodes(tree,'Avatar')[0].props.url,'/api/account/photo/11/saved.jpg');
  assert.ok(text(tree).indexOf('Explore Contractors')<text(tree).indexOf('Pending Applications'));
});
