const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,hooks,nodes,text:rawText,runtime,deferred,tick}=require('./helpers/account-harness.cjs');
const text=node=>rawText(node).replace(/\s+/g,' ').trim();
const model=load('src/utils/checklist.ts',{});
const timelineUtils=load('src/utils/timeline.ts',{});
const colors=load('src/theme/colors.ts',{});
const project=(extra={})=>({id:7,title:'Recorded project',status:'active',canManageChecklist:true,checklistLocked:false,canSubmitCompletion:false,overallProgressPct:60,
  checklist:{doneTasks:2,totalTasks:6,pct:33},phases:[
    {id:8,name:'Recorded preparation',progressPct:20,tasks:[{id:10,description:'Saved completed work',isDone:true},{id:11,description:'Saved current work',isDone:false},{id:12,description:'Saved future work',isDone:false},{id:13,description:'Saved delayed work',isDone:false},{id:14,description:'Saved undated work',isDone:false}]},
    {id:9,name:'Recorded inspection',progressPct:100,tasks:[{id:15,description:'Saved completed inspection',isDone:true}]},
  ],...extra});
const task=(id,start,end)=>({id,phaseId:8,phaseName:'Recorded preparation',plannedStart:start,plannedEnd:end,status:'upcoming',isDone:false});
const schedule=(id=7)=>({projectId:id,today:'2026-11-17',months:[{tasks:[],activities:[task(10,'2026-11-19','2026-11-20'),task(11,'2026-11-01','2026-11-30'),task(12,'2026-11-20','2026-11-30'),task(13,'2026-10-01','2026-10-10')]},
  {tasks:[],activities:[task(11,'2026-11-01','2026-11-30'),task(999,'2026-11-01','2026-11-30')]}]});

function harness(options={}){
  const root=hooks(),children=new Map(),calls=[],confirmations=[],animations=[];let current=root,saved=options.project??project(),savedSchedule=options.timeline??schedule(),refreshed=0;
  const react=Object.fromEntries(Object.keys(root.react).map(key=>[key,(...args)=>current.react[key](...args)]));
  const api=Object.fromEntries(['addPhaseTask','checkAllTasks','deletePhaseTask','submitProjectCompletion','togglePhaseTask','uncheckAllTasks'].map(name=>[name,async(...args)=>{calls.push([name,...args]);if(options.failure)throw Error('Permission denied');if(options.gate)await options.gate.promise;}]));
  const Card=load('src/components/ProjectChecklistCard.tsx',{
    react,'react/jsx-runtime':runtime,'react-native':{Text:'Text',View:'View',Pressable:'Button',ScrollView:'Scroll',LayoutAnimation:{Presets:{easeInEaseOut:'ease'},configureNext:config=>animations.push(config)}},
    '@expo/vector-icons':{Ionicons:'Icon'},'@/components/ui':{Button:'Action',Field:'Field',ProgressBar:'ProgressBar'},
    '@/components/ConfirmDialog':{useConfirmDialog:()=>({ask:options=>confirmations.push(options),dialog:null})},
    '@/services/api/projects':api,'@/utils/checklist':model,'@/utils/timeline':timelineUtils,
    '@/context/ThemeContext':{useTheme:()=>({mode:options.mode??'light',chrome:options.mode==='dark'?colors.darkChrome:colors.lightChrome})},
  }).default;
  const render=()=>{current=root;return root.render(()=>Card({project:saved,drawer:true,readOnly:options.readOnly??false,timeline:savedSchedule,onChanged:async()=>{refreshed++;}}));};
  const phase=async(id)=>{const tree=await render(),node=nodes(tree,'PhaseChecklist').find(n=>n.props.phase.id===id);assert.ok(node);const state=children.get(id)??hooks();children.set(id,state);current=state;try{return await state.render(()=>node.type(node.props));}finally{current=root;}};
  const expand=async()=>{const tree=await render();nodes(tree,'Button').find(n=>n.props.accessibilityLabel==='Project Checklist').props.onPress();return render();};
  return{render,phase,expand,calls,confirmations,animations,setProject:value=>{saved=value;},setTimeline:value=>{savedSchedule=value;},refreshes:()=>refreshed};
}

