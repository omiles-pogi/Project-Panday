const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, hooks, nodes, text, runtime, theme } = require('./helpers/account-harness.cjs');
const model = load('src/utils/workersFilters.ts', {});
const worker = { id: 11, name: 'Recorded Mason', trade: 'Mason', skills: ['Masonry','Concrete'], minDailyWage: 750, averageRating: null, ratingCount: 0, matchedSkillCount: 0 };
const contractor = { id: 21, name: 'Recorded Contractor', companyName: 'Construction Team', specialization: 'Residential', skills: ['Project Management'], averageRating: null, ratingCount: 0 };

test('directory options come only from returned records and selected skills use case-insensitive exact matches', () => {
  const options=model.workerFilterOptions([worker,{...worker,trade:'mason',skills:['Masonry','Tiling']}]);
  assert.equal(options.specialties.length,1);assert.deepEqual(Array.from(options.skills),['Concrete','Masonry','Tiling']);
  const filters={...model.emptyWorkerFilters(),specialty:'Mason',skills:['masonry','concrete']};
  assert.equal(model.matchesWorkerFilters(worker,'recorded',filters),true);
  assert.equal(model.matchesWorkerFilters(worker,'', {...filters,skills:['Mason']}),false);
  assert.equal(model.matchesWorkerFilters(contractor,'',filters),false);
  assert.equal(model.matchesWorkerFilters(contractor,'construction',null),true);
});

test('positive daily-rate bounds never fabricate missing rates or compare contractor project quotes',()=>{
  for(const changes of [{minRate:'-1'},{minRate:'0'},{maxRate:'NaN'},{minRate:'10.001'},{maxRate:'1e3'},{minRate:'900',maxRate:'700'}])assert.ok(model.validateWorkerFilters({...model.emptyWorkerFilters(),...changes}));
  for(const changes of [{},{minRate:'.50'},{maxRate:'750.50'},{minRate:'700',maxRate:'800'}])assert.equal(model.validateWorkerFilters({...model.emptyWorkerFilters(),...changes}),null);
  const range={...model.emptyWorkerFilters(),minRate:'700',maxRate:'800'};
  assert.equal(model.matchesWorkerFilters(worker,'',range),true);
  assert.equal(model.matchesWorkerFilters({...worker,minDailyWage:null},'',range),false);
  assert.equal(model.matchesWorkerFilters({...worker,minDailyWage:null},'',null),true);
  assert.equal(model.matchesWorkerFilters({...worker,minDailyWage:900},'',range),false);
  const normalized=model.normalizeWorkerFilters({...range,type:'contractor'});assert.equal(normalized.minRate,'');assert.equal(normalized.maxRate,'');
});

test('filter API arguments never send incompatible trade/specialization, budget or availability fields',()=>{
  const filters={...model.emptyWorkerFilters(),specialty:'Mason',skills:['Masonry'],minRate:'700'};
  assert.deepEqual({...model.workerFilterQuery('worker',filters),skills:[...model.workerFilterQuery('worker',filters).skills]},{trade:'Mason',skills:['Masonry']});
  const other=model.workerFilterQuery('contractor',filters);assert.equal(other.specialization,undefined);assert.equal(other.skills.length,0);
  assert.equal('minRate'in model.workerFilterQuery('worker',filters),false);assert.equal('availability'in filters,false);
  assert.equal(model.workerFilterCount(null),0);assert.equal(model.workerFilterCount(filters),4);
});

async function drawer(options={}) {
  const rootHooks=hooks(),panelHooks=hooks();let current=rootHooks;
  const react=Object.fromEntries(['useState','useRef','useCallback','useEffect'].map(name=>[name,(...args)=>current.react[name](...args)]));
  const animations=[],applied=[];let closed=0,cleared=0;
  class Value { constructor(value){this.value=value;}interpolate(config){return config;}stopAnimation(){} }
  const View=load('src/components/homeowner/WorkersFilterDrawer.tsx',{
    react,'react/jsx-runtime':runtime,'react-native':{Modal:'Modal',Pressable:'Button',Text:'Text',TextInput:'Input',View:'View',Keyboard:{dismiss(){}},Platform:{OS:'android'},useWindowDimensions:()=>({width:options.width??320}),
      Animated:{Value,View:'AnimatedView',timing:(value,config)=>({start(callback){animations.push(config);value.value=config.toValue;callback?.({finished:true});}})},Easing:{cubic:'cubic',in:value=>value,out:value=>value}},
    'react-native-safe-area-context':{SafeAreaProvider:'SafeArea',useSafeAreaInsets:()=>({top:24,bottom:20,left:0,right:0})},
    '@expo/vector-icons':{Ionicons:'Icon'},'@/context/ThemeContext':{useTheme:()=>options.theme??theme},
    '@/components/KeyboardView':{__esModule:true,default:'KeyboardView'},'@/components/KeyboardAwareScrollView':{__esModule:true,default:'Scroll'},
    '@/utils/workersFilters':model,
  }).default;
  let root,panel;
  const render=async()=>{
    current=rootHooks;root=await rootHooks.render(()=>View({initial:options.initial??null,workers:[worker],contractors:[contractor],loading:!!options.loading,workerError:null,contractorError:null,onRetry(){},onApply:value=>applied.push(value),onClear:()=>cleared++,onClose:()=>closed++}));
    const node=nodes(root,'DrawerPanel')[0];current=panelHooks;panel=await panelHooks.render(()=>node.type(node.props));return panel;
  };
  await render();
  return{render,root:()=>root,panel:()=>panel,animations,applied,closed:()=>closed,cleared:()=>cleared};
}
const button=(tree,label)=>nodes(tree,'Button').find(n=>n.props.accessibilityLabel===label||text(n).trim()===label);

