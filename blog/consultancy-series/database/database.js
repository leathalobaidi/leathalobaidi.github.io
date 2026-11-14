'use strict';
(() => {
document.body.classList.toggle('embedded-database', new URLSearchParams(location.search).get('embed') === '1');
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=value=>String(value??'').replaceAll('_',' ');
const labels={turnover:'Revenue',operating_profit:'Operating profit',profit_before_tax:'Profit before tax',profit_after_tax:'Profit after tax',num_staff:'Staff / persons',num_members:'Average members',profit_to_members:'Profit available to members',highest_paid_member:'Highest-paid member amount'};
const dateBasis=value=>({actual_start:'Confirmed start',confirmed_start_month:'Confirmed start month',announced_start:'Intended start',announced_start_month:'Intended start month',recorded_start_month:'Recorded start month',announcement:'Announcement',statutory_appointment_date:'Statutory effective date',transaction_close:'Transaction close'})[value]||plain(value);
const countMetrics=new Set(['num_staff','num_members']);
const safeUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
const date=value=>{if(!value)return 'Date not supplied';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));if(/^\d{4}-\d{2}$/.test(value))return new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'-01T00:00:00Z'));return value};
const textQuery=id=>$(id).value.trim().toLocaleLowerCase('en-GB');
const matches=(q,...values)=>!q||values.join(' ').toLocaleLowerCase('en-GB').includes(q);
const alpha=(a,b)=>String(a.name??a.organisation_name??'').localeCompare(String(b.name??b.organisation_name??''),'en-GB');
const foldName=value=>String(value??"").normalize("NFD").replace(/\p{M}/gu,"").toLocaleLowerCase("en-GB");
let D,F,P,S,O,sourceLimit=35,ownershipFirm='';
const peopleRelationships=new Map();
const valueOf=f=>f.value_exact??f.value??null;
const hasValue=f=>valueOf(f)!==null&&valueOf(f)!=='';
const refsOf=r=>Array.isArray(r?.source_refs)?r.source_refs:[];
function sourceList(refs,label='Sources'){
 const distinct=[...new Map(refs.map(r=>[[r.source_id,r.locator,r.checked_on].join('|'),r])).values()];
 const items=distinct.map(r=>{const s=S.get(r.source_id??r.id);const url=safeUrl(s?.url??r.url);if(!url)return '';const parsed=new URL(url);const host=parsed.hostname.replace(/^www\./,'');const filingPage=host==='find-and-update.company-information.service.gov.uk'&&parsed.pathname.endsWith('/document')?parsed.hash.match(/^#page=(\d+)$/)?.[1]:null;const title=filingPage?(s?.kind==='Companies House appointment filing'?'LLP appointment filing':s?.kind==='Companies House location filing'?'Companies House filing':'Filed accounts')+' (PDF page '+filingPage+')':s?.title||s?.kind||host;return `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>${r.locator?`<p>${esc(r.locator)}</p>`:''}${r.source_date?`<p class="sub">${esc(r.date_basis||'Source dated')} ${esc(date(r.source_date))}</p>`:''}${r.checked_on?`<p class="sub">Checked ${esc(date(r.checked_on))}</p>`:''}</li>`}).filter(Boolean);
 return items.length?`<details class="evidence"><summary>${esc(label)} (${items.length})</summary><ul>${items.join('')}</ul></details>`:'<span class="sub">No public source link supplied</span>';
}
function firmName(id,fallback){return F.get(id)?.name||fallback||'Organisation not linked to catalogue'}
function organisationName(row){return row.organisation_name||row.firm_name||row.name||F.get(row.firm_id)?.name||O.get(row.organisation_id||row.legal_entity_id)?.name||row.label||'Organisation not linked to catalogue'}
function scopeName(type){return ({catalogue_scope_linked_to_registered_entity:'Registered entity',overseas_company_uk_establishment:'UK establishment',service_line:'Practice',group_brand:'Group brand',brand:'Brand',university_institute:'University institute'})[type]||plain(type)}
function identitySummary(f){
 const entries=f.company_references||[];
 return entries.length?entries.map(r=>`<p class="sub">${esc(r.registered_name)} · ${esc(r.company_number||r.establishment_number)}${r.register_status==='Dissolved'?' · Dissolved':''}</p>`).join(''):'<p class="sub">University institute</p>';
}
function identityProfile(f){
 const entries=f.company_references||[];
 return entries.map(r=>{
   const number=r.company_number||r.establishment_number;
   const dates=[r.registration_date&&`${r.registration_date_basis} ${date(r.registration_date)}`,r.ceased_on&&`Dissolved ${date(r.ceased_on)}`].filter(Boolean).join(' · ');
   return `<div class="record"><p><strong>${esc(r.registered_name)}</strong> · ${esc(number)}</p><p class="sub">${esc(r.relationship)}</p>${dates?`<p class="sub">${esc(dates)}</p>`:''}${r.home_register_number?`<p class="sub">Home register ${esc(r.home_register_number)}</p>`:''}${sourceList(refsOf(r),'Original sources')}</div>`;
 }).join('');
}
function amount(f){const v=valueOf(f);if(v===null||v==='')return 'Not disclosed';const n=Number(String(v).replaceAll(',',''));const formatted=Number.isFinite(n)?new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(n):esc(v);return countMetrics.has(f.metric)?formatted:`${esc(f.currency||'Currency unspecified')} ${formatted}`}
function financeBasis(f){return [f.accounting_basis,f.metric_basis].filter(Boolean).map(plain).join(' · ')}
function financialRecord(f){return `<div class="record"><p><strong>${esc(labels[f.metric]||plain(f.metric))}</strong> · ${amount(f)} ${f.estimated?'<span class="tag estimate">Estimate</span>':''}</p><p class="sub">Period ended ${esc(date(f.year_end))}${f.period_months?` · ${esc(f.period_months)} months`:''}</p><p class="sub">${esc(financeBasis(f))}</p>${sourceList(refsOf(f))}</div>`}
function currentFinancials(rows){return rows.filter(f=>f.is_latest)}
function empty(cols,text){return `<tr><td colspan="${cols}" class="empty">${esc(text)}</td></tr>`}
function renderFirms(){const q=textQuery('firmSearch'),coverage=$('firmCoverage').value;const rows=D.firms.filter(f=>{const n=D.financials.filter(x=>x.firm_id===f.id&&hasValue(x)).length;const identifiers=(f.company_references||[]).flatMap(r=>[r.registered_name,r.company_number,r.establishment_number,r.home_register_number]);return matches(q,f.name,...identifiers)&&(coverage==='all'||(coverage==='checked'?n>0:n===0))}).sort(alpha);
 $('firmCount').textContent=`${rows.length} of ${D.firms.length} catalogue entries`;
 $('firmRows').innerHTML=rows.map(f=>{const fs=D.financials.filter(x=>x.firm_id===f.id&&hasValue(x));const metrics=new Set(fs.map(x=>x.metric));return `<tr><td><button class="name" type="button" data-firm="${esc(f.id)}">${esc(f.name)}</button></td><td>${esc(scopeName(f.scope_type))}${identitySummary(f)}</td><td>${fs.length?`${metrics.size} checked metric${metrics.size===1?'':'s'}`:'No checked values'}<p class="sub">${fs.length?'Open profile for dates and accounting scope':'Missing information is not zero'}</p></td><td>${sourceList(refsOf(f),'Identity sources')}</td></tr>`}).join('')||empty(4,'No matching firms. Try another name or reset the filters.');
}
function personAffiliations(p){return peopleRelationships.get(p.id)||[]}
function eventRecord(e){return `<div class="record"><p><strong>${esc(e.label)}</strong></p><p class="sub">${esc(date(e.date))} · ${esc(dateBasis(e.date_basis))}</p><p class="sub">${esc(e.qualification)}</p>${sourceList(refsOf(e))}</div>`}
function affiliationRecord(a){
 const dates=[a.date?a.date_basis+' '+date(a.date):a.date_basis+' · Date not supplied'];
 if(a.end_date&&a.end_date!==a.date)dates.push('Ended '+date(a.end_date));
 return `<div class="record"><p><strong>${esc(a.organisation_name)}</strong> · ${esc(a.role)}</p><p class="sub">${esc(a.evidence_type)} · ${esc(dates.join(' · '))}</p>${sourceList(refsOf(a),'Original source')}</div>`;
}
function renderCareers(){
 const q=textQuery('careerSearch'),type=$('careerType').value,byEvent=new Map(D.affiliations.map(a=>[a.event_id,a]));
 const group=e=>e.id.startsWith('appointment-')?'moves':e.id.startsWith('statutory-')?'statutory':'ownership';
 const rows=D.events.filter(e=>(type==='all'||group(e)===type)&&matches(q,e.label,byEvent.get(e.id)?.role,...e.participants.map(p=>p.name)));
 $('careerCount').textContent=`${rows.length} checked event${rows.length===1?'':'s'}`;
 $('careerRows').innerHTML=rows.map(e=>{
   const record=byEvent.get(e.id), origin=e.participants.find(p=>p.role==='origin'), dest=e.participants.find(p=>p.role==='destination');
   const route=origin&&dest?`${origin.name} → ${dest.name}`:e.event_type;
   return `<tr><td><strong>${esc(e.label)}</strong><p class="sub">${esc(route)}</p>${record?`<p class="sub">${esc(record.role)}</p>`:''}</td><td>${esc(date(e.date))}<p class="sub">${esc(dateBasis(e.date_basis))}</p>${e.announcement_date&&e.announcement_date!==e.date?`<p class="sub">Announced ${esc(date(e.announcement_date))}</p>`:''}</td><td><p class="sub">${esc(e.qualification)}</p>${sourceList(refsOf(e))}</td></tr>`;
 }).join('')||empty(3,'No checked events match these filters.');
}
function renderPeople(){
 const q=foldName(textQuery('personSearch')),coverage=$('personCoverage').value;
 const rows=D.people.filter(p=>{
  const names=[p.name,...p.professional_aliases,...personAffiliations(p).map(a=>a.organisation_name)];
  return names.some(n=>foldName(n).includes(q))&&(coverage==='all'||(coverage==='scope'?p.in_research_scope:p.identity_status===coverage));
 }).sort(alpha);
 $('peopleCount').textContent=`${rows.length} of ${D.people.length} person entries`;
 $('peopleRows').innerHTML=rows.map(p=>{
  const label=p.identity_status==='source_checked'?'Source checked':'Unresolved';
  const scope=p.in_research_scope?'Main research scope':p.in_candidate_roster?'Additional research candidate':'Professional or historical context';
  const variants=p.professional_aliases.length?`<p class="sub">Also recorded as ${esc(p.professional_aliases.join(', '))}</p>`:'';
  return `<tr><td><button class="name" type="button" data-person="${esc(p.id)}">${esc(p.name)}</button>${variants}</td><td>${scope}</td><td>${personAffiliations(p).length||'None in this edition'}</td><td><a href="people-provenance.html#${esc(p.id)}">${label}</a></td></tr>`;
 }).join('')||empty(4,'No matching people. Try another name or reset the filters.');
}
function renderOwnership(){
 const q=foldName(textQuery('ownershipSearch')),type=$('ownershipType').value,register=type!=='transactions';
 const entries=register?D.ownership_control_observations:D.ownership_transactions;
 const rows=entries.filter(r=>{
  const text=foldName([r.subject,r.counterparty,r.controller,r.company_number,r.controller_number,firmName(r.firm_id,''),r.record_type].filter(Boolean).join(' '));
  return (!ownershipFirm||r.firm_id===ownershipFirm)&&(!q||text.includes(q))&&(!register||type==='register'||
    (type==='current'&&r.status==='Active'&&r.register_status!=='Dissolved')||(type==='historical'&&r.status!=='Active'&&r.status!=='No entry shown'));
 }).sort((a,b)=>(register?a.subject.localeCompare(b.subject):(b.date||'').localeCompare(a.date||''))||a.id.localeCompare(b.id));
 const noun=register?'register observation':'transaction or ownership observation';
 $('ownershipCount').textContent=`${rows.length} ${noun}${rows.length===1?'':'s'}${ownershipFirm?' · '+firmName(ownershipFirm):''}`;
 $('ownershipRows').innerHTML=rows.map(r=>{
  const party=r.counterparty||r.controller,when=register?r.notified_on:r.date;
  const basis=register?(when?'Register notification':'Register observation'):r.date_basis;
  return `<tr><td><strong>${esc(r.subject)}</strong>${r.company_number?`<p class="sub">Company ${esc(r.company_number)}</p>`:''}${party?`<p>${esc(party)}${r.controller_number?` <span class="sub">· ${esc(r.controller_number)}</span>`:''}</p>`:''}</td><td>${esc(date(when))}<p class="sub">${esc(basis)} · ${esc(r.status)}${r.register_status==='Dissolved'?' · Entity dissolved':''}</p>${r.ceased_on?`<p class="sub">Ceased or withdrawn ${esc(date(r.ceased_on))}</p>`:''}</td><td><p>${esc(r.observation||r.control_basis)}</p><p class="sub">${esc(r.qualification||r.note)}</p>${sourceList(refsOf(r),'Original sources')} <a class="sub" href="ownership-provenance.html#${esc(r.id)}">Provenance notes</a></td></tr>`;
 }).join('')||empty(3,'No records match these filters. Try another name or record type.');
}
function renderFinancials(){const q=textQuery('financeSearch'),metric=$('financeMetric').value,currency=$('financeCurrency').value;let rows=D.financials.filter(f=>f.metric===metric);if($('financePeriod').value==='latest')rows=currentFinancials(rows);rows=rows.filter(f=>matches(q,firmName(f.firm_id,f.firm_name))&&(currency==='all'||f.currency===currency)).sort((a,b)=>firmName(a.firm_id).localeCompare(firmName(b.firm_id))||b.year_end.localeCompare(a.year_end));
 $('financeCurrency').disabled=countMetrics.has(metric);
 $('financeCount').textContent=`${rows.length} checked observation${rows.length===1?'':'s'} · ${labels[metric]||plain(metric)} · original currencies and periods`;
 $('financeRows').innerHTML=rows.map(f=>`<tr><td><button class="name" type="button" data-firm="${esc(f.firm_id)}">${esc(firmName(f.firm_id,f.firm_name))}</button></td><td>${esc(date(f.year_end))}${f.period_months?`<p class="sub">${esc(f.period_months)} months</p>`:''}</td><td class="amount">${amount(f)}${f.estimated?'<p><span class="tag estimate">Estimate</span></p>':''}</td><td><p class="sub">${esc(financeBasis(f))}</p>${sourceList(refsOf(f))}</td></tr>`).join('')||empty(4,'No checked observations match these filters. Try another currency or reset.');
}
function locationText(r,international){return international?[r.city,r.country].filter(Boolean).join(', '):(r.address||r.registered_address||'Address not supplied')}
function locationDate(r){return r.as_of||r.observed_on||r.checked_on||r.capture_date}
function locationLimits(r){return r.limit||r.limits||r.notes||r.scope_note||plain(r.address_type)||''}
function locationStatus(r) {
 if (r.superseded_on) return 'Superseded address';
 if (r.legal_status==='Dissolved') return 'Dissolved · last registered address';
 return r.listing_status || r.legal_status || '';
}
function locationDates(r) {
 const items=[['Observed',locationDate(r)],['Effective',r.effective_from],['Replaced',r.superseded_on],['Dissolved',r.dissolved_on]];
 if (r.checked_on && r.checked_on!==locationDate(r)) items.push(['Rechecked',r.checked_on]);
 return items.filter(([,value])=>value).map(([label,value])=>`<p class="sub">${label} ${esc(date(value))}</p>`).join('');
}
function renderLocations(){
 const type=$('locationType').value, international=type==='international',q=textQuery('locationSearch');
 const all=international?D.offices:D.registered_addresses.filter(r=>type==='registered-all'||(r.in_latest_register_snapshot??r.included_in_latest_reader_selection));
 const rows=all.filter(r=>matches(q,organisationName(r),locationText(r,international),O.get(r.legal_entity_id)?.company_number,r.source_label))
   .sort((a,b)=>organisationName(a).localeCompare(organisationName(b))||locationText(a,international).localeCompare(locationText(b,international)));
 $('locationCount').textContent=`${rows.length} of ${all.length} ${international?'firm–city observations':'registered address observations'}`;
 $('locationRows').innerHTML=rows.map(r=>`<tr><td>${esc(organisationName(r))}</td><td>${esc(locationText(r,international))}<p class="sub">${esc(locationStatus(r))}</p></td><td>${locationDates(r)}</td><td><p class="sub">${esc(locationLimits(r))}</p>${sourceList(refsOf(r))}</td></tr>`).join('')||empty(4,'No matching locations. Try a different name, city or postcode.');
}
function renderSources(){const q=textQuery('sourceSearch'),rows=D.sources.filter(s=>safeUrl(s.url)&&matches(q,s.url,s.title,s.kind));$('sourceCount').textContent=`${rows.length} linked sources; ${Math.min(sourceLimit,rows.length)} shown`;$('sourceRows').innerHTML=rows.slice(0,sourceLimit).map(s=>`<div class="source-item"><a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.url)}</a><p class="sub">${esc(plain(s.kind))}</p></div>`).join('')||'<p class="empty">No matching sources.</p>';$('moreSources').hidden=rows.length<=sourceLimit}
function openProfile(kind,id){
 const isFirm=kind==='firm',record=(isFirm?F:P).get(id);if(!record)return;
 $('profileKind').textContent=isFirm?'Firm / practice profile':'Person / research coverage';$('profileTitle').textContent=record.name;
 if(isFirm){
  const order=Object.keys(labels),fs=currentFinancials(D.financials.filter(f=>f.firm_id===id)).sort((a,b)=>order.indexOf(a.metric)-order.indexOf(b.metric));
  const offices=D.offices.filter(o=>o.firm_id===id),addresses=D.registered_addresses.filter(a=>a.firm_id===id),transactions=D.events.filter(e=>e.subject_id===id&&e.event_type==='dated_ownership_transaction');
  $('profileBody').innerHTML=`<p class="profile-intro">${esc(record.scope_note||'')}</p><p class="sub">Identity checked ${esc(date(record.identity_checked_on))} · <a href="identity-provenance.html#${esc(id)}">Provenance notes</a></p>
   ${identityProfile(record)||sourceList(refsOf(record),'Identity sources')}
   <p><button type="button" class="name" data-firm-ownership="${esc(id)}">See ownership evidence for this firm</button></p>
   <h3>Checked financial observations</h3>${fs.length?fs.map(financialRecord).join(''):'<p class="sub">No checked financial values in this edition.</p>'}
   ${transactions.length?`<h3>Dated ownership observations</h3>${transactions.map(eventRecord).join('')}`:''}
   ${addresses.length?`<h3>Dated registered addresses</h3>${addresses.map(a=>`<div class="record"><p>${esc(locationText(a,false))}</p><p class="sub">${esc(locationStatus(a))}</p>${locationDates(a)}<p class="sub">${esc(locationLimits(a))}</p>${sourceList(refsOf(a))}</div>`).join('')}`:''}
   ${offices.length?`<h3>Published city listings</h3><p>${esc(offices.map(o=>o.city+(o.listing_status==='Historical listing'?' (historical listing)':'')).join(', '))}</p><p class="sub">Firm-published observations; not a count of staff or headquarters.</p>${sourceList(offices.flatMap(refsOf),'Office sources')}`:''}`;
 }else{
  const affiliations=personAffiliations(record),statutory=D.events.filter(e=>e.subject_id===id&&e.event_type==='LLP member appointment');
  const names=refsOf(record).filter(r=>['published_name_variant','statutory_name'].includes(r.field));
  $('profileBody').innerHTML=`<p class="profile-intro">${esc(record.coverage_limit)}</p>
   <p class="sub">${record.identity_status==='source_checked'?'Source checked':'Unresolved'} · Reviewed ${esc(date(record.identity_checked_on))} · <a href="people-provenance.html#${esc(id)}">Provenance notes</a></p>
   ${record.professional_aliases.length?`<p>Also recorded as ${esc(record.professional_aliases.join(', '))}.</p>`:''}
   ${names.length?sourceList(names,'Original name sources'):''}
   <h3>Checked affiliations</h3>${affiliations.length?affiliations.map(affiliationRecord).join(''):'<p class="sub">No checked affiliation in this edition.</p>'}
   ${statutory.length?`<h3>Filed appointment documents</h3>${statutory.map(eventRecord).join('')}`:''}`;
 }
 $('profile').showModal();
}
function showView(view){document.querySelectorAll('section[id^="view-"]').forEach(s=>s.hidden=s.id!=='view-'+view);document.querySelectorAll('.sections button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)))}
function reset(view){if(view==='ownership')ownershipFirm='';const controls={firms:[['firmSearch',''],['firmCoverage','all']],people:[['personSearch',''],['personCoverage','all']],careers:[['careerSearch',''],['careerType','moves']],ownership:[['ownershipSearch',''],['ownershipType','transactions']],financials:[['financeSearch',''],['financeMetric','turnover'],['financePeriod','latest'],['financeCurrency','all']],locations:[['locationSearch',''],['locationType','registered']]};for(const [id,val]of controls[view])$(id).value=val;({firms:renderFirms,people:renderPeople,careers:renderCareers,ownership:renderOwnership,financials:renderFinancials,locations:renderLocations})[view]()}
async function init(){try{const response=await fetch('data/public-data.json');if(!response.ok)throw new Error('Data request failed');D=await response.json();for(const name of ['firms','people','financials','affiliations','events','registered_addresses','offices','sources','people_affiliation_observations','ownership_transactions','ownership_control_observations'])if(!Array.isArray(D[name]))throw new Error('Incomplete data file');F=new Map(D.firms.map(f=>[f.id,f]));P=new Map(D.people.map(p=>[p.id,p]));S=new Map(D.sources.map(s=>[s.id,s]));O=new Map((D.organisations||[]).map(o=>[o.id,o]));
 for(const a of D.people_affiliation_observations){
  if(!peopleRelationships.has(a.person_id))peopleRelationships.set(a.person_id,[]);
  peopleRelationships.get(a.person_id).push(a);
 }
 $('firmTotal').textContent=D.firms.length;$('peopleTotal').textContent=D.people.length;$('revenueTotal').textContent=new Set(D.financials.filter(f=>f.metric==='turnover'&&hasValue(f)).map(f=>f.firm_id)).size;
 $('publicLimits').textContent='The public download contains the catalogue and source-linked observations. Unreviewed career claims, private research files and original third-party documents are excluded. Sources remain available through their public links.';
 renderFirms();renderPeople();renderCareers();renderOwnership();renderFinancials();renderLocations();renderSources();$('loading').hidden=true;$('app').hidden=false;
 const sections=document.querySelectorAll('.sections button');
 sections.forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
 const initialView=[...sections].find(b=>location.hash==='#view-'+b.dataset.view);
 if(initialView)showView(initialView.dataset.view);
 for(const [ids,fn]of [[['firmSearch','firmCoverage'],renderFirms],[['personSearch','personCoverage'],renderPeople],[['careerSearch','careerType'],renderCareers],[['ownershipSearch','ownershipType'],renderOwnership],[['financeSearch','financeMetric','financePeriod','financeCurrency'],renderFinancials],[['locationSearch','locationType'],renderLocations]])for(const id of ids)$(id).addEventListener('input',()=>{if(id==='financeMetric'&&countMetrics.has($('financeMetric').value))$('financeCurrency').value='all';fn()});
 $('sourceSearch').addEventListener('input',()=>{sourceLimit=35;renderSources()});$('moreSources').addEventListener('click',()=>{sourceLimit+=35;renderSources()});document.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click',()=>reset(b.dataset.reset)));
 document.addEventListener('click',ev=>{const f=ev.target.closest('button[data-firm]'),p=ev.target.closest('button[data-person]');if(f)openProfile('firm',f.dataset.firm);if(p)openProfile('person',p.dataset.person);
 const own=ev.target.closest('button[data-firm-ownership]');
 if(own){ownershipFirm=own.dataset.firmOwnership;$('ownershipSearch').value='';
  $('ownershipType').value=D.ownership_transactions.some(r=>r.firm_id===ownershipFirm)?'transactions':'register';
  $('profile').close();showView('ownership');renderOwnership();$('ownershipHeading').scrollIntoView({block:'start'});}
});$('closeProfile').addEventListener('click',()=>$('profile').close());
 }catch(error){$('loading').innerHTML='The interactive view could not load. Please reload, or <a href="data/economics-consultancy-public.sqlite">download the database</a>.';console.error('Database load failed:',error.message)}}
init();
})();