test('status counts use each checklist record once and recorded completion overrides stale schedule flags',()=>{
  const saved=project(),result=model.checklistStates(saved,schedule());
  assert.equal(result.counts.All,6);assert.equal(result.counts.Done,2);assert.equal(result.counts['In Progress'],1);assert.equal(result.counts['To Do'],3);
  assert.equal(result.states.get(10).label,'Completed');assert.equal(result.states.get(11).label,'In progress');
  assert.equal(result.states.get(12).label,'Scheduled / pending');assert.equal(result.states.get(13).label,'Delayed');assert.equal(result.states.get(14).label,'Not started');
  assert.equal(result.states.has(999),false);
  const foreign=model.checklistStates(saved,schedule(8));assert.equal(foreign.counts.Done,2);assert.equal(foreign.counts['In Progress'],0);assert.equal(foreign.states.get(11).label,'Not started');
  assert.equal(saved.phases[0].tasks[1].isDone,false,'dates and filtering never save completion');
});

test('outer drawer and phase sections start collapsed, expand independently and retain accurate counts in both themes',async()=>{
  for(const mode of ['light','dark']){
    const app=harness({mode});let tree=await app.render();assert.equal(tree.props.style.backgroundColor,mode==='dark'?colors.darkChrome.card:colors.lightChrome.card);
    const header=nodes(tree,'Button').find(n=>n.props.accessibilityLabel==='Project Checklist');assert.equal(header.props.accessibilityState.expanded,false);
    assert.match(text(tree),/2 of 6 tasks completed/);assert.equal(nodes(tree,'PhaseChecklist').length,0);
    tree=await app.expand();assert.equal(nodes(tree,'PhaseChecklist').length,2);
    assert.equal(nodes(tree,'ProgressBar')[0].props.pct,33,'existing backend checklist percentage is retained');
    let a=await app.phase(8),b=await app.phase(9);assert.equal(nodes(a,'Button').filter(n=>n.props.accessibilityRole==='checkbox').length,0);assert.equal(nodes(b,'Button')[0].props.accessibilityState.expanded,false);
    nodes(a,'Button')[0].props.onPress();a=await app.phase(8);b=await app.phase(9);
    assert.equal(nodes(a,'Button').filter(n=>n.props.accessibilityRole==='checkbox').length,5);assert.equal(nodes(b,'Button')[0].props.accessibilityState.expanded,false);
    assert.match(text(a),/Recorded preparation \(\s*1\s*\/\s*5\s*\)/);assert.match(text(a),/20\s*% phase completion/);
    assert.equal(app.calls.length,0);assert.ok(app.animations.length>=2);
    tree=await app.render();nodes(tree,'Button').find(n=>n.props.accessibilityLabel==='Project Checklist').props.onPress();assert.equal(nodes(await app.render(),'PhaseChecklist').length,0);
  }
});

test('All, To Do, In Progress and Done filters preserve phase expansion and make no mutation calls',async()=>{
  const app=harness();await app.expand();let a=await app.phase(8);nodes(a,'Button')[0].props.onPress();
  for(const [label,count,visible]of [['In Progress',1,1],['Done',2,1],['To Do',3,3],['All',6,5]]){
    const tree=await app.render();nodes(tree,'Button').find(n=>n.props.accessibilityLabel===`${label}: ${count} tasks`).props.onPress();
    a=await app.phase(8);assert.equal(nodes(a,'Button')[0].props.accessibilityState.expanded,true);
    assert.equal(nodes(a,'Button').filter(n=>n.props.accessibilityRole==='checkbox').length,visible);
    assert.match(text(a),/\(\s*1\s*\/\s*5\s*\)/,'phase counters describe all actual phase tasks');
  }
  let tree=await app.render();nodes(tree,'Button').find(n=>n.props.accessibilityLabel==='To Do: 3 tasks').props.onPress();
  let b=await app.phase(9);nodes(b,'Button')[0].props.onPress();b=await app.phase(9);assert.match(text(b),/No tasks in this filter/);
  assert.equal(app.calls.length,0);
});

