const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,hooks,nodes,text,deferred,tick,runtime,defaults,theme}=require('./helpers/account-harness.cjs');
const utils=load('src/utils/timeline.ts',{});
const colors=load('src/theme/colors.ts',{});
const activity=(id,extra={})=>({id,description:`Saved activity ${id}`,phaseId:31,phaseName:'Approved phase',plannedStart:'2026-11-15',plannedEnd:'2026-12-05',isDone:false,completedAt:null,status:'in_progress',...extra});
const month=(key,activities=[])=>({key,label:key==='2026-11'?'November 2026':'December 2026',year:2026,month:Number(key.slice(5)),isCurrent:key==='2026-11',plannedPct:25,actualPct:0,phases:[{id:31,name:'Approved phase'}],tasks:activities.filter(t=>t.plannedEnd.startsWith(key)),activities});
const timeline=(id=7)=>({projectId:id,title:`Project ${id}`,today:'2026-11-18',startDate:'2026-11-15',endDate:'2026-12-05',phases:[{id:31,name:'Approved phase',progressPct:0}],months:[month('2026-11',[activity(91)]),month('2026-12',[activity(91)])]});
const project=(id=7)=>({id,title:`Project ${id}`,status:'active',startedAt:'2026-11-15',overallProgressPct:0,phases:[{id:31,name:'Approved phase',progressPct:0,tasks:[]}],workers:[{id:11,name:'Recorded worker'}],contractors:[]});

test('saved activity ranges cover each relevant date and month; empty, running, pending, completed and delayed colors stay distinct',()=>{
  const november=utils.buildMonthGrid(month('2026-11',[activity(91)])).flat().filter(Boolean);
  assert.equal(november.find(d=>d.iso==='2026-11-14').tasks.length,0);
  assert.equal(november.find(d=>d.iso==='2026-11-18').tasks[0].id,91);
  const december=utils.buildMonthGrid(month('2026-12',[activity(91)])).flat().filter(Boolean);
  assert.equal(december.find(d=>d.iso==='2026-12-05').tasks[0].id,91);
  assert.equal(december.find(d=>d.iso==='2026-12-06').tasks.length,0);
  assert.equal(utils.dayDotColor([]),'#6b7280');
  assert.equal(utils.dayDotColor([activity(1)]),'#3b82f6');
  assert.equal(utils.dayDotColor([activity(1,{status:'upcoming'})]),'#f59e0b');
  assert.equal(utils.dayDotColor([activity(1,{status:'overdue'})]),'#ef4444');
  assert.equal(utils.dayDotColor([activity(1,{isDone:true,status:'completed_late'})]),'#10b981');
  assert.equal(utils.taskDurationDays(activity(1)),21);
});

