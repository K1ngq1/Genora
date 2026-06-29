# Model logos

This directory is reserved for local provider/developer logo assets used by the canvas model picker.

Current UI behavior:

- If a mapped logo file exists, the picker renders it from this local directory.
- If a logo is missing, the picker renders an empty circular placeholder.
- Do not hotlink remote brand assets from the browser.
- Do not add generated or unofficial brand marks.

Run `node scripts/download-model-logos.mjs` after reviewing the source URLs if you want to populate the official assets locally.