test('permitted status changes retain original API identities, prevent duplicate taps and refresh saved data',async()=>{
  const gate=deferred(),app=harness({gate});await app.expand();let phase=await app.phase(8);nodes(phase,'Button')[0].props.onPress();phase=await app.phase(8);
  const current=nodes(phase,'Button').filter(n=>n.props.accessibilityRole==='checkbox')[1];
  current.props.onPress();current.props.onPress();await tick();assert.deepEqual(app.calls,[['togglePhaseTask',7,8,11,true]]);
  gate.resolve();await tick();assert.equal(app.refreshes(),1);
  const next=project();next.phases[0].tasks[1].isDone=true;next.phases[0].progressPct=40;next.checklist={doneTasks:3,totalTasks:6,pct:50};app.setProject(next);
  assert.match(text(await app.render()),/3 of 6 tasks completed/);
  const failure=harness({failure:true});await failure.expand();phase=await failure.phase(8);nodes(phase,'Button')[0].props.onPress();phase=await failure.phase(8);nodes(phase,'Button').find(n=>n.props.accessibilityRole==='checkbox').props.onPress();await tick();
  assert.match(text(await failure.phase(8)),/Permission denied/);assert.equal(failure.refreshes(),0);
});

test('read-only, submitted and completed records never gain editing permissions; empty checklists remain honest',async()=>{
  for(const extra of [{canManageChecklist:false},{status:'pending_confirmation',checklistLocked:true},{status:'completed',checklistLocked:true}]){
    const app=harness({project:project(extra),readOnly:true});await app.expand();let phase=await app.phase(8);nodes(phase,'Button')[0].props.onPress();phase=await app.phase(8);
    assert.equal(nodes(phase,'Field').length,0);assert.equal(nodes(phase,'Action').length,0);assert.equal(nodes(await app.render(),'Action').length,0);
    for(const checkbox of nodes(phase,'Button').filter(n=>n.props.accessibilityRole==='checkbox')){assert.equal(checkbox.props.disabled,true);checkbox.props.onPress();}
    assert.equal(app.calls.length,0);
  }
  const empty=harness({project:project({phases:[],checklist:{doneTasks:0,totalTasks:0,pct:0}})});await empty.expand();assert.match(text(await empty.render()),/No construction phases or checklist records/);
});

const button=(tree,label)=>{const found=nodes(tree,'Button').find(node=>node.props.accessibilityLabel===label);assert.ok(found,`Missing ${label}`);return found;};
const expandPhase=async app=>{await app.expand();button(await app.phase(8),'Recorded preparation checklist').props.onPress();return app.phase(8);};

test('filters scroll without compressing labels and summaries retain saved percentages in both themes',async()=>{
  for(const mode of ['light','dark']){
    const app=harness({mode});const tree=await app.expand(),scroll=nodes(tree,'Scroll')[0];assert.ok(scroll);assert.equal(scroll.props.horizontal,true);
    for(const filter of model.CHECKLIST_FILTERS){const item=nodes(scroll,'Button').find(node=>node.props.accessibilityLabel.startsWith(`${filter}:`));assert.ok(item);assert.equal(item.props.style.flexShrink,0);}
    assert.equal(button(tree,'All: 6 tasks').props.accessibilityState.selected,true);
    button(tree,'In Progress: 1 tasks').props.onPress();assert.equal(button(await app.render(),'In Progress: 1 tasks').props.accessibilityState.selected,true);
    assert.match(text(tree),/2 of 6 tasks completed/);assert.equal(nodes(tree,'ProgressBar')[0].props.pct,33);
    const phase=await app.phase(8);assert.equal(phase.props.style.backgroundColor,(mode==='light'?colors.lightChrome:colors.darkChrome).card);
  }
  const unknown=harness({project:project({checklist:null})});const tree=await unknown.expand();assert.match(text(tree),/Not recorded/);assert.equal(nodes(tree,'ProgressBar').length,0);
});

