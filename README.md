# Studio Syntropy website

Website for studio-syntropy.com. Open to search engines since 12 November 2026 (`LAUNCH = True` in `build/build.py`).

Fonts are hosted on the site itself in `fonts/` (Fontsource copies of Atkinson Hyperlegible Next, Bricolage Grotesque and Noto Sans TC, SIL Open Font License); the site makes no requests to Google.

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
| `hero-chili-gft.jpg` | Full-screen photo at the top, behind the headline (keep the lower half calm and not too bright) | fills the screen |
| `s-gft-2024-11.jpg` | Story step 1 (November 2024) | 16 : 7 |
| `bed-syn.jpg` | Story step 2 | 3 : 1 |
| `hero-gengfutian-2026-04.jpg` | Story step 3 | very wide, 4.3 : 1 |
| `gft-ba-before.jpg` / `gft-ba-after.jpg` | Story step 4, before/after slider | 16 : 9, same view |
| `bio-bee.jpg` / `bio-moth.jpg` | Story step 5 | 3 : 4 (portrait) |
| `dqm-before.jpg` / `dqm-after.jpg` | Ching Mei's Food Forest, slider | 4 : 3, same view |
| `hda-ba-before.jpg` / `hda-ba-after.jpg` | HDARES, slider | 16 : 9, same view |
| `s-hdares-jian-1.jpg` / `s-hdares-jian-2.jpg` | HDARES, two small photos | 4 : 3 |
| `kira-aerial.jpg` | Malaysia, large photo | 4 : 3 |
| `kira-treeline.jpg` | Malaysia, small photo left | 4 : 3 |
| `kira-design.jpg` | Malaysia, tree line drawing | 4 : 3 (shown whole) |
| `s-bio-mushroom.jpg`, `s-bio-grasshopper.jpg`, `s-bio-pollinators.jpg` | Research, "Life above ground" | 16 : 9 |
| `teach-course.jpg`, `teach-students.jpg`, `ngm-group.jpg`, `teach-guidebook.jpg` | Teaching | 4 : 3 |
| `tobias-field.jpg` | About, portrait | 4 : 3 |
| `blog/…` | Photos inside the blog posts | as in the post |

Rules: every photo appears only once on the home page; before/after pairs are always taken from the same spot and shown with a slider.

## How the site is built

- `src/index.html` is the one source page with English and Chinese side by side.
- `content/blog/` holds the blog posts, one file each (title, date, description, cover photo, then the text).
- `build/build.py` turns these into the published pages: `index.html` (English), `zh/index.html` (Chinese), the Research and Courses & talks pages (`research/`, `teaching/`, each also under `zh/`), `blog/index.html` and one page per post under `blog/`, plus `sitemap.xml` and `robots.txt`.
- In `src/index.html`, sections wrapped in `<!--PAGE:name--> … <!--/PAGE-->` become their own page instead of appearing on the home page.
- New blog post: put the Word or Google Doc in "02_Post materials" and ask Claude to publish it.
- Visitor statistics: Vercel Web Analytics (cookieless, Vercel Pro plan), loaded by a small script at the end of the `<style>` block in `src/index.html`. The same script counts PDF downloads and clicks on links to other sites as custom events ("PDF download", "Outbound link"). The footer Privacy panel describes this; update it if the statistics change.

## Field Days · 田間日

Public page: https://studio-syntropy.com/field-days (and `/zh/field-days`). The main menu and footer link to it as "Join us · 參與"; the home page has the button "Join a field day · 參加田間日" between "Our services" and "Contact". Admin page (Vercel sign-in required): https://studio-syntropy-website-studiosyntropys-projects.vercel.app/admin/field-days

- Page text lives in `src/index.html` (`<!--PAGE:field-days-->` block); the list of days and the application form are built by `js/fd.js` (English and Chinese strings at the top).
- `api/fd.js` is the server part (Vercel Function, Tokyo region). Data is one encrypted file in the private Vercel Blob store `field-days` (Tokyo); fitness and safety answers are kept in separate encrypted files and deleted after the day. Key: environment variable `FD_KEY`. Never change or delete it, or the data cannot be read.
- Admin actions only work on the Vercel-protected address above; on studio-syntropy.com they are refused.
- Day types: learning day, volunteer day (organiser: Tzu Chi University USR Center), paid work (asks for the right to work in Taiwan; applications reviewed), course.
- Places go in order of application; when a confirmed person cancels, the first on the waiting list moves up. Hours count once marked "Attended" on the admin page. Levels: Pioneer (first day), Secondary (10 h), Climax stage (50 h).
- Automatic emails switch on when the environment variables `RESEND_API_KEY`, `FD_FROM` (sender, on a verified domain) and `FD_NOTIFY` (studio address for new applications) are set; until then the admin page offers prefilled email links.

## Media register

- Register page: https://claude.ai/artifact/AGjnAWLRhzq9wdUWUKjkDm (private to Tobias).
- `content/media-origins.json`: where each website file came from (original on the Mac, date taken, source).
- `build/media_register.py` reads the built pages and the origins file and writes `media-register.json` (where each file is used).
- `content/media-thumbs.json`: thumbnail addresses in the register page.
- After every website change Claude runs `build/build.py`, then `build/media_register.py`, and copies the result into the register page.
- Moved or renamed originals: Claude rescans the Mac folders on request (a daily scheduled check is pending approval).

## Held-back research content

The folder `_held` keeps the research data, the strata × succession table and the figures removed on 26 October 2026, until the researchers and institutions agree and the studies are published. It is not part of the published site. Ask Claude to restore a block.

## Logo

`img/v8-horizontal-color.svg` (light pages), `img/v8-horizontal-reversed.svg` (dark mode and footer), `favicon.ico`, `img/v8-favicon.png` and `img/v8-app-icon.png`: logo version 8 "Print", 23 October 2026. Replace them only with files from the same logo set, keeping these names.

## Before launch

- In `build/build.py` set `LAUNCH = True` and rebuild: this removes the noindex tags and opens `robots.txt`.
- Register the site and `sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- Create a Google Business Profile for the studio.
- Connect studio-syntropy.com in Vercel and lift the deployment protection.
