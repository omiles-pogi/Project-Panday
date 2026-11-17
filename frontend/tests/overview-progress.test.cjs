const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,hooks,nodes,text:rawText,runtime,defaults}=require('./helpers/account-harness.cjs');
const text=node=>rawText(node).replace(/\s+/g,' ').trim();
const model=load('src/utils/projectOverview.ts',{});
const budget=load('src/utils/budget.ts',{'@/utils/currency':{peso:n=>`PHP ${n}`}});
const status=load('src/utils/projectStatus.ts',{});
const timelineUtils=load('src/utils/timeline.ts',{});
const colors=load('src/theme/colors.ts',{});
const savedProject=(id=7)=>({id,title:`Saved project ${id}`,status:'active',location:'Recorded location',startedAt:'2026-11-01',budget:100000,totalEstimate:85000,timelineValue:5,timelineUnit:'months',overallProgressPct:35,
  approvedPlan:{projectType:'Recorded renovation',description:'Actual approved description',areaSqm:82,initialPrompt:'Private prompt must never become the description'},
  workers:[{id:11,name:'Recorded worker'}],contractors:[{id:21,name:'Recorded contractor'}],phases:[{id:31,name:'Recorded phase',progressPct:35,tasks:[]}]});
const task=(id,start,end,extra={})=>({id,phaseId:31,phaseName:'Recorded phase',description:`Activity ${id}`,plannedStart:start,plannedEnd:end,isDone:false,completedAt:null,status:'upcoming',...extra});
const month=(key,activities)=>({key,label:key==='2026-11'?'November 2026':'December 2026',year:2026,month:Number(key.slice(5)),isCurrent:key==='2026-11',plannedPct:60,actualPct:null,phases:[{id:31,name:'Recorded phase'}],tasks:[],activities});
const savedTimeline=(id=7)=>({projectId:id,today:'2026-11-17',startDate:'2026-11-01',endDate:'2027-03-31',overall:{actualPct:35},phases:[{id:31,name:'Recorded phase',progressPct:35,startDate:'2026-11-01',endDate:'2026-11-30'}],months:[month('2026-11',[
  task(93,'2026-11-29','2026-12-05'),task(91,'2026-10-25','2026-11-20',{status:'in_progress'}),task(92,'2026-11-18','2026-11-21'),task(91,'2026-10-25','2026-11-20',{status:'in_progress'}),task(94,'2026-12-01','2026-12-05'),
]),month('2026-12',[task(93,'2026-11-29','2026-12-05'),task(94,'2026-12-01','2026-12-05')])]});

test('Overview information uses saved approved metadata and never invents descriptions, types, floor area or current phase',()=>{
  const project=savedProject();assert.equal(model.projectInformation(project).description,'Actual approved description');
  assert.equal(model.projectInformation(project).type,'Recorded renovation');assert.equal(model.projectInformation(project).area,'82 sqm');
  const unknown={...project,location:null,approvedPlan:{initialPrompt:'Private narrative',projectTitle:'House sample'},phases:[{id:31,name:'Not begun',progressPct:0}]};
  const info=model.projectInformation(unknown);assert.equal(info.description,'Not recorded');assert.equal(info.type,'Not recorded');assert.equal(info.area,'Not recorded');
  assert.equal(model.currentProjectPhase(unknown).phase,null);assert.equal(model.currentProjectPhase(unknown,savedTimeline(8)).phase,null);
  assert.equal(model.currentProjectPhase(unknown,savedTimeline()).note,'Scheduled now');
  assert.equal(model.currentProjectPhase(project).phase.id,31);
  assert.equal(model.savedDate('invalid'),'Not recorded');assert.equal(model.savedDate('2026-02-30'),'Not recorded');
  assert.match(model.savedDate('2026-11-01T00:00:00Z'),/2026/);
});

