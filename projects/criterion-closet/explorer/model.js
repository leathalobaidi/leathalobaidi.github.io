(function (root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '');
  const includes = (value, query) => normalize(value).includes(normalize(query));
  function create(data) {
    const items = new Map(data.items.map(item => [item.id, item]));
    const events = new Map(data.events.map(event => [event.id, event]));
    function eligibleEvents(filters = {}) {
      return data.events.filter(event =>
        (!filters.format || event.format === filters.format) &&
        (!filters.person || event.person === filters.person) &&
        (!filters.role || (filters.role === 'Unknown' ? !event.group && !event.roles.length : filters.role === 'Joint' ? event.group : !event.group && event.roles.includes(filters.role)))
      );
    }
    function aggregate(filters = {}) {
      const selected = eligibleEvents(filters);
      const counts = new Map();
      for (const event of selected) {
        const reached = new Map();
        for (const choice of event.choices) {
          reached.set(choice.item, 'direct');
          if (filters.expand) for (const member of data.setMembers[choice.item] || []) {
            if (!reached.has(member)) reached.set(member, 'indirect');
          }
        }
        for (const [id, kind] of reached) {
          if (!counts.has(id)) counts.set(id, { events: [], selectors: new Set(), direct: 0, indirect: 0 });
          const count = counts.get(id);
          count.events.push(event.id);
          count.selectors.add(event.group ? 'joint:' + event.person : event.person);
          count[kind]++;
        }
      }
      return { selected, counts, denominator: filters.unit === 'selectors' ? new Set(selected.map(e => (e.group ? 'joint:' : '') + e.person)).size : selected.length };
    }
    function itemMatches(item, filters) {
      return (!filters.kind || item.kind === filters.kind) &&
        (!filters.director || item.director === filters.director) &&
        (!filters.country || item.country === filters.country) &&
        (!filters.decade || (item.year && Math.floor(Number(item.year) / 10) * 10 === Number(filters.decade)));
    }
    function filmRows(filters = {}, catalogueOnly = false) {
      const state = aggregate(filters);
      const rows = data.items.filter(item => {
        if (catalogueOnly && !item.catalogue) return false;
        if (filters.pickedOnly && !filters.kind && item.kind === 'other') return false;
        if (!itemMatches(item, filters)) return false;
        const count = state.counts.get(item.id);
        if ((filters.role || filters.person || filters.format || filters.pickedOnly) && !count) return false;
        if (!filters.q) return true;
        return includes([item.title, item.director, item.year, item.country, item.spine, ...item.cast, ...item.writers].join(' '), filters.q) ||
          (count && count.events.some(id => includes(events.get(id).name, filters.q)));
      }).map(item => {
        const count = state.counts.get(item.id) || { events: [], selectors: new Set(), direct: 0, indirect: 0 };
        return { ...item, ...count, count: filters.unit === 'selectors' ? count.selectors.size : count.events.length };
      });
      const sort = filters.sort || 'title';
      rows.sort((a, b) => (sort === 'popular' ? b.count - a.count : sort === 'year-new' ? (b.year || 0) - (a.year || 0) : sort === 'year-old' ? (a.year || 9999) - (b.year || 9999) : sort === 'spine' ? (Number(a.spine) || 99999) - (Number(b.spine) || 99999) : 0) || a.title.localeCompare(b.title));
      return { rows, ...state };
    }
    function eventRows(filters = {}) {
      const result = eligibleEvents(filters).filter(event => {
        const relevant = event.choices.map(choice => items.get(choice.item)).filter(Boolean).filter(item => itemMatches(item, filters));
        if ((filters.kind || filters.director || filters.country || filters.decade) && !relevant.length) return false;
        return !filters.q || includes(event.name, filters.q) || relevant.some(item => includes(item.title + ' ' + item.director, filters.q));
      });
      result.sort((a, b) => filters.sort === 'title' ? a.name.localeCompare(b.name) : filters.sort === 'popular' ? b.choices.length - a.choices.length || a.name.localeCompare(b.name) : (b.recorded || b.published || '').localeCompare(a.recorded || a.published || '') || a.name.localeCompare(b.name));
      return result;
    }
    return { items, events, eligibleEvents, aggregate, filmRows, eventRows };
  }
  const api = { create, normalize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CriterionModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
