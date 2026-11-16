const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,hooks,nodes,text,runtime,defaults,theme,deferred}=require('./helpers/account-harness.cjs');
const status=load('src/utils/projectStatus.ts',{});
const history=load('src/utils/workerHistory.ts',{'@/utils/projectStatus':status});
const model=load('src/utils/workerProjects.ts',{});
const wage={amount:850,unit:'per_day',days:30,total:25500,auto:false};
const project=(id=7,extra={})=>({id,title:'Saved site '+id,ownerName:'Recorded owner',status:'active',startedAt:'2027-01-01',projectType:'2-storey project',overallProgressPct:0,workers:[{id:10}],contractors:[],myWage:wage,
  phases:[{id:21,name:'Recorded phase',progressPct:0,tasks:[{id:22,description:'Recorded task',isDone:false}]}],...extra});
const log=(id=1,projectId=7)=>({id,projectId,date:'2027-03-09',summary:'Recorded work activity'});
const earned={projectId:7,projectTitle:'Saved site 7',status:'active',wage,daysWorked:2,hoursWorked:16,earned:1700};

test('Tasks keeps zero and 100 percent ongoing assignments but never completed, confirmed, draft or unassigned projects',()=>{
  let data=[project(7),project(8,{overallProgressPct:100}),project(9,{status:'completed'}),project(11,{status:'pending_confirmation'}),project(12,{status:'not_started'}),project(13,{workers:[{id:99}]}),project(14,{completion:{confirmedAt:'2027-03-10'}})];const routes=[];
  const Screen=load('src/screens/worker/Assignments.tsx',{'react/jsx-runtime':runtime,'react-native':{ActivityIndicator:'Spinner',Pressable:'Button',Text:'Text'},'expo-router':{useLocalSearchParams:()=>({}),router:{push:path=>routes.push(path)}},
    '@/components/ui':Object.fromEntries(['Badge','Card','PageHeader','ProgressBar','Screen'].map(n=>[n,n])),'@/screens/worker/ProjectDetails':defaults('Details'),'@/context/AuthContext':{useAuth:()=>({user:{id:10}})},'@/hooks/useFocusedResource':{useFocusedResource:()=>({data,loading:false,refresh(){}})},'@/services/api/projects':{},'@/utils/workerHistory':history,'@/utils/projectStatus':status,'@/utils/wage':{wageLine:value=>value?'Recorded wage':'No wage set'}}).default;
  const list=Screen();const tree=list.type(list.props);const cards=nodes(tree,'Button').filter(n=>n.props.accessibilityLabel?.startsWith('Open'));
  cards.forEach(n=>n.props.onPress());assert.deepEqual(routes,['/worker/project/7','/worker/project/8','/worker/project/11']);assert.equal(nodes(tree,'ProgressBar')[0].props.pct,0);
  data=[project(9,{status:'completed'})];const empty=list.type(list.props);assert.match(text(empty),/No ongoing assignments yet/);assert.match(text(empty),/active construction projects/);assert.equal(nodes(empty,'ProgressBar').length,0);
});

test('worker detail loader checks assignment before private reads and isolates returned activity to the selected project',async()=>{
  const calls=[];const api=load('src/services/api/workerProjects.ts',{'@/services/api/projects':{fetchMyProjects:async()=>[project()]},'@/services/api/workerActivity':{
    fetchWorkLogs:async id=>{calls.push(['logs',id]);return{date:'2027-03-10',logs:[log(),log(2,8)]};},fetchEarnings:async id=>{calls.push(['earnings',id]);return{projects:[{...earned,projectId:8},earned]};}},'@/services/api/workerHistory':{fetchWorkerHistoryDetails:async()=>({id:7})}});
  for(const [id,worker]of [[0,10],[7,99],[8,10]])await assert.rejects(api.fetchWorkerProjectDetails(id,worker));assert.equal(calls.length,0);
  const saved=await api.fetchWorkerProjectDetails(7,10);assert.deepEqual(calls,[['logs',7],['earnings',7]]);assert.equal(saved.logs.length,1);assert.equal(saved.logs[0].projectId,7);assert.equal(saved.earnings.projectId,7);
  await assert.rejects(api.fetchWorkerProjectDetails(7,10,true));
});

test('activity client sends project-scoped reads and the chosen date through existing endpoints',async()=>{
  const calls=[];const api=load('src/services/api/workerActivity.ts',{'@/services/api/client':{apiFetch:async(...args)=>{calls.push(args);return{};}}});
  await api.fetchWorkLogs(7);await api.fetchEarnings(7);await api.saveWorkLog(7,'Saved work','2027-03-09');
  assert.deepEqual(calls.slice(0,2).map(c=>c[0]),['/api/worker/work-logs?project_id=7','/api/worker/earnings?project_id=7']);
  assert.equal(calls[2][0],'/api/projects/7/work-log');assert.equal(calls[2][1].method,'PUT');assert.deepEqual(JSON.parse(calls[2][1].body),{summary:'Saved work',log_date:'2027-03-09'});
  await api.fetchWorkLogs();assert.equal(calls.at(-1)[0],'/api/worker/work-logs');await assert.rejects(api.fetchEarnings(0));
});

