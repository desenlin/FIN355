#!/usr/bin/env python3
"""Inline the canonical frame into opted-in standalone tools; --check is read-only."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
BLOCK = re.compile(r'<style id="fin355-tool-layout">.*?</style>', re.S)


class Frame(HTMLParser):
    def __init__(self):
        super().__init__()
        self.nodes = []

    def handle_starttag(self, tag, attrs):
        self.nodes.append((tag, dict(attrs)))

    def has(self, tag, classes):
        return any(t == tag and set(classes) <= set(a.get('class', '').split())
                   for t, a in self.nodes)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    css = (ROOT / 'assets/tool-layout.css').read_text().rstrip()
    expected = '<style id="fin355-tool-layout">\n' + css + '\n</style>'
    paths = sorted(ROOT.glob('*.html')) + [ROOT / '_templates/interactive-tool.html']
    failures = []
    count = 0
    for path in paths:
        html = path.read_text()
        frame = Frame()
        frame.feed(html)
        # Older tools migrate explicitly; new tools start with this frame.
        if not frame.has('body', ['tool-page']) and not BLOCK.search(html):
            continue
        count += 1
        rel = path.relative_to(ROOT)
        if len(BLOCK.findall(html)) != 1:
            failures.append(f'{rel}: expected one fin355-tool-layout style block')
            continue
        for tag, classes in [('body', ['tool-page']), ('header', ['hero']),
                             ('div', ['shell', 'hero-inner']), ('main', ['shell']),
                             ('footer', ['shell'])]:
            if not frame.has(tag, classes):
                failures.append(f'{rel}: missing {tag} with classes {classes}')
        if BLOCK.search(html).group() != expected:
            if args.check:
                failures.append(f'{rel}: run python3 _tools/sync_tool_layout.py')
            else:
                path.write_text(BLOCK.sub(lambda _: expected, html))
                print(f'Updated {rel}')
    if not count:
        failures.append('No shared-layout pages found')
    if failures:
        print('\n'.join(failures), file=sys.stderr)
        return 1
    print(f'Shared layout {"checked" if args.check else "synced"}: {count} pages')
    return 0


if __name__ == '__main__':
    sys.exit(main())
