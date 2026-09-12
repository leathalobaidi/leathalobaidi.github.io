(async function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = n => Number(n).toLocaleString('en-GB');
  const safeURL = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? esc(url.href) : '#'; } catch { return '#'; } };
  const explorerBase = document.body.dataset.explorerBase || '../explorer/';
  const explorer = params => explorerBase + '?' + new URLSearchParams(params);
  const filmURL = (item, params = {}) => explorer({ view: item.catalogue ? 'catalogue' : 'popular', sort: 'popular', kind: item.kind, q: item.title, ...params });
  const filmMeta = item => [item.director, item.year].filter(Boolean).join(' · ');
  const formatName = event => event.format === 'closet' ? 'Closet visit' : 'Written Top 10';
  const eventDate = event => event.recorded || event.published || '';
  const dateLabel = value => value ? new Date(value + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Date not recorded';
  $('retry').addEventListener('click', () => location.reload());
  let scrollPending = false;
  function progress() {
    const available = document.documentElement.scrollHeight - innerHeight;
    $('progress').style.transform = 'scaleX(' + (available > 0 ? Math.min(1, Math.max(0, scrollY / available)) : 0) + ')';
    const current = [...document.querySelectorAll('.chapter')].filter(s => s.getBoundingClientRect().top < innerHeight * .45).at(-1);
    document.querySelectorAll('.chapter-nav a').forEach(a => { if (current && a.hash === '#' + current.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    scrollPending = false;
  }
  addEventListener('scroll', () => { if (!scrollPending) { scrollPending = true; requestAnimationFrame(progress); } }, { passive: true });
  addEventListener('resize', progress);
  progress();
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); } }), { threshold: .08 });
    document.querySelectorAll('.reveal').forEach(e => { e.classList.add('reveal-pending'); observer.observe(e); });
  }
  try {
    let data;
    if ($('embedded-data')) data = JSON.parse($('embedded-data').textContent);
    else { const response = await fetch('../explorer/data/explorer-data.json'); if (!response.ok) throw new Error('Dataset unavailable'); data = await response.json(); }
    const model = CriterionModel.create(data), story = CriterionStory.create(data, model);
    const countValues = { ...data.counts, picked: story.selected.length, unpicked: story.catalogue.length - story.selected.length };
    document.querySelectorAll('[data-count]').forEach(e => { e.textContent = number(countValues[e.dataset.count]); });
    let shelfMode = 'all', shelfGeometry;
    const catalogue = [...story.catalogue].sort((a, b) => (a.year || 9999) - (b.year || 9999) || a.title.localeCompare(b.title));
    function canvasContext(canvas) {
      const rect = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
      const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
      return { ctx, width: rect.width, height: rect.height };
    }
    function drawHero() {
      const { ctx, width, height } = canvasContext($('hero-field'));
      const radius = Math.min(width * .56, height * .58), cx = width * .55, cy = height * .48;
      catalogue.forEach((item, i) => {
        const angle = i * 2.3999632297, r = Math.sqrt((i + .5) / catalogue.length) * radius;
        const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r;
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2);
        ctx.fillStyle = item.kind === 'set' ? '#91b7c5' : '#de956f';
        ctx.globalAlpha = story.direct.counts.has(item.id) ? .88 : .38;
        ctx.fillRect(-1.3, -4.3, 2.6, 8.6); ctx.restore();
      });
    }
    function drawShelf() {
      const { ctx, width, height } = canvasContext($('shelf-field'));
      const columns = width < 410 ? 48 : 52, rows = Math.ceil(catalogue.length / columns), dx = width / columns, dy = height / rows;
      shelfGeometry = { columns, dx, dy };
      catalogue.forEach((item, i) => {
        const picked = story.direct.counts.has(item.id), active = shelfMode === 'all' || (shelfMode === 'picked' ? picked : !picked);
        ctx.fillStyle = !active ? '#dedfd4' : shelfMode === 'unpicked' ? '#416e80' : item.kind === 'set' && shelfMode === 'all' ? '#416e80' : '#b14e32';
        ctx.fillRect((i % columns) * dx + 1, Math.floor(i / columns) * dy + 1, Math.max(2, dx - 3), Math.max(3, dy - 2.5));
      });
    }
    function setShelfMode(mode) {
      shelfMode = mode;
      document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      $('shelf-summary').textContent = mode === 'all' ? `${number(catalogue.length)} entries · terracotta film entries · blue box sets` : mode === 'picked' ? `${number(story.selected.length)} entries with a recorded direct choice` : `${number(catalogue.length - story.selected.length)} entries without a recorded direct choice`;
      $('shelf-field').setAttribute('aria-label', $('shelf-summary').textContent + '. Each mark is one catalogue entry.');
      drawShelf();
    }
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setShelfMode(b.dataset.mode)));
    $('shelf-field').addEventListener('click', e => {
      if (!shelfGeometry) return;
      const r = e.currentTarget.getBoundingClientRect(), { columns, dx, dy } = shelfGeometry;
      const col = Math.floor((e.clientX - r.left) / dx), row = Math.floor((e.clientY - r.top) / dy);
      const item = catalogue[row * columns + col]; if (!item || col < 0 || col >= columns || row < 0) return;
      const count = story.direct.counts.get(item.id)?.events.length || 0;
      $('shelf-selection').innerHTML = `<a href="${esc(filmURL(item))}">${esc(item.title)} ↗</a> · ${esc(filmMeta(item))} · ${number(count)} direct visits / lists`;
    });
    if ('IntersectionObserver' in window) {
      const steps = new IntersectionObserver(entries => {
        if (matchMedia('(max-width: 760px)').matches) return;
        entries.forEach(e => { if (e.isIntersecting) setShelfMode(e.target.dataset.shelf); });
      }, { rootMargin: '-30% 0px -40% 0px', threshold: 0 });
      document.querySelectorAll('[data-shelf]').forEach(e => steps.observe(e));
    }
    if ('ResizeObserver' in window) { const observer = new ResizeObserver(() => { drawHero(); drawShelf(); }); observer.observe($('hero-field')); observer.observe($('shelf-field')); }
    else addEventListener('resize', () => { drawHero(); drawShelf(); });
    drawHero(); setShelfMode('all');

    function renderRanking(format = '') {
      const state = model.filmRows({ format, kind: 'film', pickedOnly: true, sort: 'popular' });
      const rows = state.rows.slice(0, 8), leader = rows[0], peak = leader.count;
      $('leader-title').textContent = leader.title;
      $('leader-meta').textContent = filmMeta(leader);
      $('leader-share').innerHTML = (100 * peak / state.denominator).toFixed(1) + '<span>%</span>';
      const unit = format === 'closet' ? 'Closet visits' : format === 'top10' ? 'written lists' : 'visits & lists';
      $('leader-count').textContent = `${number(peak)} of ${number(state.denominator)} ${unit}`;
      $('rank-bars').innerHTML = rows.map(row => `<li><a href="${esc(filmURL(row, { format }))}" aria-label="${esc(row.title)}, selected in ${row.count} of ${state.denominator} ${unit}. Explore choices."><span class="rank-title">${esc(row.title)}<small>${esc(filmMeta(row))}</small></span><strong>${row.count}</strong><span class="rank-track" aria-hidden="true" style="--share:${row.count / peak}"></span></a></li>`).join('');
      $('rank-note').textContent = `Each film entry counts once per event. Box sets and their indirect contents are excluded. ${number(state.denominator)} eligible ${unit}; ties are ordered by title.`;
      $('rank-explore').href = explorer({ view: 'popular', kind: 'film', sort: 'popular', format });
      document.querySelectorAll('[data-format]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.format === format)));
    }
    document.querySelectorAll('[data-format]').forEach(b => b.addEventListener('click', () => renderRanking(b.dataset.format)));
    renderRanking();

    const roles = [['Actor', 'Actors'], ['Director', 'Directors'], ['Writer', 'Writers'], ['Musician', 'Musicians'], ['', 'All events']];
    [...new Set(data.events.flatMap(e => e.roles))].sort().filter(role => !roles.some(r => r[0] === role)).forEach(role => roles.push([role, role]));
    for (const id of ['cohort-a', 'cohort-b']) for (const [value, label] of roles) $(id).add(new Option(label, value));
    $('cohort-a').value = 'Actor'; $('cohort-b').value = 'Director';
    function renderCohorts() {
      const left = $('cohort-a').value, right = $('cohort-b').value, state = story.comparison(left, right);
      const aLabel = $('cohort-a').selectedOptions[0].text, bLabel = $('cohort-b').selectedOptions[0].text;
      $('cohort-a-count').textContent = number(state.a) + ' eligible visits / lists';
      $('cohort-b-count').textContent = number(state.b) + ' eligible visits / lists';
      $('cohort-chart').innerHTML = `<div class="cohort-axis" aria-hidden="true"><span style="left:0">0%</span><span style="left:50%">${state.max / 2}%</span><span style="left:100%">${state.max}%</span></div>` + state.rows.map(row => {
        const a = 100 * row.aShare / state.max, b = 100 * row.bShare / state.max;
        return `<div class="cohort-row"><div class="cohort-film"><a href="${esc(filmURL(row.item))}">${esc(row.item.title)}</a></div><div class="cohort-track" role="img" aria-label="${esc(row.item.title)}: ${esc(aLabel)} ${row.aShare.toFixed(1)} percent (${row.a} of ${state.a}); ${esc(bLabel)} ${row.bShare.toFixed(1)} percent (${row.b} of ${state.b})."><span class="cohort-connector" style="--start:${Math.min(a, b)}%;--distance:${Math.abs(a - b)}%"></span><span class="cohort-mark a" style="--position:${a}%"></span><span class="cohort-mark b" style="--position:${b}%"></span><span class="cohort-value a" aria-hidden="true" style="--position:${Math.max(4, Math.min(96, a))}%">${row.aShare.toFixed(1)}%</span><span class="cohort-value b" aria-hidden="true" style="--position:${Math.max(4, Math.min(96, b))}%">${row.bShare.toFixed(1)}%</span></div></div>`;
      }).join('');
      $('cohort-caption').textContent = `Percent of each group’s eligible visits / lists. Showing the union of each group’s four most directly selected film entries. Circle = ${aLabel.toLowerCase()}; square = ${bLabel.toLowerCase()}. Both use the same percentage scale.`;
      $('cohort-table').innerHTML = `<table><caption>Direct film selections within each group</caption><thead><tr><th scope="col">Film</th><th scope="col">${esc(aLabel)} · ${state.a} events</th><th scope="col">${esc(bLabel)} · ${state.b} events</th></tr></thead><tbody>${state.rows.map(r => `<tr><th scope="row">${esc(r.item.title)}</th><td>${r.a} · ${r.aShare.toFixed(1)}%</td><td>${r.b} · ${r.bShare.toFixed(1)}%</td></tr>`).join('')}</tbody></table>`;
    }
    $('cohort-a').addEventListener('change', renderCohorts); $('cohort-b').addEventListener('change', renderCohorts); renderCohorts();

    const decadeState = story.decades(), maxDecade = Math.ceil(Math.max(...decadeState.bins.map(b => b.total)) / 50) * 50;
    $('decade-chart').innerHTML = decadeState.bins.map(bin => `<button class="decade-bar" data-decade="${bin.year}" aria-pressed="false" aria-label="${bin.year}s: ${bin.total} catalogue film entries, ${bin.picked} with a direct selection, ${bin.total - bin.picked} without. Show leading films."><span class="decade-stack" style="--total:${bin.total / maxDecade};--picked:${100 * bin.picked / bin.total}%"><span class="decade-total">${bin.total}</span><i aria-hidden="true"></i></span><span class="decade-label"><span class="century">${String(bin.year).slice(0, 2)}</span>${String(bin.year).slice(2)}s</span></button>`).join('');
    $('decade-note').textContent = `Catalogue film entries, including shorts, compilations and versions. ${decadeState.unknown} entries have no year and are omitted from the columns; box sets are excluded. Click a decade to step inside.`;
    $('decade-table').innerHTML = `<table><caption>Catalogue film entries by decade</caption><thead><tr><th scope="col">Decade</th><th scope="col">Catalogue entries</th><th scope="col">Directly chosen</th><th scope="col">No direct choice</th></tr></thead><tbody>${decadeState.bins.map(b => `<tr><th scope="row">${b.year}s</th><td>${b.total}</td><td>${b.picked}</td><td>${b.total - b.picked}</td></tr>`).join('')}</tbody></table>`;
    function renderDecade(year) {
      const bin = decadeState.bins.find(b => b.year === Number(year));
      const state = model.filmRows({ kind: 'film', decade: String(year), sort: 'popular', pickedOnly: true }, true);
      $('decade-title').textContent = `The ${year}s.`;
      $('decade-summary').textContent = `${bin.total} catalogue film entries. ${bin.picked} have at least one direct choice in these ${data.events.length} visits and lists.`;
      $('decade-films').innerHTML = '<p class="eyebrow">Most directly picked in this decade</p>' + state.rows.slice(0, 3).map(i => `<a href="${esc(filmURL(i))}"><span>${esc(i.title)}</span><small>${i.count} visits / lists ↗</small></a>`).join('');
      $('decade-explore').href = explorer({ view: 'catalogue', decade: String(year), kind: 'film' });
      document.querySelectorAll('[data-decade]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.decade === String(year))));
    }
    document.querySelectorAll('[data-decade]').forEach(b => b.addEventListener('click', () => renderDecade(b.dataset.decade))); renderDecade(1960);

    const mappedSets = data.items.filter(i => i.kind === 'set' && data.setMembers[i.id]?.length && story.direct.counts.has(i.id)).sort((a, b) => a.title.localeCompare(b.title));
    mappedSets.forEach(i => $('set-select').add(new Option(i.title, i.id)));
    $('set-select').value = 'boxsets:1427';
    let boxOpen = false;
    function toggleBox(open) {
      boxOpen = open; $('open-box').setAttribute('aria-expanded', String(open));
      $('open-box').innerHTML = open ? 'Close the box <span aria-hidden="true">↙</span>' : 'Open the box <span aria-hidden="true">↗</span>';
      document.querySelector('.box-stage').classList.toggle('open', open);
      $('box-contents').hidden = !open; $('box-closed-note').hidden = open;
    }
    function renderBox() {
      const id = $('set-select').value, item = model.items.get(id), impact = story.setImpact(id), count = story.direct.counts.get(id)?.events.length || 0;
      $('box-heading-count').textContent = impact.length === 40 ? 'Forty films.' : `${impact.length} film entries.`;
      $('box-cover-title').textContent = item.title;
      $('box-cover-title').style.fontSize = Math.max(19, Math.min(43, 235 / Math.sqrt(item.title.length))) + 'px';
      $('box-cover-count').textContent = `${impact.length} mapped film entries`;
      $('box-context').textContent = `This set was chosen directly in ${count} of ${data.events.length} visits and lists. ${impact.length} film entries are mapped to its contents.`;
      $('box-spines').innerHTML = impact.map(() => '<i></i>').join('');
      $('box-impact').innerHTML = impact.slice(0, 4).map(r => `<div class="box-impact-row"><a href="${esc(filmURL(r.item))}">${esc(r.item.title)} ↗</a><span aria-label="${r.direct} direct selections">${r.direct}</span><span aria-label="${r.combined} events including this set">${r.combined}</span></div>`).join('');
      $('box-all-label').textContent = `See all ${impact.length} mapped film entries`;
      $('box-all').innerHTML = impact.map(r => `<li><a href="${esc(filmURL(r.item))}">${esc(r.item.title)}</a>${r.item.year ? ' (' + r.item.year + ')' : ''}</li>`).join('');
      toggleBox(boxOpen);
    }
    $('set-select').addEventListener('change', renderBox); $('open-box').addEventListener('click', () => toggleBox(!boxOpen)); renderBox();

    const guests = [...data.events].sort((a, b) => a.name.localeCompare(b.name) || eventDate(b).localeCompare(eventDate(a)));
    guests.forEach(e => $('guest-select').add(new Option(`${e.name} · ${formatName(e)} · ${dateLabel(eventDate(e))}`, e.id)));
    $('guest-select').value = 'closet:1001';
    function renderGuest() {
      const event = model.events.get($('guest-select').value);
      $('guest-format').textContent = formatName(event) + ' · ' + dateLabel(eventDate(event));
      $('guest-name').textContent = event.name;
      $('guest-meta').textContent = (event.group ? 'Joint selection' : event.roles.join(' · ') || 'Profession not recorded') + ' · ' + event.choices.length + ' displayed choices';
      $('guest-source').href = safeURL(event.url).replaceAll('&amp;', '&');
      $('guest-source').textContent = event.format === 'closet' ? 'Visit the original Closet page ↗' : 'Read the original Top 10 ↗';
      $('guest-films').innerHTML = event.choices.map((c, index) => {
        const item = model.items.get(c.item), kind = item.kind === 'set' ? 'Box set' : item.kind === 'other' ? 'Other item' : 'Film entry';
        return `<a class="guest-film" href="${esc(filmURL(item, { person: event.person, format: event.format }))}"><p class="eyebrow">${esc(kind)} · ${event.format === 'top10' && c.rank ? 'Rank ' + esc(c.rank) : 'Entry ' + String(index + 1).padStart(2, '0')}</p><h4>${esc(item.title)}</h4><p>${esc(filmMeta(item) || 'See the source selection')}</p></a>`;
      }).join('');
      $('guest-note').textContent = event.format === 'closet' ? 'Displayed in the source page’s order. These are recorded selections, not a ranked preference list. Box sets remain together.' : 'Printed ranks are preserved where available. “Entry” indicates source order where no separate rank is supplied; grouped or tied choices can extend a Top 10 beyond ten titles.';
      $('guest-explore').href = explorer({ view: event.format === 'closet' ? 'closet' : 'top10', person: event.person });
    }
    $('guest-select').addEventListener('change', renderGuest);
    $('shuffle-guest').addEventListener('click', () => { const current = $('guest-select').selectedIndex; $('guest-select').selectedIndex = (current + 1 + Math.floor(Math.random() * (guests.length - 1))) % guests.length; renderGuest(); });
    renderGuest();
    document.querySelectorAll('fieldset[disabled], select[disabled], button[disabled]').forEach(e => { e.disabled = false; });
    $('load-status').classList.add('loaded');
    document.body.dataset.ready = 'true';
    progress();
  } catch (error) {
    $('load-status').firstChild.textContent = 'The interactive data could not load. You can still open the explorer or download the dataset below. ';
    $('retry').hidden = false;
    document.body.dataset.ready = 'error';
  }
})();
