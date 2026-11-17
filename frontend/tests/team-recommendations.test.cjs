const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,runtime,nodes,text,defaults}=require('./helpers/account-harness.cjs');
const colors=load('src/theme/colors.ts',{});
const match={matchedSkills:['Painting','Surface preparation'],matchedPhases:['Room painting'],reason:'Recorded Painting and Surface preparation match Room painting.',estimatedDays:13,estimatedWage:6500,durationBasis:'Provisional matching-phase duration.',budgetFit:true,scheduleOverlapCount:0,availability:'Availability not verified',bestMatch:true};
function components(mode){return load('src/components/homeowner/TeamRecommendations.tsx',{
  'react/jsx-runtime':runtime,'react-native':{Text:'Text',View:'View',ActivityIndicator:'Spinner'},
  '@/components/Mascot':defaults('Mascot'),'@/components/ui':{Badge:'Badge'},
  '@/context/ThemeContext':{useTheme:()=>({mode,chrome:mode==='light'?colors.lightChrome:colors.darkChrome})},
  '@/utils/currency':{peso:n=>`PHP ${n}`},
});}
test('recommendation cards render evidence, supported badges and provisional wages in both themes',()=>{
  for(const mode of ['light','dark']){
    const {RecommendationFacts}=components(mode);const tree=RecommendationFacts({match});
    assert.match(text(tree),/Recorded Painting and Surface preparation match Room painting/);
    assert.match(text(tree),/6500\s+for\s+13\s+estimated working days/);
    assert.match(text(tree),/Availability not verified/);
    assert.deepEqual(nodes(tree,'Badge').map(n=>n.props.label),['Skills Match','Best Match','Budget Fit (provisional)']);
    assert.doesNotMatch(text(tree),/100%|Available now|guaranteed/);
    const unknown=RecommendationFacts({match:{...match,bestMatch:false,budgetFit:null,estimatedDays:null,estimatedWage:null,durationBasis:null}});
    assert.deepEqual(nodes(unknown,'Badge').map(n=>n.props.label),['Skills Match']);
    assert.match(text(unknown),/estimate unavailable/);assert.doesNotMatch(text(unknown),/PHP 0|13 estimated/);
  }
});
test('recommendation section shows approved project and robot, keeps roles distinct and invokes existing card renderers',()=>{
  for(const mode of ['light','dark']){
    const Section=components(mode).default;const rendered=[];
    const tree=Section({data:{projectId:7,projectTitle:'Saved bathroom renovation',planApproved:true,notice:'Recorded profiles only.',laborBudget:18000,remainingLaborBudget:12000,contractorBudget:4000,workers:[{id:11,...match}],contractors:[{id:21,...match}]},loading:false,failed:false,
      renderWorker:p=>{rendered.push(['worker',p.id]);return 'Actual worker card';},renderContractor:p=>{rendered.push(['contractor',p.id]);return 'Actual contractor card';}});
    assert.equal(nodes(tree,'Mascot').length,1);assert.match(text(tree),/Approved AI plan/);
    assert.match(text(tree),/Saved bathroom renovation/);assert.match(text(tree),/Recommended Skilled Workers/);assert.match(text(tree),/Recommended Contractors/);
    assert.deepEqual(rendered,[['worker',11],['contractor',21]]);assert.match(text(tree),/Approved labor allowance:\s+PHP 18000/);
    assert.match(text(tree),/not a stated rate/);assert.match(text(tree),/No live AI request is needed/);
  }
});
test('missing plan, empty matches and failures produce honest messages without fabricated cards',()=>{
  const Section=components('light').default;const props={loading:false,failed:false,renderWorker:()=>{throw Error('Unexpected card');},renderContractor:()=>{throw Error('Unexpected card');}};
  assert.match(text(Section({...props,data:null})),/Select an ongoing project/);
  assert.match(text(Section({...props,data:null,failed:true})),/manual browsing remains available/);
  const empty=Section({...props,data:{planApproved:true,projectTitle:'Approved room',notice:'No matching activity',laborBudget:null,contractorBudget:null,workers:[],contractors:[]}});
  assert.match(text(empty),/No relevant unassigned skilled workers/);assert.match(text(empty),/Contractor browsing remains available/);
});
