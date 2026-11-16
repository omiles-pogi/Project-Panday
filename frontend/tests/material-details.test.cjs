const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,hooks,nodes,text,runtime,defaults,theme}=require('./helpers/account-harness.cjs');
const description=load('src/utils/materialDescription.ts',{});
const stock=load('src/utils/supplierStock.ts',{});
const notes=[
  'Specification not supplied (blank in both source CSVs).',
  'Stock availability is unconfirmed. Recorded starting stock is 10; supplier must verify physical quantities before confirming stock or activating this listing.',
  'Source category: Structural Steel',
  'Source reference: Priced_Materials.csv#21',
  'Complete listing: Materials_Listing.csv#21',
  'Source supplier: Example hardware; source location: Example location',
].join('\n');

test('material presentation hides complete import-note blocks but preserves real specifications and descriptions',()=>{
  for(const input of [null,undefined,'',notes,notes.replaceAll('\n','\r\n')])assert.equal(description.publicMaterialDescription(input),null);
  const actual='Specification: 1/2 inch\nSuitable for indoor water connections.';
  assert.equal(description.publicMaterialDescription(actual+'\n'+notes),actual);
  assert.equal(description.publicMaterialDescription('  Source category: Internal\nGalvanized steel, 6 m length.'),'Galvanized steel, 6 m length.');
  const product={description:notes,stockConfirmed:undefined};
  assert.equal(stock.isSupplierStockConfirmed(product),false);description.publicMaterialDescription(product.description);
  assert.equal(product.description,notes);assert.equal(stock.isSupplierStockConfirmed(product),false,'display cleanup never confirms or modifies stock');
});

test('the shared details modal hides source notes for every material while retaining all user-facing fields and Close',async()=>{
  const material={id:21,name:'Example C-purlin',category:'Steel',description:notes,price:550,unit:'piece',available_quantity:10,min_order:1,stock_status:'in_stock',updated_at:'2026-11-15T12:00:00Z',supplier:{id:4,business_name:'Example hardware',name:'Example contact',supplier_profile:{location:'Example location',contact_number:'Example contact number'}}};
  const second={...material,id:22,name:'Example PVC pipe',description:'Specification: 1/2 inch\n'+notes};
  const before=JSON.stringify([material,second]);
  const h=hooks();
  const Screen=load('src/screens/materials/MaterialCatalog.tsx',{
    react:h.react,'react/jsx-runtime':runtime,'react-native':{ActivityIndicator:'Spinner',Pressable:'Button',Text:'Text',View:'View'},'expo-router':{useFocusEffect:fn=>h.react.useEffect(fn,[fn])},'@expo/vector-icons':{Ionicons:'Icon'},
    '@/components/ui':Object.fromEntries(['Badge','Button','Card','ChipPicker','Field','PageHeader','Screen'].map(n=>[n,n])),
    '@/components/Sheet':defaults('Sheet'),'@/components/StockBadge':defaults('StockBadge'),'@/context/ThemeContext':{useTheme:()=>theme},'@/data/supplier':{CATEGORIES:['Steel'],CAT_COLORS:{Other:'#999'}},
    '@/services/api/supplierProducts':{fetchMaterialCatalog:async()=>[material,second]},'@/utils/currency':{peso:n=>'PHP '+n},'@/utils/materialDescription':description,
  },{setTimeout:()=>0,clearTimeout(){}}).default;
  const render=()=>h.render(()=>Screen({topInset:false}));let tree=await render();
  for(const [index,record]of [material,second].entries()){
    nodes(tree,'MaterialCard')[index].props.onPress();tree=await render();
    const modal=nodes(tree,'MaterialDetailSheet')[0];const sheet=modal.type(modal.props);
    assert.equal(sheet.props.title,record.name);assert.equal(sheet.props.subtitle,record.category);
    assert.doesNotMatch(text(sheet),/Specification not supplied|Stock availability is unconfirmed|Source category|Source reference|Complete listing|Source supplier/);
    assert.equal(nodes(sheet,'StockBadge')[0].props.status,'in_stock');
    for(const label of ['Price','Available quantity','Minimum order','Supplier','Contact person','Location','Updated'])assert.ok(text(sheet).includes(label),label+' remains visible');
    assert.match(text(sheet),/PHP 550/);assert.match(text(sheet),/10 piece/);
    const blocks=nodes(sheet,'Text').filter(n=>n.props.className==='text-sm leading-5 text-secondary-foreground');
    assert.equal(blocks.length,index===0?0:1,'notes-only content has no empty description block');
    if(index===1)assert.equal(blocks[0].props.children,'Specification: 1/2 inch');
    sheet.props.onClose();tree=await render();assert.equal(nodes(tree,'MaterialDetailSheet').length,0);
  }
  assert.equal(JSON.stringify([material,second]),before,'all stored values and original notes remain unchanged');
});
