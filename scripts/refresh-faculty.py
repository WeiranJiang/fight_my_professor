"""Download official rosters and build a candidate without replacing published data."""
import argparse
import concurrent.futures
import importlib.util
import json
import tempfile
import time
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'faculty_snapshot', ROOT / 'scripts' / 'build-faculty-snapshot.py'
)
snapshot = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(snapshot)

PAGES = {
    'stanford': ('?page=', 4),
    'cmu': ('?page=', 6),
    'cornell': ('?page=', 8),
    'harvard': ('?page=%2C', 6),
}


def download_source(source, url, folder):
    query, count = PAGES.get(source, ('', 1))
    for page in range(count):
        address = url + query + str(page) if page else url
        name = f'{source}-page{page}.html' if page else f'{source}.html'
        request = Request(address, headers={'User-Agent': 'FightMyProfessor-FacultyDirectory/1.0'})
        try:
            with urlopen(request, timeout=15) as response:
                parsed = urlsplit(response.url)
                if parsed.scheme != 'https' or not (parsed.hostname or '').endswith('.edu'):
                    raise ValueError('unexpected redirect')
                data = response.read(5_000_001)
                if len(data) > 5_000_000:
                    raise ValueError('response exceeded 5 MB')
            (folder / name).write_bytes(data)
        except (OSError, ValueError) as error:
            print(f'{source}, page {page + 1}: {error}')
        if page + 1 < count:
            time.sleep(0.5)


def read_records(file):
    return {record['id']: record for record in json.loads(file.read_text())}


def refresh(output):
    published = ROOT / 'data-source' / 'faculty.json'
    if output.resolve() == published.resolve():
        raise SystemExit('Choose a separate path for the candidate snapshot.')
    with tempfile.TemporaryDirectory(prefix='fmp-faculty-') as work:
        folder = Path(work)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            fetches = [
                pool.submit(download_source, source, values[0], folder)
                for source, values in snapshot.spec.items()
            ]
            for fetch in fetches:
                fetch.result()
        extracted = folder / 'candidate.json'
        snapshot.build_snapshot(folder, extracted)
        previous, found = read_records(published), read_records(extracted)

    if len(found) < len(previous) * 0.7:
        raise SystemExit('Too few profiles matched the source HTML. Inspect the source errors and selectors.')
    missing = previous.keys() - found.keys()
    added = found.keys() - previous.keys()
    changed = sum(found[key] != previous[key] for key in found.keys() & previous.keys())
    records = sorted((previous | found).values(), key=lambda row: (row['school'], row['name'].casefold()))
    output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(added)} added, {changed} updated, {len(missing)} retained for manual review.')
    print(f'To review the candidate, compare {published.relative_to(ROOT)} with {output}.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    refresh(parser.parse_args().output)