async function details(options={}){
  const h=hooks(),calls=[],routes=[],scrolls=[];let id=7;
  const resource=load('src/hooks/useFocusedResource.ts',{react:h.react,'expo-router':{useFocusEffect:fn=>h.react.useEffect(fn,[fn])},'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})}}},{setInterval:()=>0,clearInterval(){}});
  const Screen=load('src/screens/worker/ProjectDetails.tsx',{react:h.react,'react/jsx-runtime':runtime,'react-native':{ActivityIndicator:'Spinner',Pressable:'Button',ScrollView:'Scroll',Text:'Text',View:'View'},'expo-router':{router:{replace:path=>routes.push(path)}},'@expo/vector-icons':{Ionicons:'Icon'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:24,bottom:20,left:0,right:0})},
    '@/components/ui':{Badge:'Badge',Card:'Card',ProgressBar:'Bar'},'@/components/MessageButton':defaults('Message'),'@/components/worker/ProjectWorkLogs':defaults('Logs'),'@/components/worker/ProjectEarnings':defaults('Earnings'),'@/components/worker/HistoryUI':{WorkerInfoRow:'Info'},
    '@/context/AuthContext':{useAuth:()=>({user:{id:10}})},'@/context/ThemeContext':{useTheme:()=>options.theme??theme},'@/hooks/useFocusedResource':resource,'@/services/api/workerProjects':{fetchWorkerProjectDetails:async(...args)=>{calls.push(args);return options.load?options.load(...args):{project:project(id,options.project),date:'2027-03-10',logs:[log()],earnings:earned,logsError:null,earningsError:null};}},
    '@/utils/workerHistory':history,'@/utils/workerProjects':model,'@/utils/projectStatus':status}).default;
  const render=()=>h.render(()=>Screen({projectId:id,history:!!options.history}));const tree=await render();tree.props.ref.current={scrollTo:value=>scrolls.push(value)};
  return{render,tree,calls,routes,scrolls,setId:value=>id=value,h};
}

test('all three worker sections share one scrolling page; shortcuts and manual scrolling highlight the actual section',async()=>{
  const app=await details();let tree=app.tree;assert.equal(tree.type,'Scroll');assert.equal(nodes(tree,'Logs').length,1);assert.equal(nodes(tree,'Earnings').length,1);assert.equal(nodes(tree,'Message')[0].props.projectId,7);
  const anchors=nodes(tree,'View').filter(n=>n.props.onLayout);assert.equal(anchors.length,3);
  anchors.forEach((anchor,i)=>anchor.props.onLayout({nativeEvent:{layout:{y:300+i*400}}}));
  nodes(tree,'Button').find(n=>n.props.accessibilityLabel==='Daily Work Logs').props.onPress();tree=await app.render();
  assert.equal(app.scrolls.length,1);assert.equal(app.scrolls[0].y,700);assert.equal(app.scrolls[0].animated,true);assert.equal(nodes(tree,'Button').find(n=>n.props.accessibilityState?.selected).props.accessibilityLabel,'Daily Work Logs');
  tree.props.onScroll({nativeEvent:{contentOffset:{y:1150},layoutMeasurement:{height:500},contentSize:{height:1600}}});tree=await app.render();assert.equal(nodes(tree,'Button').find(n=>n.props.accessibilityState?.selected).props.accessibilityLabel,'Earnings');
  assert.equal(app.calls.length,1);assert.equal(nodes(tree,'Logs')[0].props.projectId,7);assert.equal(nodes(tree,'Logs')[0].props.readOnly,false);
  assert.equal(nodes(tree,'Button').filter(n=>n.props.accessibilityRole==='checkbox').length,0,'workers never receive construction progress controls');
});

test('worker completed projects become read-only History without losing activity, and stale project reads cannot leak',async()=>{
  const complete=await details({project:{status:'completed'}});assert.deepEqual(complete.routes,['/worker/history/7']);assert.equal(nodes(complete.tree,'Logs')[0].props.readOnly,true);
  const old=deferred(),next=deferred();const app=await details({load:id=>id===7?old.promise:next.promise});app.setId(8);await app.render();
  next.resolve({project:project(8),logs:[log(2,8)],date:'2027-03-10',earnings:{...earned,projectId:8}});await app.render();
  old.resolve({project:project(7),logs:[log()],date:'2027-03-10',earnings:earned});const tree=await app.render();assert.match(text(tree),/Saved site 8/);assert.equal(nodes(tree,'Logs')[0].props.projectId,8);assert.equal(nodes(tree,'Earnings')[0].props.earnings.projectId,8);
});

