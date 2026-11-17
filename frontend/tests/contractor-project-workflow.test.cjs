const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,hooks,nodes,text,runtime,defaults,deferred,theme}=require('./helpers/account-harness.cjs');
const status=load('src/utils/projectStatus.ts',{});
const utils=load('src/utils/contractorHistory.ts',{'@/utils/projectStatus':status});
const phase={id:80,name:'Saved phase',progressPct:0,tasks:[{id:90,description:'Saved task',isDone:false}]};
const project=(id=7,extra={})=>({id,title:'Project '+id,ownerName:'Saved owner',location:'Saved location',status:'active',budget:2500000,totalEstimate:2100000,overallProgressPct:0,
  startedAt:'2027-01-01',timelineValue:2,timelineUnit:'months',canManageChecklist:true,checklistLocked:false,canSubmitCompletion:false,
  checklist:{pct:0,doneTasks:0,totalTasks:1},phases:[phase],workers:[],contractors:[{id:10}],...extra});
const month=(key,task)=>({key,label:key==='2027-01'?'January 2027':'February 2027',year:2027,month:key==='2027-01'?1:2,isCurrent:key==='2027-01',plannedPct:50,actualPct:0,phases:[{id:80,name:'Saved phase'}],tasks:[task]});
const task=(id,date)=>({id,description:'Task '+id,phaseId:80,phaseName:'Saved phase',plannedStart:date,plannedEnd:date,isDone:false,completedAt:null,status:'upcoming'});
const timeline=(id=7)=>({projectId:id,title:'Project '+id,startDate:'2027-01-01',endDate:'2027-02-28',timelineValue:2,timelineUnit:'months',today:'2027-01-01',
  overall:{plannedPct:10,actualPct:0,variancePct:-10,status:'slightly_behind',daysRemaining:58,tasks:{done:0,total:2,overdue:0}},phases:[],months:[month('2027-01',task(90,'2027-01-20')),month('2027-02',task(91,'2027-02-20'))]});