test('calendar supports month navigation, empty-day selection, all overlapping activities and saved selection during refresh in both themes',async()=>{
  for(const mode of ['light','dark']){
    const h=hooks();let saved=timeline();
    const Content=load('src/screens/timeline/ProjectCalendar.tsx',{
      react:h.react,'react/jsx-runtime':runtime,'react-native':{Text:'Text',View:'View',Pressable:'Button',ScrollView:'Scroll',ActivityIndicator:'Spinner'},
      '@expo/vector-icons':{Ionicons:'Icon'},'@/components/ui':Object.fromEntries(['Badge','Card','InfoBox','ProgressBar','StatGrid','StatTile'].map(k=>[k,k])),
      '@/components/charts':{GrowBar:'GrowBar'},'@/context/ThemeContext':{useTheme:()=>({mode,chrome:mode==='dark'?colors.darkChrome:colors.lightChrome})},'@/services/api/timeline':{},'@/hooks/useFocusedResource':{},'@/utils/timeline':utils,'@/utils/projectOverview':load('src/utils/projectOverview.ts',{}),
    }).ProjectCalendarContent;
    const render=()=>h.render(()=>Content({timeline:saved,section:'calendar',selectToday:true,team:[{id:11,name:'Recorded worker',role:'worker',trade:'Mason'}]}));
    let tree=await render();let calendar=nodes(tree,'MonthCalendar')[0];let view=calendar.type(calendar.props);
    assert.equal(calendar.props.selectedDay,'2026-11-18');assert.equal(nodes(view,'TaskRow').length,1);
    assert.equal(nodes(nodes(view,'Button').find(n=>n.props.accessibilityLabel?.startsWith('2026-11-19,')),'Text')[0].props.style.color,mode==='dark'?colors.darkChrome.foreground:colors.lightChrome.foreground);
    assert.match(text(view),/Project team: Recorded worker/);assert.doesNotMatch(text(view),/Task-specific assignments|even distribution/);
    assert.deepEqual(nodes(view,'Legend').map(n=>n.props.color),['#10b981','#3b82f6','#f59e0b','#ef4444','#6b7280']);
    const empty=nodes(view,'Button').find(n=>n.props.accessibilityLabel?.startsWith('2026-11-14,'));assert.notEqual(empty.props.disabled,true);empty.props.onPress();
    tree=await render();calendar=nodes(tree,'MonthCalendar')[0];view=calendar.type(calendar.props);
    assert.match(text(view),/No construction activities scheduled for this date/);assert.equal(nodes(view,'TaskRow').length,0);
    nodes(view,'Button').find(n=>n.props.accessibilityLabel==='Next month').props.onPress();tree=await render();calendar=nodes(tree,'MonthCalendar')[0];view=calendar.type(calendar.props);
    assert.equal(calendar.props.selectedDay,'2026-12-01');assert.equal(nodes(view,'TaskRow')[0].props.task.id,91);
    saved={...saved,assignmentWarnings:[{memberId:11,name:'Recorded worker',role:'worker',overlappingAssignments:1}],phases:[{id:31,progressPct:50}],months:[saved.months[0],month('2026-12',[activity(91,{isDone:true,status:'completed_late',completedAt:'2026-12-07'}),activity(92)])]};
    tree=await render();calendar=nodes(tree,'MonthCalendar')[0];view=calendar.type(calendar.props);
    assert.equal(calendar.props.month.key,'2026-12');assert.equal(nodes(view,'TaskRow').length,2);
    assert.match(text(view),/Confirm availability with your team/);assert.ok(nodes(view,'InfoBox').some(n=>n.props.title==='Potential schedule overlaps'));
    const row=nodes(view,'TaskRow')[0];assert.equal(row.props.phaseProgressPct,50);
    const rowView=row.type(row.props);assert.match(text(rowView),/Actually completed:\s+2026-12-07/);assert.match(text(rowView),/Phase progress:\s+50/);
    assert.equal(nodes(rowView,'Badge')[0].props.color,'#10b981');
    h.unmount();
  }
});

test('progress snapshot uses the exact active project and saved-only API while keeping partial failures distinct',async()=>{
  const calls=[];let state=project(),logError=false,scheduleError=false;
  const api=load('src/services/api/progressMonitor.ts',{
    './projects':{fetchActiveDashboard:async id=>{calls.push(['project',id]);return{project:state};},fetchProjectActivityLog:async id=>{calls.push(['log',id]);if(logError)throw Error('Offline');return[];}},
    './timeline':{fetchProjectTimeline:async(id,saved)=>{calls.push(['timeline',id,saved]);if(scheduleError)throw Error('Saved dates unavailable');return timeline(id);}},
  });
  let result=await api.fetchProgressSnapshot(7);assert.equal(result.timeline.projectId,7);assert.deepEqual(calls,[['project',7],['log',7],['timeline',7,true]]);
  scheduleError=true;result=await api.fetchProgressSnapshot(7);assert.equal(result.project.id,7);assert.equal(result.log.length,0);assert.equal(result.timeline,null);assert.match(result.timelineError,/Saved dates unavailable/);
  logError=true;result=await api.fetchProgressSnapshot(7);assert.equal(result.log,null);assert.match(result.logError,/could not be loaded/);
  for(const status of ['completed','not_started']){state={...project(),status};calls.length=0;assert.equal((await api.fetchProgressSnapshot(7)).project,null);assert.deepEqual(calls,[['project',7]]);}
  state=project(8);assert.equal((await api.fetchProgressSnapshot(7)).project,null);
  await assert.rejects(api.fetchProgressSnapshot(0));
});

test('timeline client validates project IDs and responses without changing the legacy request by default',async()=>{
  const calls=[];let response=timeline();const api=load('src/services/api/timeline.ts',{'@/services/api/client':{apiFetch:async path=>{calls.push(path);return response;}}});
  await api.fetchProjectTimeline(7);await api.fetchProjectTimeline(7,true);
  assert.deepEqual(calls,['/api/projects/7/timeline','/api/projects/7/timeline?saved_only=1']);
  response=timeline(8);await assert.rejects(api.fetchProjectTimeline(7),/did not match/);await assert.rejects(api.fetchProjectTimeline(0));
});