test('drawer slides from the right and X, backdrop and Android Back close without applying or navigation',async()=>{
  for(const action of ['X','backdrop','back']){
    const app=await drawer();const modal=nodes(app.root(),'Modal')[0];modal.props.onShow();assert.equal(app.animations[0].toValue,0);
    assert.equal(app.animations[0].useNativeDriver,true);
    if(action==='X')button(app.panel(),'Close filters').props.onPress();
    if(action==='backdrop')button(app.root(),'Close worker filters backdrop').props.onPress();
    if(action==='back')modal.props.onRequestClose();
    assert.equal(app.closed(),1);assert.equal(app.applied.length,0);assert.equal(app.animations.at(-1).toValue,1);
    modal.props.onRequestClose();assert.equal(app.closed(),1);
  }
});

test('draft edits do not apply until submission; type switching drops incompatible selections',async()=>{
  const initial={...model.emptyWorkerFilters(),specialty:'Mason',skills:['Masonry']};const app=await drawer({initial});let tree=app.panel();
  assert.equal(button(tree,'Skill: Masonry').props.accessibilityState.checked,true);
  button(tree,'Skill: Concrete').props.onPress();tree=await app.render();assert.equal(app.applied.length,0);assert.deepEqual(initial.skills,['Masonry']);
  const picker=nodes(tree,'SpecialtyPicker')[0];assert.deepEqual(Array.from(picker.props.options),['Mason']);
  button(tree,'Contractor').props.onPress();tree=await app.render();assert.equal(nodes(tree,'SpecialtyPicker')[0].props.label,'Contractor Specialization');
  assert.equal(nodes(tree,'Input').length,0);assert.match(text(tree),/project-specific/);
  button(tree,'Service: Project Management').props.onPress();tree=await app.render();
  button(tree,'Apply worker filters').props.onPress();button(tree,'Apply worker filters').props.onPress();
  assert.equal(app.applied.length,1);assert.equal(app.applied[0].type,'contractor');assert.deepEqual(Array.from(app.applied[0].skills),['Project Management']);assert.equal(app.applied[0].specialty,'');assert.equal(app.closed(),1);
});

test('invalid rates stay in the open drawer, safe multi-selection commits once and unsupported availability stays disabled',async()=>{
  const app=await drawer();let tree=app.panel();
  const field=(label)=>nodes(tree,'Input').find(n=>n.props.accessibilityLabel===label);
  field('Minimum Rate').props.onChangeText('900');field('Maximum Rate').props.onChangeText('700');tree=await app.render();button(tree,'Apply worker filters').props.onPress();tree=await app.render();
  assert.match(text(tree),/must not exceed/);assert.equal(app.closed(),0);assert.equal(app.applied.length,0);
  field('Minimum Rate').props.onChangeText('600');tree=await app.render();button(tree,'Skill: Masonry').props.onPress();tree=await app.render();button(tree,'Skill: Concrete').props.onPress();tree=await app.render();
  assert.equal(button(tree,'Available Now').props.disabled,true);
  const scroll=nodes(tree,'Scroll')[0];assert.equal(scroll.props.style.flex,1);assert.equal(scroll.props.keyboardShouldPersistTaps,'handled');
  button(tree,'Apply worker filters').props.onPress();assert.equal(app.applied.length,1);assert.equal(app.applied[0].minRate,'600');assert.equal(app.applied[0].skills.length,2);
});

test('footer clear commits a reset once; loading blocks submissions while close remains available',async()=>{
  const clearing=await drawer();button(clearing.panel(),'Clear worker filters').props.onPress();button(clearing.panel(),'Clear worker filters').props.onPress();assert.equal(clearing.cleared(),1);assert.equal(clearing.closed(),1);
  const loading=await drawer({loading:true});button(loading.panel(),'Apply worker filters').props.onPress();button(loading.panel(),'Clear worker filters').props.onPress();assert.equal(loading.applied.length,0);assert.equal(loading.cleared(),0);button(loading.panel(),'Close filters').props.onPress();assert.equal(loading.closed(),1);
});