test('dated work logs validate before sending, submit once, refresh the selected project and open saved entries',async()=>{
  const h=hooks(),calls=[],gate=deferred(),logs=[];let refreshed=0;
  const Logs=load('src/components/worker/ProjectWorkLogs.tsx',{react:h.react,'react/jsx-runtime':runtime,'react-native':{Pressable:'Button',Text:'Text'},'@/components/ui':{Button:'Action',Card:'Card',Field:'Field'},'@/components/Sheet':defaults('Sheet'),
    '@/services/api/workerActivity':{saveWorkLog:async(...args)=>{calls.push(args);return gate.promise;}},'@/utils/workerProjects':model,'@/utils/workerHistory':history}).default;
  const props={projectId:7,logs,today:'2027-03-10',readOnly:false,error:null,onChanged:async()=>{refreshed++;logs.push({...log(),date:'2027-03-09',summary:'My saved work'});}};
  const render=()=>h.render(()=>Logs(props));let tree=await render();nodes(tree,'Action').find(n=>n.props.label==='Add Work Log').props.onPress();tree=await render();
  let fields=nodes(tree,'Field');fields[1].props.onChangeText('  My saved work  ');tree=await render();nodes(tree,'Field')[0].props.onChangeText('2027-03-09');tree=await render();
  assert.equal(nodes(tree,'Field')[1].props.value,'  My saved work  ','changing the work date preserves the newly typed description');
  const save=nodes(tree,'Action').find(n=>n.props.label==='Save Work Log').props.onPress;save();save();await render();assert.deepEqual(calls,[[7,'My saved work','2027-03-09']]);
  gate.resolve({...log(),date:'2027-03-09',summary:'My saved work'});tree=await render();assert.equal(refreshed,1);assert.equal(nodes(tree,'Sheet').length,0);
  nodes(tree,'Button').find(n=>n.props.accessibilityLabel?.startsWith('View work log')).props.onPress();tree=await render();assert.equal(nodes(tree,'Sheet')[0].props.title,'Work Log Details');
  assert.match(text(nodes(tree,'Sheet')[0]),/My saved work/);props.readOnly=true;assert.equal(nodes(await render(),'Action').some(n=>n.props.label==='Add Work Log'),false);
  assert.ok(model.workLogDateError('2027-03-11','2027-03-10'));assert.ok(model.workLogDateError('2027-02-30','2027-03-10'));assert.ok(model.workLogDateError('2027-03-02','2027-03-10'));assert.equal(model.workLogDateError('2027-03-03','2027-03-10'),null);
});

test('earnings distinguish actual recorded attendance from estimated rates and projected assignment totals',()=>{
  const View=load('src/components/worker/ProjectEarnings.tsx',{'react/jsx-runtime':runtime,'react-native':{Text:'Text'},'@/components/ui':{Card:'Card'},'@/utils/currency':{peso:n=>'PHP '+n}}).default;
  const actual=text(View({earnings:earned,error:null}));assert.match(actual,/Recorded earnings from attendance/);assert.match(actual,/1700/);assert.match(actual,/Projected project wage/);assert.match(actual,/25500/);
  const estimated=text(View({earnings:{...earned,wage:{...wage,auto:true}},error:null}));assert.match(estimated,/Estimated earnings from attendance/);assert.doesNotMatch(estimated,/Recorded earnings from attendance/);
  const unknown=text(View({earnings:null,error:null}));assert.match(unknown,/No wage has been recorded/);assert.doesNotMatch(unknown,/PHP 0/);
  const cleared=text(View({earnings:{...earned,wage:null,earned:null},wage,error:null}));assert.match(cleared,/No wage has been recorded/);assert.doesNotMatch(cleared,/PHP 25500/,'an explicit cleared wage supersedes an older assignment snapshot');
  const fixed=text(View({earnings:{...earned,wage:{...wage,unit:'fixed'},earned:null},error:null}));assert.match(fixed,/Agreed project fee/);assert.doesNotMatch(fixed,/Recorded earnings from attendance/);
  const unknownDays=text(View({earnings:{...earned,wage:{...wage,days:null,total:0}},error:null}));assert.match(unknownDays,/planned workdays are not recorded/);assert.doesNotMatch(unknownDays,/PHP 0/);
  assert.deepEqual([0,30,100].map(value=>model.workerPhaseStatus(value).label),['Upcoming','In Progress','Completed']);
});

test('dedicated worker details reuse the branded Back header and hide the existing main-screen-only footer',()=>{
  const Route=load('src/app/(app)/worker/project/[id].tsx',{'react/jsx-runtime':runtime,'react-native':{View:'View'},'expo-router':{useLocalSearchParams:()=>({id:'7'})},'@/components/HomeownerHeader':defaults('Header'),'@/screens/worker/ProjectDetails':defaults('Details')}).default;
  const tree=Route();assert.equal(nodes(tree,'Header')[0].props.title,'Project Panday');assert.equal(nodes(tree,'Header')[0].props.subtitle,'Project Details');assert.equal(nodes(tree,'Header')[0].props.backTo,'/worker/assignments');assert.equal(nodes(tree,'Details')[0].props.projectId,7);
  const Footer=load('src/components/WorkerFloatingTabBar.tsx',{'react/jsx-runtime':runtime,'react-native':{Pressable:'Button',Text:'Text',View:'View',StyleSheet:{create:s=>s}},'expo-router':{router:{},usePathname:()=>'/worker/project/7'},'@expo/vector-icons':{Ionicons:'Icon'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:20})},'@/context/ThemeContext':{useTheme:()=>theme}}).default;
  assert.equal(Footer(),null);
});
