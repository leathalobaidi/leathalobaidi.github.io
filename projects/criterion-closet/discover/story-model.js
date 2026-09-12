(function (root) {
  'use strict';
  function create(data, model) {
    const direct = model.aggregate();
    const catalogue = data.items.filter(i => i.catalogue);
    const selected = catalogue.filter(i => direct.counts.has(i.id));
    function decades() {
      const bins = new Map();
      let unknown = 0;
      for (const item of catalogue.filter(i => i.kind === 'film')) {
        if (!item.year) { unknown++; continue; }
        const year = Math.floor(item.year / 10) * 10;
        if (!bins.has(year)) bins.set(year, { year, total: 0, picked: 0 });
        const bin = bins.get(year); bin.total++;
        if (direct.counts.has(item.id)) bin.picked++;
      }
      return { bins: [...bins.values()].sort((a, b) => a.year - b.year), unknown };
    }
    function setImpact(id) {
      const setEvents = direct.counts.get(id)?.events || [];
      return [...new Set(data.setMembers[id] || [])].map(key => {
        const filmEvents = direct.counts.get(key)?.events || [];
        return { item: model.items.get(key), direct: filmEvents.length, combined: new Set([...filmEvents, ...setEvents]).size };
      }).filter(row => row.item).sort((a, b) => b.combined - a.combined || a.item.title.localeCompare(b.item.title));
    }
    function comparison(left, right) {
      const a = model.filmRows({ role: left, kind: 'film', pickedOnly: true, sort: 'popular' });
      const b = model.filmRows({ role: right, kind: 'film', pickedOnly: true, sort: 'popular' });
      const ids = [...new Set([...a.rows.slice(0, 4), ...b.rows.slice(0, 4)].map(i => i.id))];
      const rows = ids.map(id => {
        const ac = a.counts.get(id)?.events.length || 0, bc = b.counts.get(id)?.events.length || 0;
        return { item: model.items.get(id), a: ac, b: bc, aShare: a.denominator ? 100 * ac / a.denominator : 0, bShare: b.denominator ? 100 * bc / b.denominator : 0 };
      }).sort((x, y) => (y.a + y.b) - (x.a + x.b) || x.item.title.localeCompare(y.item.title));
      const peak = Math.max(1, ...rows.flatMap(r => [r.aShare, r.bShare]));
      return { rows, a: a.denominator, b: b.denominator, max: Math.ceil(peak / 5) * 5 };
    }
    return { direct, catalogue, selected, decades, setImpact, comparison };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
  else root.CriterionStory = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
