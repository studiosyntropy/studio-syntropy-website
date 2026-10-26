# Studio Syntropy website

Website for studio-syntropy.com. This is the test version: search engines are told not to list it (robots noindex) until launch.

Every change saved to this repository is published to Vercel automatically within about a minute.

## Replacing a photo

1. **Prepare the photo.** JPG, landscape, 1600–2000 px wide, under about 500 KB.
   On a Mac: open it in Preview → Tools → Adjust Size (width 1800 px) → File → Export → JPEG, quality about 80 %.
2. **Rename it** to exactly the file name in the table below (lower case, same ending `.jpg`).
3. **Upload it.** On GitHub open this repository → folder `img` → **Add file** → **Upload files** → drag the photo in → **Commit changes**.
   A file with the same name replaces the old photo.
4. **Check it.** After about a minute, reload the test address in your browser.

The page crops each photo to the shape in the table, keeping the centre, so keep the main subject near the middle.
For the before/after pairs, both photos must be taken from the same spot with the same framing.
If the new photo shows something else (another place, another date), ask Claude to update its caption and its description for screen readers.

| File in `img/` | Where on the page | Shape on the page |
|---|---|---|
| `hero-chili-gft.jpg` | Large photo at the top | 2 : 1 (4 : 3 on phones) |
| `s-gft-2024-11.jpg` | Story step 1, story slider (before), blog card | 16 : 7 |
| `s-gft-2026-05.jpg` | Story slider (after), first blog card | 16 : 7 |
| `dqm-before.jpg` | Ching Mei's Food Forest, before (slider) | 4 : 3 |
| `dqm-after.jpg` | Ching Mei's Food Forest, after (slider) | 4 : 3 |
| `hdares-alley.jpg` | HDARES, large photo | 16 : 9 |
| `s-hdares-jian-1.jpg` | HDARES, small photo left | 4 : 3 |
| `s-hdares-jian-2.jpg` | HDARES, small photo right | 4 : 3 |
| `ngm-before-after.jpg` | Malaysia, Noble Gateway before/after image | 16 : 9 |
| `kira-aerial.jpg` | Malaysia, Kira Organic Farm photo | 4 : 3 |
| `kira-design.jpg` | Malaysia, Kira tree line drawing | 4 : 3 (shown whole, white background) |
| `bed-mono.jpg` | Research, control bed | 3 : 1 |
| `bed-syn.jpg` | Research, syntropic bed; story step 2 | 3 : 1 |
| `roots.jpg` | Research root photo; story step 3 | shown whole |
| `s-bio-mushroom.jpg` | Research, "Life above ground", left | 16 : 9 |
| `s-bio-grasshopper.jpg` | Research, "Life above ground", middle | 16 : 9 |
| `s-bio-pollinators.jpg` | Research "Life above ground" right; story step 5 | 16 : 9 |
| `teach-course.jpg` | Teaching, photo 1 | 4 : 3 |
| `teach-students.jpg` | Teaching, photo 2 | 4 : 3 |
| `ngm-group.jpg` | Teaching photo 3; third blog card | 4 : 3 |
| `teach-guidebook.jpg` | Teaching, photo 4 | 4 : 3 |
| `tobias-field.jpg` | About, portrait | 4 : 3 |

## Logo

`img/v8-horizontal-color.svg` (light pages), `img/v8-horizontal-reversed.svg` (dark mode and footer), `favicon.ico`, `img/v8-favicon.png` and `img/v8-app-icon.png`: logo version 8 "Print", 23 October 2026. Replace them only with files from the same logo set, keeping these names.

## Before launch

- Remove `<meta name="robots" content="noindex, nofollow">` from `index.html` and the `Disallow: /` line from `robots.txt`.
- Connect studio-syntropy.com in Vercel and lift the deployment protection.
