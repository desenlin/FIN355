#!/usr/bin/env python3
"""Build the fixed historical quarterly Treasury benchmark and embed it in the explorer."""
import argparse
import csv
import hashlib
import io
import json
import re
from collections import defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=2005-01-01&coed=2024-09-30'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', type=Path, help='Use a previously downloaded FRED DGS10 CSV')
    args = parser.parse_args()
    raw = args.csv.read_bytes() if args.csv else urlopen(URL, timeout=30).read()
    groups = defaultdict(list)
    seen = set()
    for row in csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))):
        day = date.fromisoformat(row['observation_date'])
        if not date(2005, 1, 1) <= day <= date(2024, 9, 30):
            continue
        if day in seen:
            raise ValueError(f'Duplicate Treasury observation: {day}')
        seen.add(day)
        if row['DGS10'] in ('', '.'):
            continue
        groups[f'{day.year} Q{(day.month - 1) // 3 + 1}'].append(Decimal(row['DGS10']))
    page = ROOT / 'cap-rate-explorer.html'
    html = page.read_text()
    block = re.search(r'(<script id="course-data" type="application/json">)(.*?)(</script>)', html, re.S)
    data = json.loads(block.group(2))
    periods = data['periods']
    if set(groups) != set(periods) or any(not 55 <= len(groups[q]) <= 67 for q in periods):
        raise ValueError('Treasury data do not fully cover the explorer quarters')
    benchmark = {
        'series': 'DGS10',
        'label': '10-year Treasury yield',
        'source': 'Board of Governors of the Federal Reserve System (US), H.15; retrieved from FRED, Federal Reserve Bank of St. Louis',
        'url': 'https://fred.stlouisfed.org/series/DGS10',
        'download_url': URL,
        'retrieved': date.today().isoformat(),
        'frequency': 'Quarterly',
        'aggregation': 'Arithmetic mean of available daily observations in each calendar quarter; missing observations omitted, without interpolation.',
        'units': 'Annualized yield as a decimal; not divided by four.',
        'raw_sha256': hashlib.sha256(raw).hexdigest(),
        'periods': periods,
        'observations': [len(groups[q]) for q in periods],
        'rates': [float(sum(groups[q]) / len(groups[q]) / 100) for q in periods],
    }
    target = ROOT / '_data/treasury-10y-quarterly.json'
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(benchmark, indent=2) + '\n')
    data['treasury'] = benchmark
    page.write_text(html[:block.start(2)] + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + html[block.end(2):])
    print(f'Embedded {len(periods)} quarterly yields, {sum(benchmark["observations"])} daily observations.')


if __name__ == '__main__':
    main()