test('Overview renders the four compact summaries and passes a single schedule snapshot to its capped preview in both themes',async()=>{
  for(const mode of ['light','dark']){
    const h=hooks(),loaders=[];let response=savedTimeline(),error=null;const opens=[];
    const Summary=load('src/components/ProjectOverviewSummary.tsx',{
      react:h.react,'react/jsx-runtime':runtime,'react-native':{Text:'Text',View:'View',Pressable:'Button'},'@/components/ui':{Badge:'Badge',ProgressBar:'Bar'},
      '@/context/ThemeContext':{useTheme:()=>({mode,chrome:mode==='light'?colors.lightChrome:colors.darkChrome})},
      '@/hooks/useFocusedResource':{useFocusedResource:fn=>{loaders.push(fn);return{data:response,loading:false,error,refresh:async()=>{}};}},
      '@/services/api/timeline':{fetchProjectTimeline:async()=>response},'@/utils/projectOverview':model,'@/utils/projectStatus':status,
      '@/utils/budget':budget,'@/utils/currency':{peso:n=>`PHP ${n}`},'@/utils/timeline':timelineUtils,'./UpcomingActivities':defaults('Upcoming'),
    }).default;
    let project=savedProject();const render=()=>h.render(()=>Summary({project,onOpen:()=>opens.push(project.id)}));let tree=await render();
    assert.match(text(tree),/Actual approved description/);assert.doesNotMatch(text(tree),/Private prompt/);
    for(const label of ['Project Budget','Timeline','Project Team','Current Phase'])assert.ok(nodes(tree,'Text').some(n=>text(n)===label));
    assert.match(text(tree),/Approved budget: PHP 100000/);assert.match(text(tree),/Remaining \(estimated\): PHP 15000/);
    assert.match(text(tree),/assigned contractor/);assert.match(text(tree),/assigned skilled worker/);assert.match(text(tree),/2027/);
    assert.equal(nodes(tree,'Bar')[0].props.pct,35);assert.equal(nodes(tree,'Upcoming')[0].props.resource.data.projectId,7);
    assert.equal(loaders.length,1);nodes(tree,'Upcoming')[0].props.onOpen();assert.deepEqual(opens,[7]);
    const surfaces=nodes(tree,'View').filter(n=>Array.isArray(n.props.style));assert.ok(surfaces.some(n=>n.props.style[0].backgroundColor===(mode==='light'?colors.lightChrome.card:colors.darkChrome.card)));
    project=savedProject(8);tree=await render();assert.equal(nodes(tree,'Upcoming')[0].props.resource.data,null,'an old project response is never shared');
    response=null;error='Offline';tree=await render();assert.match(text(tree),/Actual approved description/);assert.equal(nodes(tree,'Upcoming')[0].props.resource.error,'Offline');
  }
});

