# U.S. institution directory

`schools.json` is generated from the [IPEDS HD2024 directory file](https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip). It contains 5,875 active U.S. postsecondary institutions in the 50 states, D.C., and U.S. territories present in the dataset. The importer excludes administrative offices and institutions with recorded closure dates. The file stores names, cities, states or territories, institutional links, institution level, and public name aliases. The legacy 20 school IDs are mapped to their federal UNITIDs so existing URLs and faculty records remain valid.

```sh
python scripts/build-school-snapshot.py /path/to/HD2024.zip /tmp/schools-candidate.json
```

Compare the candidate to `data-source/schools.json` before replacing the published snapshot. Schools can accept verified faculty submissions even when the faculty dataset has no rows for them.

# Faculty directory snapshot

The November 23, 2026 snapshot contains 2,182 records across 41 institutions in the game. It covers selected departments, primarily computing, with additional mathematics, economics, and English listings. Schools are the existing game directory, with no ranking order implied.

Each record stores a publicly listed name, school, department, appointment title when available, research areas when listed, and the official source URL. The snapshot excludes personal contact fields and game scores. An unrated fighter starts at the game's neutral baseline.

The snapshot draws from official department rosters. Examples include [Princeton Computer Science](https://www.cs.princeton.edu/people/faculty), [MIT EECS](https://www.eecs.mit.edu/role/faculty/), [Penn Mathematics](https://www.math.upenn.edu/people/standing-faculty), and [Columbia Economics](https://econ.columbia.edu/faculty/). Some schools use manually checked entries where their public listing is dynamic or unavailable to the importer.

## Refresh and review

Use Python 3.10 or newer in an isolated environment with Beautiful Soup 4 installed.

```sh
python scripts/refresh-faculty.py --output /tmp/faculty-candidate.json
```

The command downloads the configured official pages, follows the configured pagination, and writes a separate candidate. A missing row stays in the candidate for manual review because a site may be unavailable or change its HTML. Review the diff against `data-source/faculty.json`, verify new and changed appointments, then replace the snapshot and bump the seed revision in `backend/d1.mjs`. Run `npm test` before publishing. Hosted inserts preserve existing records and ratings. Review departures or inaccurate data through moderation.

For offline troubleshooting, save the roster files with their source keys (for example `princeton.html` or `stanford-page1.html`) and run:

```sh
python scripts/build-faculty-snapshot.py /path/to/snapshots /tmp/faculty-candidate.json
```