test('Progress Monitor preserves its layout, uses one refresh lifecycle and never shows another project calendar',async()=>{
  const h=hooks();let context={activeProjectKey:'7',ready:true,refreshProjectSelection:async()=>{}};let snapshot={project:project(),timeline:timeline(),log:[],logError:null,timelineError:null};
  const gate=deferred();const calls=[];const resource=load('src/hooks/useFocusedResource.ts',{react:h.react,'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})}},'expo-router':{useFocusEffect:fn=>h.react.useEffect(fn,[fn])}},{setInterval:()=>0,clearInterval:()=>{}});
  const Monitor=load('src/screens/homeowner/ProgressMonitor.tsx',{
    react:h.react,'react/jsx-runtime':runtime,'react-native':{Text:'Text',View:'View',Pressable:'Button',ActivityIndicator:'Spinner'},'expo-router':{router:{push(){}}},'@expo/vector-icons':{Ionicons:'Icon'},
    '@/components/ui':Object.fromEntries(['Badge','Card','InfoBox','PageHeader','ProgressBar','Screen','StatGrid','StatTile'].map(k=>[k,k])),'@/components/charts':{ProgressRing:'Ring'},'@/components/TeamActivity':defaults('Team'),
    '@/services/api/progressMonitor':{fetchProgressSnapshot:async id=>{calls.push(id);return id===8?gate.promise:snapshot;}},'@/screens/timeline/ProjectCalendar':{ProjectCalendarContent:'Calendar'},'@/components/ProjectChecklistCard':defaults('Checklist'),'@/utils/projectStatus':load('src/utils/projectStatus.ts',{}),'@/utils/projectOverview':load('src/utils/projectOverview.ts',{}),
    '@/context/PlanContext':{usePlan:()=>context},'@/hooks/useFocusedResource':resource,
  }).default;
  const render=()=>h.render(Monitor);let tree=await render();
  assert.equal(nodes(tree,'Calendar')[0].props.timeline.projectId,7);assert.equal(nodes(tree,'Team')[0].props.projectId,7);
  const children=nodes(tree,'Screen')[0].props.children.flat().filter(Boolean);
  assert.ok(children.findIndex(n=>n.type==='StatGrid')<children.findIndex(n=>n.type==='Calendar'));
  assert.ok(children.findIndex(n=>n.type==='Calendar')<children.findIndex(n=>n.type==='Checklist'));
  assert.ok(children.findIndex(n=>n.type==='Checklist')<children.findIndex(n=>n.props?.title==='Phases'));
  assert.equal(nodes(tree,'Checklist')[0].props.drawer,true);
  assert.equal(nodes(tree,'Checklist')[0].props.readOnly,true);
  assert.equal(nodes(tree,'Checklist')[0].props.project.id,7);
  snapshot={...snapshot,project:{...project(),canManageChecklist:true,overallProgressPct:50},log:[{date:'2026-11-18',overallProgressPct:50,entries:[]}],timeline:{...timeline(),phases:[{id:31,progressPct:50}]}};
  await nodes(tree,'Checklist')[0].props.onChanged();tree=await render();assert.equal(nodes(tree,'Ring')[0].props.pct,50);
  assert.equal(nodes(tree,'Checklist')[0].props.readOnly,false);
  assert.equal(nodes(tree,'Calendar')[0].props.timeline.phases[0].progressPct,50);
  assert.equal(nodes(tree,'StatTile').find(n=>n.props.label==='Days with activity').props.value,1);
  snapshot={...snapshot,timeline:null,timelineError:'Saved schedule unavailable',log:null,logError:'Updates unavailable'};
  await nodes(tree,'Button').find(n=>text(n).includes('Refresh progress')).props.onPress();tree=await render();
  assert.equal(nodes(tree,'Calendar').length,0);assert.match(text(tree),/Updates unavailable/);
  assert.equal(nodes(tree,'InfoBox')[0].props.children,'Saved schedule unavailable');
  assert.ok(nodes(tree,'Card').some(n=>n.props.title==='Phases'));
  assert.equal(nodes(tree,'StatTile').find(n=>n.props.label==='Days with activity').props.value,'—');
  context={...context,activeProjectKey:'8'};tree=await render();assert.equal(nodes(tree,'Calendar').length,0);assert.doesNotMatch(text(tree),/Project 7/);
  gate.resolve({...snapshot,project:project(8),timeline:timeline(8)});await tick();tree=await render();assert.equal(nodes(tree,'Calendar')[0].props.timeline.projectId,8);assert.equal(nodes(tree,'Checklist')[0].key,'progress-checklist-8');
  assert.deepEqual(calls,[7,7,7,8]);h.unmount();
});