test('Monthly View is the default, shows every chronological overlapping activity, and Daily View uses the same calendar date',async()=>{
  for(const mode of ['light','dark']){
    const h=hooks();let timeline=savedTimeline();
    const Content=load('src/screens/timeline/ProjectCalendar.tsx',{
      react:h.react,'react/jsx-runtime':runtime,'react-native':{Text:'Text',View:'View',Pressable:'Button',ScrollView:'Scroll',ActivityIndicator:'Spinner'},
      '@expo/vector-icons':{Ionicons:'Icon'},'@/components/ui':Object.fromEntries(['Badge','Card','InfoBox','ProgressBar','StatGrid','StatTile'].map(k=>[k,k])),
      '@/components/charts':{GrowBar:'GrowBar'},'@/context/ThemeContext':{useTheme:()=>({mode,chrome:mode==='light'?colors.lightChrome:colors.darkChrome})},'@/services/api/timeline':{},'@/hooks/useFocusedResource':{},'@/utils/timeline':timelineUtils,'@/utils/projectOverview':model,
    }).ProjectCalendarContent;
    const render=()=>h.render(()=>Content({timeline,section:'calendar',selectToday:true,actualProgressPct:35}));
    let root=await render(),calendar=nodes(root,'MonthCalendar')[0],tree=calendar.type(calendar.props);
    assert.equal(calendar.props.view,'monthly');assert.deepEqual(nodes(tree,'TaskRow').map(n=>n.props.task.id),[91,92,93]);
    assert.ok(nodes(tree,'Button').find(n=>n.props.accessibilityLabel==='Monthly View').props.accessibilityState.selected);
    assert.doesNotMatch(text(tree),/even distribution|Task-specific assignments|developer|derived/);
    assert.match(text(tree),/Planned by month end/);assert.match(text(tree),/Actual so far/);
    assert.ok(nodes(tree,'Text').some(n=>/^35\s*%$/.test(text(n))));
    nodes(tree,'Button').find(n=>n.props.accessibilityLabel?.startsWith('2026-11-19,')).props.onPress();
    root=await render();calendar=nodes(root,'MonthCalendar')[0];tree=calendar.type(calendar.props);assert.equal(calendar.props.view,'daily');assert.deepEqual(nodes(tree,'TaskRow').map(n=>n.props.task.id),[91,92]);
    nodes(tree,'Button').find(n=>n.props.accessibilityLabel==='Monthly View').props.onPress();root=await render();calendar=nodes(root,'MonthCalendar')[0];tree=calendar.type(calendar.props);assert.deepEqual(nodes(tree,'TaskRow').map(n=>n.props.task.id),[91,92,93]);
    calendar.props.onNext();root=await render();calendar=nodes(root,'MonthCalendar')[0];tree=calendar.type(calendar.props);assert.equal(calendar.props.view,'monthly');assert.deepEqual(nodes(tree,'TaskRow').map(n=>n.props.task.id),[93,94]);
    const december=timeline.months[1];assert.equal(december.actualPct,null,'future month has no historical progress');assert.ok(nodes(tree,'Text').some(n=>/^35\s*%$/.test(text(n))),'actual so far remains the saved current project percentage');
    nodes(tree,'Button').find(n=>n.props.accessibilityLabel==='Daily View').props.onPress();root=await render();calendar=nodes(root,'MonthCalendar')[0];tree=calendar.type(calendar.props);assert.equal(calendar.props.selectedDay,'2026-12-01');
    nodes(tree,'Button').find(n=>n.props.accessibilityLabel?.startsWith('2026-12-15,')).props.onPress();root=await render();calendar=nodes(root,'MonthCalendar')[0];tree=calendar.type(calendar.props);assert.match(text(tree),/No construction activities scheduled for this date/);
  }
});

test('Next Scheduled Activities caps actual upcoming records at three and shares the Summary resource without a second fetch',()=>{
  const flags=[];let saved=savedTimeline();saved.months[0].activities=[1,2,3,4,5].map(id=>task(id,`2026-11-${17+id}`,'2026-11-30'));
  const Preview=load('src/components/UpcomingActivities.tsx',{
    react:{useCallback:fn=>fn},'react/jsx-runtime':runtime,'react-native':{Text:'Text',Pressable:'Button',ActivityIndicator:'Spinner'},'@/components/ui':{Card:'Card'},
    '@/hooks/useFocusedResource':{useFocusedResource:(_,enabled)=>{flags.push(enabled);return{data:null,loading:true,error:null,refresh:async()=>{}};}},
    '@/services/api/timeline':{fetchProjectTimeline:()=>{throw Error('Unexpected duplicate fetch');}},'@/utils/timeline':timelineUtils,
  }).default;
  const tree=Preview({projectId:7,onOpen(){},resource:{data:saved,loading:false,error:null,refresh:async()=>{}}});
  assert.deepEqual(flags,[false]);assert.equal(tree.props.title,'Next Scheduled Activities');
  for(const id of [1,2,3])assert.match(text(tree),new RegExp(`Activity ${id}`));
  assert.doesNotMatch(text(tree),/Activity 4|Activity 5/);assert.match(text(tree),/View Full Schedule/);
});
