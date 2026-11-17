# Habesha Exam Center

A static website (no server needed) for exam practice, mock exams and learning materials.
**Publish the `site/` folder.** Everything students see is in there.

```
site/            the website: 20 pages, 3 stylesheets, js/core (shared), js/pages (one per page), data/ (all content)
tools/           validate-content.js, build-indexes.js, parity-test.js   (Node 20+)
docs/            CONTENT-GUIDE.md, PROPOSAL-AMENDMENTS.md (what changed and why)
.github/         deploy.yml: checks the content, then publishes site/ to GitHub Pages
```

## Run it
```
npm run serve        # then open http://localhost:8080   (any static server works; opening files directly will not load data)
npm run check        # rebuild the indexes and validate every data file
npm test             # parity tests: the new code grades and stores exactly like the old site
```

## Free hosting
Any static host works (GitHub Pages, Cloudflare Pages, Netlify). In GitHub: Settings → Pages → Source: **GitHub Actions**.
No paid service and no build step for visitors. By default accounts and results stay in each student's own browser.
Online accounts run on Vercel with a Neon Postgres database connected to the project (see the GitHub and Vercel steps).

## Add content
Content is JSON in `site/data/`, never code. See `docs/CONTENT-GUIDE.md`, or open `studio.html` and paste what it produces.
