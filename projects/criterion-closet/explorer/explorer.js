/* Static, source-backed Criterion explorer. No accounts or external data calls. */
(async function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? esc(url.href) : '#'; } catch { return '#'; } };
  const link = (url, label, cls = 'source-link') => `<a class="${cls}" href="${safeURL(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  const number = value => Number(value).toLocaleString('en-GB');
  const date = value => value ? new Date(value + 'T12:00:00Z').toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}) : 'Not recorded';
  const button = (kind, id, title, cls = 'title-button') => `<button class="${cls}" data-${kind}="${esc(id)}">${esc(title)}</button>`;
  const pills = event => event.group ? '<span class="pill">Joint guests</span>' : event.roles.length ? event.roles.map(r => `<span class="pill">${esc(r)}</span>`).join('') : '<span class="pill">Profession unknown</span>';
  const fields = ['role','person','director','kind','decade','country','format','unit','sort'];
  const views = ['catalogue','closet','top10','popular','sources'];
  const descriptions = {
    catalogue:'All entries in the current Criterion catalogue, including films, compilations and box sets. Choose a profession or guest to see their selections within it.',
    closet:'410 indexed Closet visits. Open a guest to see the releases listed on their Criterion page, with links to the original visit and video where available.',
    top10:'272 written articles in which invited guests select favourite films and explain their choices. These are separate from Closet videos; ties and grouped choices produce 3,075 title entries.',
    popular:'Which titles come up most often? Count selections across Closet visits and written lists, or narrow them to a profession, guest or source.',
    sources:'Every imported source table, including historical records. Sources overlap and use different counting methods; these rows are not added together as recommendation votes.'
  };
  let data, model, view='catalogue', page=1, resultRows=[], exportRows=[], revision=0;
  const pageSize=40, sourceCache=new Map();
  function currentFilters() {
    const filters=Object.fromEntries(fields.map(k=>[k,$(k).value]));
    filters.q=$('search').value.trim(); filters.expand=$('expand').checked;
    if (view==='closet') filters.format='closet';
    if (view==='top10') filters.format='top10';
    if (view==='popular') filters.pickedOnly=true;
    return filters;
  }
  function addOptions(id, entries) { for(const [value,label] of entries) $(id).add(new Option(label,value)); }
  function updateURL() {
    const params=new URLSearchParams(); params.set('view',view);
    const f=currentFilters();
    for(const k of [...fields,'q']) if(f[k] && !(k==='unit'&&f[k]==='events')){const value=k==='format'?$('format').value:f[k];if(value)params.set(k,value);}
    if(f.expand)params.set('expand','1');
    if(view==='sources')params.set('table',$('source-table').value);
    try{history.replaceState(null,'','?'+params+location.hash);}catch{}
  }
  function sortOptions(selected) {
    const options=view==='closet' ? [['year-new','Latest recorded visit'],['title','Guest A–Z'],['popular','Most choices']] : view==='top10' ? [['year-new','Latest published list'],['title','Guest A–Z'],['popular','Most titles']] : [['title','Title A–Z'],['popular','Most picked'],['year-new','Newest film year'],['year-old','Oldest film year'],['spine','Spine number']];
    $('sort').replaceChildren();addOptions('sort',options);$('sort').value=options.some(x=>x[0]===selected)?selected:options[0][0];
  }
  function setView(next, initial=false) {
    if(!views.includes(next))next='catalogue';
    view=next;page=1;
    if(!initial)sortOptions(view==='popular'?'popular':view==='closet'?'year-new':'title');
    document.querySelectorAll('.views button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    document.querySelectorAll('.standard-filter').forEach(e=>e.hidden=view==='sources');
    $('source-table-label').hidden=view!=='sources';
    $('format-label').hidden=view==='closet'||view==='top10';
    $('search').placeholder=view==='sources'?'Search every field in this table…':'Film, guest, director…';
    $('view-description').textContent=descriptions[view];
    render();
  }
  function table(headers, body) { return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`; }
  function filmTable(rows, state, offset) {
    const ranked=view==='popular';
    return table([...(ranked?['#']:[]),'Film / selected release','Year','Film director','Type',currentFilters().unit==='selectors'?'Guests':'Visits / lists'],rows.map((r,i)=>`<tr>${ranked?`<td class="rank">${offset+i+1}</td>`:''}<td class="title-cell">${button('item',r.id,r.title)}<span class="subline">${esc(r.country||'Country not recorded')}${r.spine?' · Spine '+esc(r.spine):''}${!r.catalogue?' · Outside current catalogue index':''}</span></td><td class="number">${esc(r.year||'—')}</td><td>${esc(r.director||'Not recorded')}</td><td><span class="pill ${r.kind==='set'?'set':''}">${r.kind==='set'?'Box set':r.kind==='other'?'Other item':'Film entry'}</span></td><td class="frequency">${button('item',r.id,number(r.count),'count-button')}${ranked?`<span class="subline">${state.denominator?(100*r.count/state.denominator).toFixed(1):'0'}% of ${number(state.denominator)}</span><div class="bar" aria-hidden="true"><span style="width:${state.denominator?100*r.count/state.denominator:0}%"></span></div>`:''}${r.indirect?`<span class="subline">${number(r.indirect)} via sets</span>`:''}</td></tr>`).join(''));
  }
  function eventTable(rows) {
    const closet=view==='closet';
    return table(['Guest','Profession',closet?'Recorded':'Published','Listed choices','Original source'],rows.map(e=>`<tr><td class="title-cell">${button('event',e.id,e.name)}<span class="subline">${esc(e.title)}</span></td><td>${pills(e)}</td><td>${esc(date(closet?e.recorded:e.published))}</td><td>${button('event',e.id,number(e.choices.length)+' · View choices','count-button')}</td><td>${link(e.url,closet?'Visit page':'Read the list')}</td></tr>`).join(''));
  }
  function rawTable(rows, offset) {
    if(!rows.length)return '';
    const columns=Object.keys(rows[0]).slice(0,5);
    return table(['Record',...columns],rows.map((row,i)=>`<tr><td>${button('raw',String(offset+i),'View '+(offset+i+1),'source-link title-button')}</td>${columns.map(k=>`<td class="raw-cell" title="${esc(typeof row[k]==='object'?JSON.stringify(row[k]):row[k])}">${esc(typeof row[k]==='object'?JSON.stringify(row[k]):row[k])}</td>`).join('')}</tr>`).join(''));
  }
  async function render() {
    const token=++revision;
    const filters=currentFilters(); updateURL();
    $('results').setAttribute('aria-busy','true');
    let content, state, unit='entries';
    try {
      if(view==='sources') {
        const source=$('source-table').value;
        if(!sourceCache.has(source)) {
          $('results').innerHTML='<div class="loading">Loading this source table…</div>';
          const response=await fetch('data/sources/'+encodeURIComponent(source)+'.json');
          if(!response.ok)throw new Error('Source table could not be loaded.');
          sourceCache.set(source,await response.json());
        }
        if(token!==revision)return;
        resultRows=sourceCache.get(source).filter(row=>!filters.q||CriterionModel.normalize(JSON.stringify(row)).includes(CriterionModel.normalize(filters.q)));
        exportRows=resultRows;unit='source records';
      } else if(view==='closet'||view==='top10') {
        resultRows=model.eventRows(filters);unit=view==='closet'?'visits':'written lists';
        exportRows=resultRows.map(e=>({event_id:e.id,guest:e.name,professions:e.roles.join('; '),joint_guests:e.group,recorded_date:e.recorded,published_date:e.published,url:e.url,choices:e.choices.map(p=>model.items.get(p.item).title).join(' | ')}));
      } else {
        state=model.filmRows(filters,view==='catalogue');resultRows=state.rows;
        exportRows=resultRows.map(r=>({criterion_key:r.id,title:r.title,year:r.year,director:r.director,country:r.country,spine:r.spine,type:r.kind,in_current_catalogue:r.catalogue,count:r.count,count_unit:filters.unit,eligible_denominator:state.denominator,direct_events:r.direct,indirect_events:r.indirect,source:r.url}));
      }
      const totalPages=Math.max(1,Math.ceil(resultRows.length/pageSize));page=Math.min(page,totalPages);
      const offset=(page-1)*pageSize, visible=resultRows.slice(offset,offset+pageSize);
      if(!resultRows.length)content='<div class="empty"><h3>No matches in this selection.</h3><p>Try a different name, a broader profession, or reset the filters.</p></div>';
      else content=view==='sources'?rawTable(visible,offset):view==='closet'||view==='top10'?eventTable(visible):filmTable(visible,state,offset);
      $('results').innerHTML=content;
      $('result-count').textContent=number(resultRows.length)+' '+(resultRows.length===1?({'entries':'entry','visits':'visit','written lists':'written list','source records':'source record'}[unit]||unit):unit)+(resultRows.length>pageSize?' · showing '+number(offset+1)+'–'+number(Math.min(offset+pageSize,resultRows.length)):'');
      $('page-info').textContent='Page '+page+' of '+number(totalPages);
      $('previous').disabled=page<=1;$('next').disabled=page>=totalPages;
      $('pagination').hidden=totalPages===1;
      $('export').disabled=!resultRows.length;
      $('count-note').textContent=view==='sources'?'Historical sources overlap. Use the curated views for combined counts.':view==='closet'||view==='top10'?'Open a guest for all their listed choices. Joint visits remain one group; unknown professions are retained.':`${filters.unit==='selectors'?'Distinct normalized guest names':'Distinct visits / written lists'} · ${number(state.denominator)} eligible ${filters.unit==='selectors'?'guest names':'visits / lists'} · ${filters.format==='closet'?'Closet only':filters.format==='top10'?'Written lists only':'Closet + written lists'} · ${filters.expand?'Direct choices + known set contents':'Directly listed releases; no box-set expansion'}.`;
      const extra=['director','kind','decade','country','format'].filter(k=>$(k).value).length+Number(filters.expand);
      $('filter-count').textContent=extra?'· '+extra+' active':'';
    } catch(error) {
      if(token!==revision)return;
      $('results').innerHTML='<div class="empty"><h3>This table could not be opened.</h3><p>Try selecting the view again, or use the downloadable files below.</p></div>';
      $('result-count').textContent='Data unavailable';$('export').disabled=true;
    } finally {if(token===revision)$('results').setAttribute('aria-busy','false');}
  }
  function showDialog(type, html) {
    $('detail-type').textContent=type;$('detail-body').innerHTML=html;
    if(!$('detail').open)$('detail').showModal();
    $('detail').scrollTop=0;$('close-detail').focus();
  }
  function eventDetail(id) {
    const e=model.events.get(id);if(!e)return;
    const choices=e.choices.map(p=>{const item=model.items.get(p.item);return `<li><span class="position">${esc(e.format==='closet'?p.position:(p.rank||'—'))}</span><div>${button('item',item.id,item.title)}<span class="subline">${esc(item.director||'Director not recorded')}${item.year?' · '+esc(item.year):''} ${item.kind==='set'?' · Box set':''}</span></div>${link(item.url,'Criterion')}</li>`;}).join('');
    showDialog(e.format==='closet'?'Inside the Closet':'A written Top 10',`<h2>${esc(e.name)}</h2><div>${pills(e)}</div><p>${e.format==='closet'?'Recorded '+esc(date(e.recorded))+(e.published?' · Published '+esc(date(e.published)):''):'A guest-written article published by Criterion. The full explanations are on the original page.'}</p><div class="detail-links">${link(e.url,e.format==='closet'?'Original visit':'Read the complete list')}${e.video?link(e.video,'Watch the visit'):''}</div><h3>${number(e.choices.length)} listed selections</h3><p>${e.format==='top10'?'Numbers reproduce printed rank markers. A dash means the title has no separate marker, often within a grouped choice.':'These are the releases listed on the official visit page. Box sets count as one selection; spoken mentions may differ.'}${e.group?' Choices belong to the group unless individual attribution is verified.':''}</p><ul class="pick-list">${choices}</ul>${e.roleSources.length?`<details><summary>Profession sources</summary><ul>${e.roleSources.map(u=>`<li>${link(u,'Source')}</li>`).join('')}</ul></details>`:''}`);
  }
  function itemDetail(id) {
    const item=model.items.get(id);if(!item)return;
    const filters=currentFilters();const state=model.aggregate(filters);const count=state.counts.get(id);
    const events=(count?.events||[]).map(e=>model.events.get(e));
    const imdb=item.imdb||'https://www.imdb.com/find/?q='+encodeURIComponent(item.title+(item.year?' '+item.year:''));
    const letterboxd=item.letterboxd||'https://letterboxd.com/search/'+encodeURIComponent(item.title+(item.year?' '+item.year:''))+'/';
    const members=data.setMembers[id]||[];
    const reachedThrough=event=>event.choices.some(p=>p.item===id)?'Directly listed':'Included through a box set';
    showDialog(item.kind==='set'?'A selected box set':item.kind==='other'?'An additional recorded choice':'A Criterion film entry',`<h2>${esc(item.title)}</h2><p>${esc([item.year,item.director,item.country,item.spine?'Spine '+item.spine:''].filter(Boolean).join(' · '))}</p><div class="detail-links">${link(item.url,'Criterion')}${item.kind==='other'?'':link(imdb,item.imdb?'IMDb':'Search IMDb')+link(letterboxd,item.letterboxd?'Letterboxd':'Search Letterboxd')}</div>${item.cast.length?`<p><strong>Cast:</strong> ${esc(item.cast.slice(0,12).join(', '))}</p>`:''}${item.writers.length?`<p><strong>Writers:</strong> ${esc(item.writers.join(', '))}</p>`:''}<h3>Chosen in ${number(events.length)} visits / lists</h3><p>Within the current guest, profession and source filters. Each event counts at most once.${count?.indirect?' '+number(count.indirect)+' include this title through a set.':''}</p>${events.length?`<ul class="pick-list">${events.map(e=>`<li><span class="position">${e.format==='closet'?'C':'10'}</span><div>${button('event',e.id,e.name)}<span class="subline">${e.format==='closet'?'Closet visit':'Written Top 10'} · ${reachedThrough(e)}</span></div>${link(e.url,'Source')}</li>`).join('')}</ul>`:'<p>No recorded selection matches these filters. This does not imply the film is disliked.</p>'}${item.kind==='set'?`<h3>Known contents</h3><p>${members.length?number(members.length)+' mapped film entries from the source datasets. This may not be a complete contents list.':'Contents have not been mapped in this snapshot.'}</p><ul class="pick-list">${members.map(k=>`<li><span></span><div>${button('item',k,model.items.get(k)?.title||k)}</div></li>`).join('')}</ul>`:''}`);
  }
  function exportCSV() {
    if(!exportRows.length)return;
    const keys=Object.keys(exportRows[0]);
    const cell=value=>{let text=typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    const csv=[keys,...exportRows.map(row=>keys.map(k=>row[k]))].map(row=>row.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='criterion-'+(view==='sources'?$('source-table').value:view)+'-filtered.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  try {
    if($('embedded-data')) data=JSON.parse($('embedded-data').textContent);
    else {const response=await fetch('data/explorer-data.json');if(!response.ok)throw new Error('Dataset unavailable');data=await response.json();}
    model=CriterionModel.create(data);
    if($('embedded-sources'))for(const [name,rows] of Object.entries(JSON.parse($('embedded-sources').textContent)))sourceCache.set(name,rows);
    const roles=[...new Set(data.events.flatMap(e=>e.roles))].sort();addOptions('role',roles.map(r=>[r,r]));addOptions('role',[['Joint','Joint guests'],['Unknown','Profession unknown']]);
    const people=new Map(data.events.map(e=>[e.person,e.name]));addOptions('person',[...people].sort((a,b)=>a[1].localeCompare(b[1])));
    addOptions('director',[...new Set(data.items.map(i=>i.director).filter(Boolean))].sort().map(d=>[d,d]));
    addOptions('country',[...new Set(data.items.map(i=>i.country).filter(Boolean))].sort().map(c=>[c,c]));
    addOptions('decade',[...new Set(data.items.filter(i=>i.year).map(i=>Math.floor(Number(i.year)/10)*10))].sort((a,b)=>b-a).map(d=>[String(d),d+'s']));
    addOptions('source-table',data.sourceTables.map(t=>[t.id,t.id.replaceAll('_',' ')+' · '+number(t.count)]));
    const params=new URLSearchParams(location.search);view=views.includes(params.get('view'))?params.get('view'):'catalogue';
    sortOptions(params.get('sort')||(view==='popular'?'popular':view==='closet'?'year-new':'title'));
    for(const field of fields)if(params.has(field)&&[...$(field).options].some(o=>o.value===params.get(field)))$(field).value=params.get(field);
    $('search').value=params.get('q')||'';$('expand').checked=params.get('expand')==='1';
    if(data.sourceTables.some(t=>t.id===params.get('table')))$('source-table').value=params.get('table');
    const coverage=data.coverage;$('role-coverage').textContent=`Sourced professions cover ${number(coverage.rolesKnown)} of ${number(coverage.soloEvents)} solo visit/list records. ${number(coverage.groupEvents)} records have joint guests. Unknown roles are visible and are not guessed.`;
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
    $('filters').addEventListener('submit',e=>e.preventDefault());
    $('filters').addEventListener('change',()=>{page=1;render();});
    let searchTimer;$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=1;render();},150);});
    $('reset').addEventListener('click',()=>{for(const key of fields)$(key).value=key==='unit'?'events':'';$('search').value='';$('expand').checked=false;sortOptions(view==='popular'?'popular':view==='closet'?'year-new':'title');page=1;render();});
    $('previous').addEventListener('click',()=>{page--;render();$('results').focus({preventScroll:true});});
    $('next').addEventListener('click',()=>{page++;render();$('results').focus({preventScroll:true});});
    $('export').addEventListener('click',exportCSV);
    $('close-detail').addEventListener('click',()=>$('detail').close());
    $('detail').addEventListener('click',e=>{if(e.target===$('detail')){const r=$('detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('detail').close();}});
    document.addEventListener('click',e=>{const b=e.target.closest('[data-item],[data-event],[data-raw]');if(!b)return;if(b.dataset.item)itemDetail(b.dataset.item);else if(b.dataset.event)eventDetail(b.dataset.event);else {const row=resultRows[Number(b.dataset.raw)];showDialog('Source record',`<h2>${esc($('source-table').value.replaceAll('_',' '))}</h2><dl class="source-record">${Object.entries(row).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(typeof v==='object'?JSON.stringify(v,null,2):v??'—')}</dd>`).join('')}</dl>`);}});
    setView(view,true);
  } catch(error) {
    $('result-count').textContent='The dataset could not be loaded.';
    $('results').setAttribute('aria-busy','false');
    $('results').innerHTML='<div class="empty"><h3>The collection is temporarily unavailable.</h3><p>Reload the page to try again, or use the downloads below.</p></div>';
  }
})();
