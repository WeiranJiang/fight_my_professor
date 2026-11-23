"""Build a stable, minimal school registry from the NCES IPEDS HD2024 ZIP."""
import argparse
import csv
import io
import json
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZipFile

US_REGIONS = frozenset("""
AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS
MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY
AS GU MP PR VI
""".split())

def directory_url(raw, unit):
    candidate = raw.strip()
    if candidate and '://' not in candidate:
        candidate = 'https://' + candidate
    try:
        parsed = urlsplit(candidate)
        if parsed.scheme in ('http', 'https') and parsed.hostname and '.' in parsed.hostname:
            if not parsed.username and not parsed.password and not any(c.isspace() for c in candidate):
                return parsed._replace(scheme='https').geturl()
    except ValueError:
        pass
    return f'https://nces.ed.gov/collegenavigator/?id={unit}'


def load_records(archive):
    with ZipFile(archive) as source:
        csv_file = next(name for name in source.namelist() if name.lower().endswith('.csv'))
        content = source.read(csv_file).decode('utf-8-sig')
    rows = []
    for row in csv.DictReader(io.StringIO(content)):
        if row['STABBR'] not in US_REGIONS or row['CYACTIVE'] != '1' or row['POSTSEC'] != '1':
            continue
        if row['SECTOR'] == '0' or row['CLOSEDAT'].strip() != '-2':
            continue
        unit = int(row['UNITID'])
        aliases = list(dict.fromkeys(x.strip() for x in row['IALIAS'].split('|') if x.strip()))
        rows.append([
            unit, row['INSTNM'].strip(), row['CITY'].strip(), row['STABBR'],
            directory_url(row['WEBADDR'], unit), int(row['ICLEVEL']), aliases[:12],
        ])
    return sorted(rows, key=lambda row:row[0])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    records = load_records(args.archive)
    with args.output.open('w', encoding='utf-8') as output:
        output.write('[\n')
        output.write(',\n'.join('  ' + json.dumps(row, ensure_ascii=False, separators=(',', ':')) for row in records))
        output.write('\n]\n')
    print(f'{len(records)} active U.S. postsecondary institutions')
