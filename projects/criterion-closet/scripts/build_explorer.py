#!/usr/bin/env python3
"""Build the static explorer from acquired source tables and official Closet pages.

Usage: python3 build_explorer.py source.sqlite official-closet-pages.json output-dir
No network requests. Original downloads remain the reproducible evidence layer.
"""
import collections
import csv
import hashlib
import json
import re
import sqlite3
import sys
import unicodedata
import zipfile
from datetime import datetime
from pathlib import Path


def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value or '').lower() if c.isalnum())


def criterion_key(url):
    match = re.search(r'criterion\.com/(films|boxsets)/(\d+)', url or '')
    return ':'.join(match.groups()) if match else None


def person_name(title):
    title = re.sub(r'\s*(?:\(\d{4}\)|\d{4})$', '', title).replace('\u200b', '')
    return re.sub(r"(?:[’']s|[’'])?\s+(?:Mobile\s+)?(?:Closet Picks|Top\s*(?:10|Ten))$", '', title, flags=re.I).strip()


ROLE_GROUPS = {
    'Actor': 'actor actors actress actresses',
    'Director': 'director directors documentarian documentarians filmmaker filmmakers',
    'Writer': 'writer writers author authors novelist novelists playwright playwrights screenwriter screenwriters essayists tv-writer',
    'Musician': 'musician musicians singer songwriter composer composers singer-songwriter',
    'Producer': 'producer producers',
    'Comedian': 'comedian comedians',
    'Cinematographer': 'cinematographer cinematographers',
    'Editor': 'editor editors magazine-editors',
    'Critic / journalist': 'critic critics journalist journalists historian historians',
    'Artist / designer': 'artist artists visual-artists designer designers fashion-designers costume-designers photographer photographers animator animators',
    'Host / presenter': 'host tv-host podcaster podcasters youtuber youtubers',
    'Other': 'other philosopher philosophers professors theorists ceos executives models dancers choreographers drag-performer video-game-creator festival-organizers',
}
ROLE_MAP = {token: group for group, tokens in ROLE_GROUPS.items() for token in tokens.split()}


def source_roles(value):
    return sorted({ROLE_MAP[x] for x in re.split(r'[;,\s]+', value or '') if x in ROLE_MAP})


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')


def write_csv(path, rows, fields=None):
    fields = fields or list(rows[0])
    with path.open('w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=fields, quoting=csv.QUOTE_ALL, lineterminator='\n')
        writer.writeheader()
        for row in rows:
            writer.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v for k, v in row.items()})


