const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {create} = require('../explorer/model.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname,'../explorer/data/explorer-data.json'),'utf8'));
const model = create(data);

test('the complete official catalogue and event inventories remain reachable',()=>{
  assert.equal(model.filmRows({},true).rows.length,1872);
  assert.equal(model.eventRows({format:'closet'}).length,410);
  assert.equal(model.eventRows({format:'top10'}).length,272);
  assert.equal(new Set(data.events.map(e=>e.id)).size,682);
  assert.ok(data.events.every(e=>e.choices.length && e.choices.every(p=>model.items.has(p.item))));
  assert.ok(data.events.every(e=>!e.name.includes('Closet Picks')));
  const ari=data.events.filter(e=>e.name==='Ari Aster');
  assert.ok(ari.length>=2 && new Set(ari.map(e=>e.person)).size===1);
});
test('numeric Criterion ID collisions do not merge films and sets',()=>{
  assert.equal(model.items.get('films:528').title,'The Silence of the Lambs');
  assert.equal(model.items.get('boxsets:528').title,'Andrzej Wajda: Three War Films');
});
test('written-list counts reproduce the primary-page research',()=>{
  const result=model.filmRows({format:'top10',sort:'popular'});
  assert.equal(result.rows.find(r=>r.id==='films:510').count,29);
  assert.equal(result.rows.find(r=>r.id==='films:211').count,26);
  assert.equal(result.denominator,272);
});
test('actor and writer filters contain only supported solo guests',()=>{
  for(const role of ['Actor','Director','Writer']){
    const result=model.eventRows({role});
    assert.ok(result.length>10);
    assert.ok(result.every(e=>!e.group && e.roles.includes(role)));
  }
  assert.ok(model.eventRows({role:'Joint'}).every(e=>e.group));
});
test('box-set expansion is optional and cannot double count an event',()=>{
  const direct=model.aggregate({}), expanded=model.aggregate({expand:true});
  assert.ok([...expanded.counts].some(([id,r])=>r.events.length>(direct.counts.get(id)?.events.length||0)));
  for(const [id,count] of expanded.counts){
    assert.equal(count.events.length,new Set(count.events).size,id);
    assert.ok(count.events.length>= (direct.counts.get(id)?.events.length||0));
    assert.equal(count.direct+count.indirect,count.events.length);
  }
});
test('repeat guest names are deduplicated only in the distinct-name unit',()=>{
  const all=model.filmRows({unit:'events'}), unique=model.filmRows({unit:'selectors'});
  assert.ok(unique.denominator<all.denominator);
  const byID=new Map(all.rows.map(r=>[r.id,r.count]));
  assert.ok(unique.rows.every(r=>r.count<=byID.get(r.id)));
});
test('source, guest, title, decade and release-type filters compose',()=>{
  const guest=data.events.find(e=>e.name==='Wes Anderson');
  assert.ok(guest);
  assert.ok(model.eventRows({person:guest.person}).every(e=>e.person===guest.person));
  assert.ok(model.filmRows({kind:'set'},true).rows.every(r=>r.kind==='set'));
  assert.ok(model.filmRows({decade:'1960'},true).rows.every(r=>r.year>=1960 && r.year<1970));
  assert.ok(model.filmRows({q:'no match xyz 184062'},true).rows.length===0);
});
