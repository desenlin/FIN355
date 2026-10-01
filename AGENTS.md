# FIN355 interactive tools

- Start new tools from `_templates/interactive-tool.html`; do not copy an older tool's header/footer CSS.
- Keep the full-viewport hero background and one shared 1180px responsive frame for header text, navigation, main content, and footer. Do not add narrower title/description widths or nest `.shell` containers.
- Keep the creator line and centered instructional footer. Scope subject-specific text to the actual tool; do not add chapter labels unless requested.
- `assets/tool-layout.css` owns frame widths. Run `python3 _tools/sync_tool_layout.py` after changing it or adding a tool, then `python3 _tools/sync_tool_layout.py --check`. Its generated inline blocks keep the pages usable offline.
- Preserve analytics, accessibility, and existing tool behavior. Visually check header and footer against the main content at desktop and mobile sizes before publishing.
- Update the README catalog and academic teaching cards when adding a tool.
