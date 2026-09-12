'use strict';
(() => {
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=value=>String(value??'').replaceAll('_',' ');
const labels={turnover:'Revenue',operating_profit:'Operating profit',profit_before_tax:'Profit before tax',profit_after_tax:'Profit after tax',num_staff:'Staff / persons',num_members:'Average members',profit_to_members:'Profit available to members',highest_paid_member:'Highest-paid member amount'};
const countMetrics=new Set(['num_staff','num_members']);
const safeUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
const date=value=>{if(!value)return 'Date not supplied';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));return value};
const textQuery=id=>$(id).value.trim().toLocaleLowerCase('en-GB');
const matches=(q,...values)=>!q||values.join(' ').toLocaleLowerCase('en-GB').includes(q);
const alpha=(a,b)=>String(a.name??a.organisation_name??'').localeCompare(String(b.name??b.organisation_name??''),'en-GB');
let D,F,P,S,O,sourceLimit=35;
const valueOf=f=>f.value_exact??f.value??null;
const hasValue=f=>valueOf(f)!==null&&valueOf(f)!=='';
const refsOf=r=>Array.isArray(r?.source_refs)?r.source_refs:[];
function sourceList(refs,label='Sources'){
 const distinct=[...new Map(refs.map(r=>[[r.source_id,r.locator,r.checked_on].join('|'),r])).values()];
 const items=distinct.map(r=>{const s=S.get(r.source_id??r.id);const url=safeUrl(s?.url??r.url);if(!url)return '';const host=new URL(url).hostname.replace(/^www\./,'');return `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(s?.title||host)}</a>${r.locator?`<p>${esc(r.locator)}</p>`:''}${r.checked_on?`<p class="sub">Checked ${esc(date(r.checked_on))}</p>`:''}</li>`}).filter(Boolean);
 return items.length?`<details class="evidence"><summary>${esc(label)} (${items.length})</summary><ul>${items.join('')}</ul></details>`:'<span class="sub">No public source link supplied</span>';
}
function firmName(id,fallback){return F.get(id)?.name||fallback||'Organisation not linked to catalogue'}
function organisationName(row){return row.organisation_name||row.firm_name||row.name||F.get(row.firm_id)?.name||O.get(row.organisation_id||row.legal_entity_id)?.name||row.label||'Organisation not linked to catalogue'}
function scopeName(type){return ({catalogue_scope_linked_to_registered_entity:'Registered entity',overseas_company_uk_establishment:'UK establishment',service_line:'Practice',group_brand:'Group brand',brand:'Brand',university_institute:'University institute'})[type]||plain(type)}
function companyReferences(f){return (f.company_references||[]).map(r=>{if(typeof r==='string')return r;const n=r.company_number||r.establishment_number;if(!n)return '';return n+(r.establishment_number?' (UK establishment)':r.relationship?.startsWith('host')?' (related legal entity)':'')}).filter(Boolean)}
function amount(f){const v=valueOf(f);if(v===null||v==='')return 'Not disclosed';const n=Number(String(v).replaceAll(',',''));const formatted=Number.isFinite(n)?new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(n):esc(v);return countMetrics.has(f.metric)?formatted:`${esc(f.currency||'Currency unspecified')} ${formatted}`}
function financeBasis(f){return [f.accounting_basis,f.metric_basis].filter(Boolean).map(plain).join(' · ')}
function financialRecord(f){return `<div class="record"><p><strong>${esc(labels[f.metric]||plain(f.metric))}</strong> · ${amount(f)} ${f.estimated?'<span class="tag estimate">Estimate</span>':''}</p><p class="sub">Period ended ${esc(date(f.year_end))}${f.period_months?` · ${esc(f.period_months)} months`:''}</p><p class="sub">${esc(financeBasis(f))}</p>${sourceList(refsOf(f))}</div>`}
function currentFinancials(rows){return rows.filter(f=>f.is_latest)}
function empty(cols,text){return `<tr><td colspan="${cols}" class="empty">${esc(text)}</td></tr>`}
function renderFirms(){const q=textQuery('firmSearch'),coverage=$('firmCoverage').value;const rows=D.firms.filter(f=>{const n=D.financials.filter(x=>x.firm_id===f.id&&hasValue(x)).length;return matches(q,f.name,...companyReferences(f))&&(coverage==='all'||(coverage==='checked'?n>0:n===0))}).sort(alpha);
 $('firmCount').textContent=`${rows.length} of ${D.firms.length} catalogue entries`;
 $('firmRows').innerHTML=rows.map(f=>{const fs=D.financials.filter(x=>x.firm_id===f.id&&hasValue(x));const metrics=new Set(fs.map(x=>x.metric));return `<tr><td><button class="name" type="button" data-firm="${esc(f.id)}">${esc(f.name)}</button></td><td>${esc(scopeName(f.scope_type))}<p class="sub">${esc(companyReferences(f).join(' · ')||'No separate UK company number assigned')}</p></td><td>${fs.length?`${metrics.size} checked metric${metrics.size===1?'':'s'}`:'No checked values'}<p class="sub">${fs.length?'Open profile for dates and accounting scope':'Missing information is not zero'}</p></td><td>${sourceList(refsOf(f),'Identity sources')}</td></tr>`}).join('')||empty(4,'No matching firms. Try another name or reset the filters.');
}
function personAffiliations(p){return D.affiliations.filter(a=>a.person_id===p.id)}
function appointmentEvent(a){return D.events.find(e=>e.subject_id===a.person_id&&e.date===a.date&&e.participants.some(p=>p.role==='destination'&&p.entity_id===a.organisation_id))}
function eventRecord(e){return `<div class="record"><p><strong>${esc(e.label)}</strong></p><p class="sub">${esc(date(e.date))} · ${esc(plain(e.date_basis))}</p><p class="sub">${esc(e.qualification)}</p>${sourceList(refsOf(e))}</div>`}
function affiliationRecord(a){const ev=appointmentEvent(a),origin=ev?.participants.find(p=>p.role==='origin');return `<div class="record"><p><strong>${esc(a.organisation_name)}</strong> · ${esc(a.role)}</p><p class="sub">${esc(date(a.date))} · ${esc(plain(a.date_basis))}</p>${ev?.announcement_date&&ev.announcement_date!==a.date?`<p class="sub">Announced ${esc(date(ev.announcement_date))}</p>`:''}${origin?`<p class="sub">Previous organisation: ${esc(origin.name)}</p>`:''}${ev?.geography?`<p class="sub">Scope: ${esc(ev.geography)}</p>`:''}<p class="sub">${esc(ev?.qualification||a.limit)}</p>${sourceList(refsOf(a))}</div>`}
function renderPeople(){const q=textQuery('personSearch'),coverage=$('personCoverage').value,rows=D.people.filter(p=>matches(q,p.name)&&(coverage==='all'||(coverage==='scope'?p.in_research_scope:personAffiliations(p).length>0))).sort(alpha);
 $('peopleCount').textContent=`${rows.length} of ${D.people.length} person entries`;
 $('peopleRows').innerHTML=rows.map(p=>`<tr><td><button class="name" type="button" data-person="${esc(p.id)}">${esc(p.name)}</button></td><td>${p.in_research_scope?'Main research scope':p.in_candidate_roster?'Additional research candidate':'Historical / professional context'}<p class="sub">${p.has_research_dossier?'Inherited research profile exists':'Background coverage is limited'}</p></td><td>${personAffiliations(p).length||'None in this edition'}</td><td>${sourceList(refsOf(p),'Related professional sources')}</td></tr>`).join('')||empty(4,'No matching people. Try another name or reset the filters.');
}
function renderFinancials(){const q=textQuery('financeSearch'),metric=$('financeMetric').value,currency=$('financeCurrency').value;let rows=D.financials.filter(f=>f.metric===metric&&hasValue(f));if($('financePeriod').value==='latest')rows=currentFinancials(rows);rows=rows.filter(f=>matches(q,firmName(f.firm_id,f.firm_name))&&(currency==='all'||f.currency===currency)).sort((a,b)=>firmName(a.firm_id).localeCompare(firmName(b.firm_id))||b.year_end.localeCompare(a.year_end));
 $('financeCurrency').disabled=countMetrics.has(metric);
 $('financeCount').textContent=`${rows.length} checked observation${rows.length===1?'':'s'} · ${labels[metric]||plain(metric)} · original currencies and periods`;
 $('financeRows').innerHTML=rows.map(f=>`<tr><td><button class="name" type="button" data-firm="${esc(f.firm_id)}">${esc(firmName(f.firm_id,f.firm_name))}</button></td><td>${esc(date(f.year_end))}${f.period_months?`<p class="sub">${esc(f.period_months)} months</p>`:''}</td><td class="amount">${amount(f)}${f.estimated?'<p><span class="tag estimate">Estimate</span></p>':''}</td><td><p class="sub">${esc(financeBasis(f))}</p>${sourceList(refsOf(f))}</td></tr>`).join('')||empty(4,'No checked values match these filters. Try another currency or reset.');
}
function locationText(r,international){return international?[r.city,r.country].filter(Boolean).join(', '):(r.address||r.registered_address||'Address not supplied')}
function locationDate(r){return r.as_of||r.observed_on||r.checked_on||r.capture_date}
function locationLimits(r){return r.limit||r.limits||r.notes||r.scope_note||plain(r.address_type)||''}
function renderLocations(){const international=$('locationType').value==='international',q=textQuery('locationSearch'),all=international?D.offices:D.registered_addresses,rows=all.filter(r=>matches(q,organisationName(r),locationText(r,international))).sort((a,b)=>organisationName(a).localeCompare(organisationName(b))||locationText(a,international).localeCompare(locationText(b,international)));
 $('locationCount').textContent=`${rows.length} of ${all.length} ${international?'firm–city observations':'dated address observations'}`;
 $('locationRows').innerHTML=rows.map(r=>`<tr><td>${esc(organisationName(r))}</td><td>${esc(locationText(r,international))}</td><td>${esc(date(locationDate(r)))}${r.included_in_latest_reader_selection===false?'<p class="sub">Superseded address</p>':''}</td><td><p class="sub">${esc(locationLimits(r))}</p>${sourceList(refsOf(r))}</td></tr>`).join('')||empty(4,'No matching locations. Try a different name, city or postcode.');
}
function renderSources(){const q=textQuery('sourceSearch'),rows=D.sources.filter(s=>safeUrl(s.url)&&matches(q,s.url,s.title,s.kind));$('sourceCount').textContent=`${rows.length} linked sources; ${Math.min(sourceLimit,rows.length)} shown`;$('sourceRows').innerHTML=rows.slice(0,sourceLimit).map(s=>`<div class="source-item"><a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.url)}</a><p class="sub">${esc(plain(s.kind))}</p></div>`).join('')||'<p class="empty">No matching sources.</p>';$('moreSources').hidden=rows.length<=sourceLimit}
function openProfile(kind,id){
 const isFirm=kind==='firm',record=(isFirm?F:P).get(id);if(!record)return;
 $('profileKind').textContent=isFirm?'Firm / practice profile':'Person / research coverage';$('profileTitle').textContent=record.name;
 if(isFirm){
  const order=Object.keys(labels),fs=currentFinancials(D.financials.filter(f=>f.firm_id===id&&hasValue(f))).sort((a,b)=>order.indexOf(a.metric)-order.indexOf(b.metric));
  const offices=D.offices.filter(o=>o.firm_id===id),addresses=D.registered_addresses.filter(a=>a.firm_id===id),transactions=D.events.filter(e=>e.subject_id===id&&e.event_type==='dated_ownership_transaction');
  $('profileBody').innerHTML=`<p class="profile-intro">${esc(scopeName(record.scope_type))} · ${esc(companyReferences(record).join(' · ')||'No separate UK company number assigned')}</p><p class="profile-intro">${esc(record.scope_note||'')}</p><p class="sub">${esc(record.scope_limit||'')}</p>${sourceList(refsOf(record),'Identity sources')}
   <h3>Checked financial observations</h3>${fs.length?fs.map(financialRecord).join(''):'<p class="sub">No checked financial values in this edition.</p>'}
   ${transactions.length?`<h3>Dated ownership observations</h3>${transactions.map(eventRecord).join('')}`:''}
   ${addresses.length?`<h3>Dated registered addresses</h3>${addresses.map(a=>`<div class="record"><p>${esc(locationText(a,false))}</p><p class="sub">${esc(date(locationDate(a)))}${a.included_in_latest_reader_selection===false?' · Superseded address':''}</p><p class="sub">${esc(locationLimits(a))}</p>${sourceList(refsOf(a))}</div>`).join('')}`:''}
   ${offices.length?`<h3>Published city listings</h3><p>${esc(offices.map(o=>o.city).join(', '))}</p><p class="sub">Firm-published observations; not a count of staff or headquarters.</p>${sourceList(offices.flatMap(refsOf),'Office sources')}`:''}`;
 }else{
  const affiliations=personAffiliations(record),statutory=D.events.filter(e=>e.subject_id===id&&e.event_type==='LLP member appointment');
  $('profileBody').innerHTML=`<p class="profile-intro">${record.in_research_scope?'Part of the 106-person main research scope.':'Additional research or professional-context entry.'} ${record.has_research_dossier?'An inherited research profile exists; it is not a verified biography.':'Background coverage is limited.'}</p>
   <h3>Checked appointment observations</h3>${affiliations.length?affiliations.map(affiliationRecord).join(''):'<p class="sub">No checked appointment observations in this edition. This does not mean the person has no professional role.</p>'}
   ${statutory.length?`<h3>Supporting statutory appointments</h3>${statutory.map(eventRecord).join('')}`:''}
   <h3>Related professional sources</h3><p class="sub">These sources relate to the person’s professional context. They do not verify every possible biographical claim.</p>${sourceList(refsOf(record),'Professional sources')}`;
 }
 $('profile').showModal();
}
function showView(view){document.querySelectorAll('section[id^="view-"]').forEach(s=>s.hidden=s.id!=='view-'+view);document.querySelectorAll('.sections button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)))}
function reset(view){const controls={firms:[['firmSearch',''],['firmCoverage','all']],people:[['personSearch',''],['personCoverage','all']],financials:[['financeSearch',''],['financeMetric','turnover'],['financePeriod','latest'],['financeCurrency','all']],locations:[['locationSearch',''],['locationType','registered']]};for(const [id,val]of controls[view])$(id).value=val;({firms:renderFirms,people:renderPeople,financials:renderFinancials,locations:renderLocations})[view]()}
async function init(){try{const response=await fetch('data/public-data.json');if(!response.ok)throw new Error('Data request failed');D=await response.json();for(const name of ['firms','people','financials','affiliations','events','registered_addresses','offices','sources'])if(!Array.isArray(D[name]))throw new Error('Incomplete data file');F=new Map(D.firms.map(f=>[f.id,f]));P=new Map(D.people.map(p=>[p.id,p]));S=new Map(D.sources.map(s=>[s.id,s]));O=new Map((D.organisations||[]).map(o=>[o.id,o]));
 $('firmTotal').textContent=D.firms.length;$('peopleTotal').textContent=D.people.length;$('revenueTotal').textContent=new Set(D.financials.filter(f=>f.metric==='turnover'&&hasValue(f)).map(f=>f.firm_id)).size;
 $('publicLimits').textContent='The public download contains the catalogue and source-linked observations. Unreviewed career claims, private research files and original third-party documents are excluded. Sources remain available through their public links.';
 renderFirms();renderPeople();renderFinancials();renderLocations();renderSources();$('loading').hidden=true;$('app').hidden=false;
 document.querySelectorAll('.sections button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
 for(const [ids,fn]of [[['firmSearch','firmCoverage'],renderFirms],[['personSearch','personCoverage'],renderPeople],[['financeSearch','financeMetric','financePeriod','financeCurrency'],renderFinancials],[['locationSearch','locationType'],renderLocations]])for(const id of ids)$(id).addEventListener('input',()=>{if(id==='financeMetric'&&countMetrics.has($('financeMetric').value))$('financeCurrency').value='all';fn()});
 $('sourceSearch').addEventListener('input',()=>{sourceLimit=35;renderSources()});$('moreSources').addEventListener('click',()=>{sourceLimit+=35;renderSources()});document.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click',()=>reset(b.dataset.reset)));
 document.addEventListener('click',ev=>{const f=ev.target.closest('button[data-firm]'),p=ev.target.closest('button[data-person]');if(f)openProfile('firm',f.dataset.firm);if(p)openProfile('person',p.dataset.person)});$('closeProfile').addEventListener('click',()=>$('profile').close());
 }catch(error){$('loading').innerHTML='The interactive view could not load. Please reload, or <a href="data/economics-consultancy-public.sqlite">download the database</a>.';console.error('Database load failed:',error.message)}}
init();
})();