test('Ongoing Projects uses actual assignment/lifecycle filters, includes zero and 100 percent ongoing records, and opens exact IDs',()=>{
  const routes=[];
  const data=[project(7),project(8,{overallProgressPct:100}),project(9,{status:'completed',overallProgressPct:100}),project(11,{status:'pending_confirmation'}),project(12,{status:'not_started'}),project(13,{contractors:[{id:99}]}),project(14,{completion:{confirmedAt:'2027-01-01'}})];
  const Screen=load('src/screens/contractor/OngoingProjects.tsx',{'react/jsx-runtime':runtime,'react-native':{ActivityIndicator:'Spinner',Pressable:'Button',Text:'Text',View:'View'},'expo-router':{router:{push:path=>routes.push(path)}},'@expo/vector-icons':{Ionicons:'Icon'},
    '@/components/ui':Object.fromEntries(['Badge','Card','PageHeader','ProgressBar','Screen'].map(n=>[n,n])),'@/components/contractor/HistoryUI':{ProjectPlaceholder:'Placeholder'},
    '@/context/AuthContext':{useAuth:()=>({user:{id:10}})},'@/hooks/useFocusedResource':{useFocusedResource:()=>({data,loading:false,refresh(){}})},'@/services/api/projects':{},'@/utils/contractorHistory':utils,'@/utils/currency':{peso:value=>String(value)}}).default;
  const tree=Screen();assert.equal(nodes(tree,'PageHeader')[0].props.title,'Ongoing Projects');assert.equal(nodes(tree,'PageHeader')[0].props.subtitle,undefined);
  const cards=nodes(tree,'Button').filter(n=>n.props.accessibilityLabel?.startsWith('Open '));assert.equal(cards.length,3);
  cards.forEach(n=>n.props.onPress());assert.deepEqual(routes,['/contractor/project/7','/contractor/project/8','/contractor/project/11']);
  assert.equal(nodes(tree,'ProgressBar')[0].props.pct,0);assert.doesNotMatch(text(tree),/Projects you're assigned|Manage checklist/);
  data.splice(0);assert.match(text(Screen()),/No ongoing projects yet/);
});

test('existing ongoing and History routes select keyed details, never a fallback project or an active global context',()=>{
  let params={projectId:'7'};
  const mocks={'react/jsx-runtime':runtime,'expo-router':{useLocalSearchParams:()=>params},'@/screens/contractor/ProjectDetails':defaults('Details'),'@/screens/contractor/OngoingProjects':defaults('List')};
  const Route=load('src/screens/contractor/ProjectManagement.tsx',mocks).default;
  assert.equal(Route().props.projectId,7);const first=Route().key;params={projectId:'8'};assert.notEqual(Route().key,first);
  params={};assert.equal(Route().type,'List');params={projectId:'bad'};assert.ok(Number.isNaN(Route().props.projectId));
  const History=load('src/screens/contractor/CompletedProject.tsx',mocks).default;params={id:'9'};assert.equal(History().props.projectId,9);assert.equal(History().props.history,true);
});

test('detail loader validates assignment and IDs before schedule/history reads, and retains checklist data on timeline failure',async()=>{
  const calls=[];let records=[project()];let savedTimeline=timeline();
  const api=load('src/services/api/contractorProjects.ts',{'@/services/api/projects':{fetchMyProjects:async()=>{calls.push('projects');return records;}},'@/services/api/timeline':{fetchProjectTimeline:async id=>{calls.push(['timeline',id]);return savedTimeline;}},'@/services/api/contractorHistory':{fetchContractorHistoryDetails:async id=>{calls.push(['history',id]);return{id};}}});
  for(const id of [0,-1,NaN,1.5])await assert.rejects(api.fetchContractorProjectDetails(id,10));assert.equal(calls.length,0);
  await assert.rejects(api.fetchContractorProjectDetails(8,10));await assert.rejects(api.fetchContractorProjectDetails(7,99));assert.ok(calls.every(c=>c==='projects'));
  const data=await api.fetchContractorProjectDetails(7,10);assert.equal(data.project.id,7);assert.equal(data.timeline.projectId,7);
  await assert.rejects(api.fetchContractorProjectDetails(7,10,true));
  savedTimeline=timeline(8);const mismatch=await api.fetchContractorProjectDetails(7,10);assert.equal(mismatch.timeline,null);assert.equal(mismatch.project.phases[0].id,80);assert.ok(mismatch.timelineError);
  records=[project(7,{status:'completed'})];savedTimeline=timeline();const history=await api.fetchContractorProjectDetails(7,10,true);assert.equal(history.historyDetails.id,7);assert.equal(history.project.status,'completed');
});

async function details(options={}) {
  const h=hooks(),calls=[],routes=[];let id=options.id??7;let snapshot=project(id,options.project);
  const resource=load('src/hooks/useFocusedResource.ts',{react:h.react,'expo-router':{useFocusEffect:fn=>h.react.useEffect(fn,[fn])},'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})}}},{setInterval:()=>0,clearInterval(){}});
  const Screen=load('src/screens/contractor/ProjectDetails.tsx',{react:h.react,'react/jsx-runtime':runtime,'react-native':{ActivityIndicator:'Spinner',Pressable:'Button',ScrollView:'Scroll',Text:'Text',View:'View'},'expo-router':{router:{replace:path=>routes.push(path),canGoBack:()=>!!options.previous,back:()=>routes.push('back')}},
    '@/components/ui':Object.fromEntries(['Badge','Card','PageHeader','Screen'].map(n=>[n,n])),'@/components/contractor/HistoryUI':{ContractorInfoRow:'Info'},'@/components/ProjectChecklistCard':defaults('Checklist'),
    '@/screens/contractor/ProjectOperations':defaults('Operations'),'@/screens/timeline/ProjectCalendar':{ProjectCalendarContent:'Calendar'},'@/context/AuthContext':{useAuth:()=>({user:{id:10}})},'@/context/ThemeContext':{useTheme:()=>theme},'@/hooks/useFocusedResource':resource,
    '@/services/api/contractorProjects':{fetchContractorProjectDetails:async (...args)=>{calls.push(args);return options.load?options.load(...args):{project:snapshot,timeline:timeline(id),historyDetails:null};}},'@/utils/contractorHistory':utils,'@/utils/projectStatus':status,'@/utils/currency':{peso:n=>String(n)}}).default;
  const render=()=>h.render(()=>Screen({projectId:id,history:!!options.history}));
  return{tree:await render(),render,calls,routes,setId:value=>id=value,setProject:value=>snapshot=value,h};
}

test('four detail sections reuse one refresh, retain the exact project and refresh checklist plus calendar together',async()=>{
  const app=await details();assert.deepEqual(app.calls,[[7,10,false]]);
  let tree=app.tree;
  for(const [name,section]of [['Calendar','calendar'],['AI Schedule','schedule'],['Checklist','none'],['Overview','overview']]){
    nodes(tree,'Button').find(n=>n.props.accessibilityLabel===name).props.onPress();tree=await app.render();
    assert.equal(nodes(tree,'Calendar')[0].props.timeline.projectId,7);assert.equal(nodes(tree,'Calendar')[0].props.section,section);
  }
  assert.equal(app.calls.length,1,'switching sections creates no extra fetch or poller');
  nodes(tree,'Button').find(n=>n.props.accessibilityLabel==='Checklist').props.onPress();tree=await app.render();
  const checklist=nodes(tree,'Checklist')[0];assert.equal(checklist.props.readOnly,false);assert.equal(checklist.props.project.id,7);
  app.setProject(project(7,{overallProgressPct:100}));await checklist.props.onChanged();tree=await app.render();assert.equal(nodes(tree,'Checklist')[0].props.project.overallProgressPct,100);assert.equal(app.calls.length,2);
});

test('completion locks the checklist immediately and routes to History; old project responses never enter the new view',async()=>{
  const completed=await details({project:{status:'completed',checklistLocked:true}});assert.ok(completed.routes.includes('/contractor/history/7'));
  nodes(completed.tree,'Button').find(n=>n.props.accessibilityLabel==='Checklist').props.onPress();assert.equal(nodes(await completed.render(),'Checklist')[0].props.readOnly,true);
  const a=deferred(),b=deferred();const app=await details({load:id=>id===7?a.promise:b.promise});app.setId(8);await app.render();
  b.resolve({project:project(8),timeline:timeline(8)});let tree=await app.render();assert.match(text(tree),/Project 8/);
  a.resolve({project:project(7),timeline:timeline(7)});tree=await app.render();assert.equal(nodes(tree,'Calendar')[0].props.timeline.projectId,8);assert.doesNotMatch(text(tree),/Project 7/);
  const history=await details({history:true,project:{status:'completed'}});assert.equal(history.routes.length,0);
});

test('calendar month switching and schedule/overview views reuse saved task dates and progress without requests',async()=>{
  const h=hooks();const saved=timeline();const Content=load('src/screens/timeline/ProjectCalendar.tsx',{react:h.react,'react/jsx-runtime':runtime,'react-native':{ActivityIndicator:'Spinner',Pressable:'Button',ScrollView:'Scroll',Text:'Text',View:'View'},'@expo/vector-icons':{Ionicons:'Icon'},
    '@/components/ui':Object.fromEntries(['Badge','Card','InfoBox','ProgressBar','StatGrid','StatTile'].map(n=>[n,n])),'@/components/charts':{GrowBar:'GrowBar'},'@/context/ThemeContext':{useTheme:()=>theme},'@/services/api/timeline':{},'@/hooks/useFocusedResource':{},'@/utils/timeline':load('src/utils/timeline.ts',{}),'@/utils/projectOverview':load('src/utils/projectOverview.ts',{})}).ProjectCalendarContent;
  let section='calendar';const render=()=>h.render(()=>Content({timeline:saved,section}));let tree=await render();
  let calendar=nodes(tree,'MonthCalendar')[0];let monthView=calendar.type(calendar.props);assert.ok(nodes(monthView,'Card').some(n=>n.props.title==='Scheduled Activities'));
  assert.equal(nodes(monthView,'TaskRow')[0].props.task.id,90);calendar.props.onNext();tree=await render();calendar=nodes(tree,'MonthCalendar')[0];monthView=calendar.type(calendar.props);
  assert.equal(nodes(monthView,'TaskRow')[0].props.task.id,91);assert.ok(nodes(monthView,'Card').some(n=>n.props.title==='Scheduled Activities'));
  section='overview';tree=await render();assert.equal(nodes(tree,'ScheduleSummary')[0].props.timeline.overall.actualPct,0);assert.equal(nodes(tree,'MonthlyChart').length,1);
  section='schedule';tree=await render();assert.equal(nodes(tree,'PhaseSchedule').length,1);section='calendar';assert.equal(nodes(await render(),'MonthCalendar')[0].props.month.key,'2027-02');
});

test('completed checklists are readable and collapsible while all mutation controls remain absent or disabled',async()=>{
  const h=hooks(),calls=[];const Card=load('src/components/ProjectChecklistCard.tsx',{react:h.react,'react/jsx-runtime':runtime,'react-native':{Text:'Text',View:'View',Pressable:'Button'},'@expo/vector-icons':{Ionicons:'Icon'},'@/components/ui':{Button:'Action',Field:'Field',ProgressBar:'Bar'},'@/components/ConfirmDialog':{useConfirmDialog:()=>({ask(){},dialog:null})},'@/utils/checklist':load('src/utils/checklist.ts',{}),'@/utils/timeline':load('src/utils/timeline.ts',{}),'@/utils/projectOverview':load('src/utils/projectOverview.ts',{}),'@/services/api/projects':new Proxy({},{get:(_,key)=>async()=>calls.push(key)}),'@/context/ThemeContext':{useTheme:()=>theme}}).default;
  const render=()=>h.render(()=>{const root=Card({project:project(7,{status:'completed',canManageChecklist:false,checklistLocked:true}),readOnly:true,collapsible:true,onChanged:async()=>{}});const phase=nodes(root,'PhaseChecklist')[0];return phase.type(phase.props);});
  let tree=await render();assert.equal(nodes(tree,'Field').length,0);assert.equal(nodes(tree,'Action').length,0);
  const checkbox=nodes(tree,'Button').find(n=>n.props.accessibilityRole==='checkbox');assert.equal(checkbox.props.disabled,true);checkbox.props.onPress();assert.equal(calls.length,0);
  nodes(tree,'Button').find(n=>n.props.accessibilityLabel==='Saved phase checklist').props.onPress();tree=await render();assert.equal(nodes(tree,'Button').filter(n=>n.props.accessibilityRole==='checkbox').length,0);
});

function duplicateSiblingKeys(node,found=[]) {
  if(!node||typeof node!=='object')return found;
  if(Array.isArray(node)){
    const seen=new Set();
    for(const item of node){
      if(item&&typeof item==='object'&&!Array.isArray(item)&&item.key!=null){if(seen.has(String(item.key)))found.push(String(item.key));seen.add(String(item.key));}
      duplicateSiblingKeys(item,found);
    }
  }else duplicateSiblingKeys(node.props?.children,found);
  return found;
}

test('project 21 gives calendar, operations and checklist distinct stable sibling keys across all detail sections',async()=>{
  for(const history of [false,true]){
    const app=await details({id:21,history,project:history?{status:'completed',checklistLocked:true}:{}});let tree=app.tree;
    for(const tab of ['Overview','Calendar','AI Schedule','Checklist','Overview']){
      nodes(tree,'Button').find(n=>n.props.accessibilityLabel===tab).props.onPress();tree=await app.render();
      assert.deepEqual(duplicateSiblingKeys(tree),[],tab+' must not produce duplicate key 21');
      assert.equal(nodes(tree,'Calendar')[0].key,'project-21-timeline');
      if(tab==='Overview')assert.equal(nodes(tree,'Operations')[0].key,'project-21-operations');
      if(tab==='Checklist'){
        assert.equal(nodes(tree,'Checklist')[0].key,'project-21-checklist');
        assert.equal(nodes(tree,'Checklist')[0].props.project.phases[0].tasks.length,1,'no task is removed to solve a key collision');
      }
    }
    assert.equal(app.calls.length,1,'keys do not cause random remounts or refetches');
  }
});

test('dedicated project route reuses one branded header and exact-ID details; back respects the navigation origin',async()=>{
  const Route=load('src/app/(app)/contractor/project/[id].tsx',{'react/jsx-runtime':runtime,'react-native':{View:'View'},'expo-router':{useLocalSearchParams:()=>({id:'21'})},'@/components/HomeownerHeader':defaults('Header'),'@/screens/contractor/ProjectDetails':defaults('Details')}).default;
  const tree=Route();assert.equal(nodes(tree,'Header').length,1);assert.equal(nodes(tree,'Header')[0].props.title,'Project Panday');assert.equal(nodes(tree,'Header')[0].props.subtitle,'Contractor Account');assert.equal(nodes(tree,'Details')[0].props.projectId,21);
  const existing=await details({previous:true});nodes(existing.tree,'Button').find(n=>n.props.accessibilityLabel==='Back to previous screen').props.onPress();assert.deepEqual(existing.routes,['back']);
  const direct=await details();nodes(direct.tree,'Button').find(n=>n.props.accessibilityLabel==='Back to previous screen').props.onPress();assert.deepEqual(direct.routes,['/contractor/projects']);
});