test('task action menus keep deletion separate from checkboxes and require confirmation before the original delete API',async()=>{
  const gate=deferred(),app=harness({gate});let phase=await expandPhase(app);
  assert.equal(nodes(phase,'Button').some(node=>node.props.accessibilityLabel==='Delete Saved current work'),false);
  button(phase,'Actions for task Saved current work').props.onPress();phase=await app.phase(8);assert.equal(app.calls.length,0);
  button(phase,'Delete Saved current work').props.onPress();assert.equal(app.calls.length,0);assert.equal(app.confirmations.length,1);
  assert.equal(app.confirmations[0].title,'Delete task?');assert.equal(app.confirmations[0].detail,'Saved current work');
  // Dismissing the first confirmation never invokes its callback or mutates data.
  phase=await app.phase(8);assert.equal(nodes(phase,'Button').some(node=>node.props.accessibilityLabel==='Delete Saved current work'),false);
  button(phase,'Actions for task Saved current work').props.onPress();phase=await app.phase(8);button(phase,'Delete Saved current work').props.onPress();
  const confirm=app.confirmations.at(-1);confirm.onConfirm();confirm.onConfirm();await tick();assert.deepEqual(app.calls,[['deletePhaseTask',7,8,11]]);
  gate.resolve();await tick();assert.equal(app.refreshes(),1);
});

test('Add Task opens the existing validated form, Cancel discards edits, and Save uses the correct phase once',async()=>{
  const gate=deferred(),app=harness({gate});let phase=await expandPhase(app);assert.equal(nodes(phase,'Field').length,0);
  button(phase,'Add task to Recorded preparation').props.onPress();phase=await app.phase(8);let field=nodes(phase,'Field')[0];assert.equal(field.props.maxLength,255);
  assert.equal(nodes(phase,'Action').find(node=>node.props.label==='Save Task').props.disabled,true);
  field.props.onChangeText('Unsaved task');phase=await app.phase(8);nodes(phase,'Action').find(node=>node.props.label==='Cancel').props.onPress();phase=await app.phase(8);
  assert.equal(nodes(phase,'Field').length,0);assert.equal(app.calls.length,0);
  button(phase,'Add task to Recorded preparation').props.onPress();phase=await app.phase(8);field=nodes(phase,'Field')[0];assert.equal(field.props.value,'');field.props.onChangeText('  New saved task  ');
  phase=await app.phase(8);const save=nodes(phase,'Action').find(node=>node.props.label==='Save Task');save.props.onPress();save.props.onPress();await tick();assert.deepEqual(app.calls,[['addPhaseTask',7,8,'New saved task']]);
  gate.resolve();await tick();assert.equal(app.refreshes(),1);assert.equal(nodes(await app.phase(8),'Field').length,0);
  const failed=harness({failure:true});phase=await expandPhase(failed);button(phase,'Add task to Recorded preparation').props.onPress();phase=await failed.phase(8);
  nodes(phase,'Field')[0].props.onChangeText('Retained after failure');phase=await failed.phase(8);nodes(phase,'Action').find(node=>node.props.label==='Save Task').props.onPress();await tick();
  phase=await failed.phase(8);assert.match(text(phase),/Permission denied/);assert.equal(nodes(phase,'Field')[0].props.value,'Retained after failure');assert.equal(failed.refreshes(),0);
});

