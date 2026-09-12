const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../explorer/data/explorer-data.json');
const Model = require('../explorer/model.js');
const Story = require('../discover/story-model.js');
const model = Model.create(data), story = Story.create(data, model);

test('the story mosaic and decade columns reconcile to the complete catalogue', () => {
  assert.equal(story.catalogue.length, 1872);
  assert.equal(story.selected.length, 1199);
  const decades = story.decades();
  assert.equal(decades.unknown, 8);
  assert.equal(decades.bins.reduce((sum, b) => sum + b.total, decades.unknown), 1718);
  const knownPickedFilms = story.selected.filter(i => i.kind === 'film' && i.year).length;
  assert.equal(decades.bins.reduce((sum, b) => sum + b.picked, 0), knownPickedFilms);
  assert.ok(decades.bins.every(b => b.picked <= b.total));
});

test('professional comparisons keep cohort denominators and all-event coverage distinct', () => {
  const actorsAndDirectors = story.comparison('Actor', 'Director');
  assert.equal(actorsAndDirectors.a, 230);
  assert.equal(actorsAndDirectors.b, 352);
  const film = actorsAndDirectors.rows.find(r => r.item.title === 'Do the Right Thing');
  assert.equal(film.a, 18);
  assert.equal(film.aShare, 100 * 18 / 230);
  const musiciansAndEveryone = story.comparison('Musician', '');
  assert.equal(musiciansAndEveryone.a, 70);
  assert.equal(musiciansAndEveryone.b, 682);
  assert.ok(musiciansAndEveryone.rows.every(r => r.aShare <= musiciansAndEveryone.max && r.bShare <= musiciansAndEveryone.max));
});

test('opening a particular box unions events and does not expand other sets', () => {
  const id = 'boxsets:1427';
  const impact = story.setImpact(id);
  assert.equal(impact.length, 40);
  for (const row of impact) {
    const independentlyCounted = data.events.filter(e => e.choices.some(c => c.item === row.item.id || c.item === id)).length;
    assert.equal(row.combined, independentlyCounted);
    assert.ok(row.combined >= row.direct);
  }
  const monika = impact.find(r => r.item.title === 'Summer with Monika');
  assert.equal(monika.direct, 4);
  assert.equal(monika.combined, 15); // One event chose both the film and this set.
  assert.notEqual(monika.combined, monika.direct + 12);
});