def build(database, closet_path, output):
    output.mkdir(parents=True, exist_ok=True)
    archive_dir = output / 'sources'
    archive_dir.mkdir(exist_ok=True)
    conn = sqlite3.connect(database)
    conn.row_factory = sqlite3.Row
    tables = {r[0]: [dict(x) for x in conn.execute('SELECT * FROM "' + r[0] + '"')] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'explorer_%' AND name != 'official_closet_choices'").fetchall()}
    closet_pages = json.loads(closet_path.read_text())['pages']
    written_meta_path = closet_path.with_name('written-guest-metadata.json')
    written_meta = json.loads(written_meta_path.read_text())['pages'] if written_meta_path.exists() else []
    assert len(closet_pages) == 410 and all(x['picks'] for x in closet_pages)
    assert {str(p['criterion_collection_id']) for p in closet_pages} == {r['criterion_collection_id'] for r in tables['closet_visit_index']}

    items = {}
    def add_item(url, title, director='', year=None, **extra):
        key = criterion_key(url)
        if not key:
            key = 'unresolved:' + hashlib.sha256((url + title).encode()).hexdigest()[:14]
        if key not in items:
            items[key] = dict(id=key, title=title, director=director, year=year, country='', spine='', url=url,
                              kind='set' if key.startswith('boxsets:') else 'film' if key.startswith('films:') else 'other', catalogue=False,
                              imdb='', letterboxd='', cast=[], writers=[], genres=[])
        item = items[key]
        for field, value in dict(title=title, director=director, year=year, **extra).items():
            if value not in ('', None, []):
                if field not in ('title', 'director') or not item['catalogue']:
                    item[field] = value
        return key

    for row in tables['catalogue']:
        add_item(row['criterion_url'], row['title'], row['director'], int(row['year']) if str(row['year']).isdigit() else None,
                 country=row['country'], spine=row['spine'], catalogue=True)
    for row in tables['baronia_film_observations']:
        add_item(row['criterionUrl'], row['title'], row['director'], row['year'])
    for row in tables['westen_films']:
        key = criterion_key(row['criterion_url'])
        if key in items:
            credits = json.loads(row['credits'] or '{}')
            genres = row['genres'] or []
            if isinstance(genres, str):
                try: genres = json.loads(genres)
                except ValueError: genres = [genres]
            items[key].update(imdb=row['imdb_url'] or '', letterboxd=row['letterboxd_url'] or '',
                              cast=[x['name'] for x in credits.get('cast', [])], writers=[x['name'] for x in credits.get('writers', [])], genres=genres)

    roles_by_name = collections.defaultdict(set)
    role_sources = collections.defaultdict(set)
    group_names = set()
    for row in tables['legacy_guests']:
        name_key = norm(row['name'])
        if row['is_group']:
            group_names.add(name_key)
            continue
        roles_by_name[name_key].update(source_roles(row['occupations']))
        if row['occupations']: role_sources[name_key].add(row['list_url'])
    for row in tables['westen_guests']:
        name_key = norm(row['name'])
        if name_key not in group_names:
            roles_by_name[name_key].update(source_roles(row['profession']))
            role_sources[name_key].add(row['criterion_page_url'] or 'https://closetpicks.westenb.org/llm-export/')

    written_dates = {}
    for meta in written_meta:
        nk = norm(person_name(meta['title']))
        first_sentence = re.split(r'(?<=[.!?])\s+(?=[A-Z])', meta.get('biography', ''), maxsplit=1)[0]
        prefix = re.split(r'\b(?:whose|who|known|including|such as)\b', first_sentence, maxsplit=1, flags=re.I)[0]
        mentioned_roles = meta.get('sourced_roles') or sorted({ROLE_MAP[token.lower()] for token in re.findall(r'[\w]+', prefix) if token.lower() in ROLE_MAP and token.lower() != 'other'})
        meta['sourced_roles'] = mentioned_roles
        if mentioned_roles:
            roles_by_name[nk].update(mentioned_roles)
            role_sources[nk].add(meta['url'])
        try: written_dates[meta['url']] = datetime.strptime(meta.get('published_date',''), '%b %d, %Y').strftime('%Y-%m-%d')
        except ValueError: pass

    overrides_path = Path(__file__).with_name('role-overrides.json')
    overrides = json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
    for nk, correction in overrides.items():
        roles_by_name[nk].update(correction['roles'])
        role_sources[nk].update(correction['sources'])
    group_names.update({'fivecomics','daniels','beak','mogwai','sonicyouth'})

    video_by_id = {str(row['collectionId']): row for row in tables['baronia_visit_metadata']}
    expanded = collections.defaultdict(set)
    for row in tables['baronia_film_observations']:
        expanded[(str(row['collectionId']), norm(row['pickedAs']))].add(criterion_key(row['criterionUrl']))
    set_members = collections.defaultdict(set)
    events = []
    for page in closet_pages:
        cid = str(page['criterion_collection_id'])
        metadata = video_by_id.get(cid, {})
        name = person_name(page['name'])
        if cid == '638':
            # Criterion's title has a stray final s. The band identifies Ben Gibbard:
            # https://deathcabforcutie.bandcamp.com/music
            name = 'Ben Gibbard'
        name_key = norm(name)
        group = name_key in group_names or name_key == 'daniels' or bool(re.search(r'\band\b| & |Brothers|Sisters|Sparks|Rodarte', name, re.I))
        if name_key == 'ironandwine': group = False
        role_set = set(roles_by_name[name_key])
        intro = re.split(r'\b(?:selects|shares|talks|discusses|stops|visits|celebrates|chooses|praises|reflects|recalls|recommends|takes|picks|introduces|known|behind|of|who|whose|joins|returns)\b', page.get('description', ''), maxsplit=1, flags=re.I)[0]
        intro_roles = set(page.get('intro_roles') or [ROLE_MAP[token.lower()] for token in re.findall(r'[\w-]+', intro[:130]) if token.lower() in ROLE_MAP and token.lower() != 'other'])
        page['intro_roles'] = sorted(intro_roles)
        if not group and intro_roles:
            role_set.update(intro_roles)
            roles_by_name[name_key].update(intro_roles)
            role_sources[name_key].add(page['url'])
        date = metadata.get('recordedOn') or ''
        if not date and page['recorded_date']:
            try: date = datetime.strptime(page['recorded_date'], '%b %d, %Y').strftime('%Y-%m-%d')
            except ValueError: pass
        event = dict(id='closet:' + cid, format='closet', title=page['name'], name=name, person= name_key,
                     group=group, roles=sorted(role_set) if not group else [], roleSources=sorted(role_sources[name_key]),
                     recorded=date, published=metadata.get('publishedOn') or '', url=page['url'], video=metadata.get('url') or '', choices=[])
        for pick in page['picks']:
            observed_key = criterion_key(pick['criterion_url'])
            if re.match(r'^(?:Available|Released) [A-Z][a-z]{2} \d', pick['title']) and observed_key in items:
                pick['source_title_label'] = pick['title']
                pick['title'] = items[observed_key]['title']
                pick['title_resolution'] = 'Official catalogue title matched by namespaced Criterion ID; source figure began with an availability label.'
            key = add_item(pick['criterion_url'], pick['title'], pick['director'])
            members = (expanded[(cid, norm(items[key]['title']))] | expanded[(cid, norm(pick['title']))]) - {key, None}
            if items[key]['kind'] == 'set': set_members[key].update(members)
            event['choices'].append(dict(item=key, position=pick['list_position'], rank='', source=page['url']))
        events.append(event)

    written = collections.defaultdict(list)
    for row in tables['official_written_choices']: written[row['criterion_list_id']].append(row)
    for row in tables['written_list_index']:
        name = person_name(row['title'])
        nk = norm(name)
        group = nk in group_names or bool(re.search(r'\band\b| & |Brothers|Sisters|Sparks|Rodarte', name, re.I))
        if nk == 'ironandwine': group = False
        event = dict(id='top10:' + row['criterion_list_id'], format='top10', title=row['title'], name=name, person=nk,
                     group=group, roles=sorted(roles_by_name[nk]) if not group else [], roleSources=sorted(role_sources[nk]),
                     recorded='', published=written_dates.get(row['url'],''), url=row['url'], video='', choices=[])
        for pick in sorted(written[row['criterion_list_id']], key=lambda p: p['list_position']):
            key = add_item(pick['criterion_url'], pick['title'], pick['director'])
            event['choices'].append(dict(item=key, position=pick['list_position'], rank=pick['published_rank'] or '', source=row['url']))
        events.append(event)

    # A directly selected release has one event vote, regardless of mirrored sources.
    for event in events:
        for choice in event['choices']:
            assert choice['item'] in items
    assert len(events) == len({e['id'] for e in events}) == 682
    assert sum(i['catalogue'] for i in items.values()) == 1872
    assert sum(len(e['choices']) for e in events if e['format'] == 'top10') == 3075

    source_inventory = []
    forbidden = {'imdb_rating', 'imdb_votes', 'lb_rating', 'lb_rating_count', 'gender', 'lgbtq', 'quote', 'poster_url', 'poster', 'pickerImages'}
    clean_db = output / 'criterion-public-sources.sqlite'
    if clean_db.exists(): clean_db.unlink()
    public_conn = sqlite3.connect(clean_db)
    for name, rows in sorted(tables.items()):
        fields = [f for f in rows[0] if f not in forbidden]
        clean = [{f: r[f] for f in fields} for r in rows]
        write_json(archive_dir / (name + '.json'), clean)
        write_csv(archive_dir / (name + '.csv'), clean, fields)
        public_conn.execute('CREATE TABLE "' + name + '" (' + ','.join('"' + f + '"' for f in fields) + ')')
        public_conn.executemany('INSERT INTO "' + name + '" VALUES (' + ','.join('?' for _ in fields) + ')', [list(r.values()) for r in clean])
        source_inventory.append(dict(id=name, count=len(clean), fields=fields))
    primary_rows = [dict(event_id=e['id'], event_title=e['title'], criterion_url=items[p['item']]['url'], title=items[p['item']]['title'], position=p['position'], source=e['url']) for e in events if e['format']=='closet' for p in e['choices']]
    write_csv(archive_dir / 'official_closet_choices.csv', primary_rows)
    write_json(archive_dir / 'official_closet_choices.json', primary_rows)
    fields=list(primary_rows[0])
    public_conn.execute('CREATE TABLE official_closet_choices (' + ','.join('"'+f+'"' for f in fields) + ')')
    public_conn.executemany('INSERT INTO official_closet_choices VALUES (?,?,?,?,?,?)', [list(r.values()) for r in primary_rows])
    source_inventory.append(dict(id='official_closet_choices',count=len(primary_rows),fields=fields))
    public_conn.commit()
    assert public_conn.execute('PRAGMA quick_check').fetchone()[0] == 'ok'
    public_conn.close()

    bundle = dict(version='2026-09-12', items=list(items.values()), events=events,
                  setMembers={k:sorted(v) for k,v in set_members.items()}, sourceTables=source_inventory,
                  counts=dict(catalogue=1872, films=1718, sets=154, closet=410, top10=272,
                              closetChoices=sum(len(e['choices']) for e in events if e['format']=='closet'), top10Choices=3075),
                  coverage=dict(rolesKnown=sum(bool(e['roles']) for e in events if not e['group']), soloEvents=sum(not e['group'] for e in events),
                                groupEvents=sum(e['group'] for e in events), boxsetsWithMappedContents=sum(bool(v) for v in set_members.values())))
    write_json(output / 'explorer-data.json', bundle)
    write_json(output / 'official-closet-pages.json', {'retrieved_at':'2026-09-12','pages':[{k:v for k,v in p.items() if k not in ('description','error')} for p in closet_pages]})
    write_json(output / 'written-guest-metadata.json', {'retrieved_at':'2026-09-12','pages':[{k:v for k,v in p.items() if k!='biography'} for p in written_meta]})
    write_csv(output / 'catalogue.csv', [i for i in items.values() if i['catalogue']])
    write_csv(output / 'events.csv', [{k:v for k,v in e.items() if k!='choices'} for e in events])
    choices=[dict(event_id=e['id'], item_id=p['item'], title=items[p['item']]['title'], format=e['format'], selector=e['name'], position=p['position'], rank=p['rank'], source=p['source']) for e in events for p in e['choices']]
    write_csv(output / 'choices.csv', choices)
    curated = sqlite3.connect(clean_db)
    curated.execute('PRAGMA foreign_keys=ON')
    curated.execute('CREATE TABLE explorer_items (id TEXT PRIMARY KEY, title TEXT, director TEXT, year INTEGER, country TEXT, spine TEXT, kind TEXT, catalogue INTEGER, criterion_url TEXT, imdb_url TEXT, letterboxd_url TEXT)')
    curated.executemany('INSERT INTO explorer_items VALUES (?,?,?,?,?,?,?,?,?,?,?)',[(i['id'],i['title'],i['director'],i['year'],i['country'],i['spine'],i['kind'],int(i['catalogue']),i['url'],i['imdb'],i['letterboxd']) for i in items.values()])
    curated.execute('CREATE TABLE explorer_events (id TEXT PRIMARY KEY, format TEXT, name TEXT, title TEXT, person_key TEXT, is_group INTEGER, roles_json TEXT, role_sources_json TEXT, recorded_date TEXT, published_date TEXT, criterion_url TEXT, video_url TEXT)')
    curated.executemany('INSERT INTO explorer_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[(e['id'],e['format'],e['name'],e['title'],e['person'],int(e['group']),json.dumps(e['roles']),json.dumps(e['roleSources']),e['recorded'],e['published'],e['url'],e['video']) for e in events])
    curated.execute('CREATE TABLE explorer_choices (event_id TEXT REFERENCES explorer_events(id), item_id TEXT REFERENCES explorer_items(id), position INTEGER, published_rank TEXT, source_url TEXT, PRIMARY KEY(event_id,position))')
    curated.executemany('INSERT INTO explorer_choices VALUES (?,?,?,?,?)',[(e['id'],p['item'],p['position'],p['rank'],p['source']) for e in events for p in e['choices']])
    curated.execute('CREATE TABLE explorer_set_members (set_id TEXT REFERENCES explorer_items(id), item_id TEXT REFERENCES explorer_items(id), PRIMARY KEY(set_id,item_id))')
    curated.executemany('INSERT INTO explorer_set_members VALUES (?,?)',[(k,v) for k,values in set_members.items() for v in sorted(values)])
    curated.commit()
    assert not curated.execute('PRAGMA foreign_key_check').fetchall()
    curated.close()
    write_json(output / 'role-reviews.json', overrides)
    print(json.dumps(dict(counts=bundle['counts'],coverage=bundle['coverage'],items=len(items),choices=len(choices)),indent=2))
    conn.close()


if __name__ == '__main__':
    build(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