test('compact phase menus preserve confirmed bulk actions for the whole phase even with a task filter',async()=>{
  const app=harness();let phase=await expandPhase(app);assert.equal(nodes(phase,'Action').some(node=>/Check All|Uncheck All/.test(node.props.label)),false);
  button(await app.render(),'In Progress: 1 tasks').props.onPress();phase=await app.phase(8);assert.equal(nodes(phase,'Button').filter(node=>node.props.accessibilityRole==='checkbox').length,1);
  button(phase,'Actions for phase Recorded preparation').props.onPress();phase=await app.phase(8);button(phase,'Check all tasks in Recorded preparation').props.onPress();
  assert.equal(app.calls.length,0);assert.equal(app.confirmations.at(-1).title,'Check all tasks?');app.confirmations.at(-1).onConfirm();await tick();
  assert.deepEqual(app.calls,[['checkAllTasks',7,8]]);assert.equal(app.refreshes(),1);
  phase=await app.phase(8);button(phase,'Actions for phase Recorded preparation').props.onPress();phase=await app.phase(8);button(phase,'Uncheck all tasks in Recorded preparation').props.onPress();
  assert.equal(app.calls.length,1);assert.equal(app.confirmations.at(-1).title,'Uncheck all tasks?');app.confirmations.at(-1).onConfirm();await tick();
  assert.deepEqual(app.calls.at(-1),['uncheckAllTasks',7,8]);assert.equal(app.refreshes(),2);
});

test('Overview upcoming summary is small, deduplicates spanning activities and uses the existing saved schedule API',()=>{
  const calls=[],routes=[];let saved={projectId:7,today:'2026-11-17',months:[{activities:[
    {...task(11,'2026-11-01','2026-11-30'),description:'Current saved activity'},
    {...task(12,'2026-11-20','2026-11-30'),description:'Future saved activity'},
    {...task(10,'2026-11-01','2026-11-30'),description:'Completed activity',isDone:true},
    {...task(13,'2026-10-01','2026-10-10'),description:'Past activity'},
  ]},{activities:[{...task(11,'2026-11-01','2026-11-30'),description:'Current saved activity'}]}]};
  let state={error:null,loading:false};
  const Summary=load('src/components/UpcomingActivities.tsx',{
    react:{useCallback:fn=>fn},'react/jsx-runtime':runtime,'react-native':{Text:'Text',Pressable:'Button',ActivityIndicator:'Spinner'},'@/components/ui':{Card:'Card'},
    '@/hooks/useFocusedResource':{useFocusedResource:fn=>{calls.push(fn);return{...state,data:saved,refresh:async()=>{}};}},
    '@/services/api/timeline':{fetchProjectTimeline:async(...args)=>{calls.push(args);}},'@/utils/timeline':timelineUtils,
  }).default;
  let tree=Summary({projectId:7,onOpen:()=>routes.push('/homeowner/progress')});
  assert.match(text(tree),/Current saved activity/);assert.match(text(tree),/Future saved activity/);assert.doesNotMatch(text(tree),/Completed activity|Past activity/);
  assert.equal(nodes(tree,'Text').filter(n=>text(n).includes('Current saved activity')).length,1);
  assert.equal(nodes(tree,'MonthCalendar').length,0);
  nodes(tree,'Button').find(n=>text(n)==='View Full Schedule').props.onPress();assert.deepEqual(routes,['/homeowner/progress']);
  calls[0]();assert.deepEqual(calls.at(-1),[7,true]);
  saved={...saved,projectId:8};tree=Summary({projectId:7,onOpen(){}});assert.doesNotMatch(text(tree),/Current saved activity/);
  state={error:'Offline',loading:false};tree=Summary({projectId:7,onOpen(){}});assert.match(text(tree),/could not be refreshed/);assert.ok(nodes(tree,'Button').some(n=>text(n)==='Retry schedule summary'));
});
