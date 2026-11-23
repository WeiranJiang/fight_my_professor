# Contributing to Fight My Professor

Use Node.js 22.13 or later. From the project directory, run `npm run dev` and open [the local site](http://127.0.0.1:3000). The dev server restarts when server modules change. Refresh the browser after editing frontend files.

For a separate database with starter content, run `FMP_DB=data/contributor.sqlite npm run dev`. The app creates the file on startup. To change local settings, copy `.env.example` to `.env` and edit the copy.

## Choose what you want to change

| Change | Where to work |
| --- | --- |
| Layout, colors, and page behavior | `public/index.html`, `public/style.css`, and `public/app.js` |
| Pixel sprites and avatar options | `public/shared.js` |
| Battle damage, bot estimates, and defaults | `game.mjs` |
| Default schools, professors, and questions | `seed.mjs` |
| Login, recovery, and fighter profiles | `backend/routes/account.mjs` |
| Search data, reviews, ratings, and submissions | `backend/routes/directory.mjs` and `backend/profiles.mjs` |
| Battle sessions and turn handling | `backend/routes/battle.mjs` |
| Moderation, question editing, and live game settings | `backend/routes/admin.mjs` |
| Database initialization and record operations | `backend/storage.mjs`, `backend/sqlite.mjs`, and `backend/d1.mjs` |

`backend/http.mjs` parses JSON, resolves sessions, and dispatches by method and path. Local Node and hosted Worker entry points use the same handlers. SQLite transactions protect local writes. D1 commits use a version check with atomic batches and retry concurrent changes. Return a JSON-compatible result from a handler. Use `requireRule` for validation and access checks.

Starter records are inserted by ID. To edit records already in a local database, use the corresponding site workflow. To preview changed starter values, use a new database filename. Existing moderator game settings override the defaults in `game.mjs`.

## Contribute questions

For a single question, log in and use **Contribute > Suggest a trivia question**. You can track the decision on the same page.

Use [the sample question pack](examples/question-pack.json) as a starting point. Write a question with one numeric answer, include a unit, and add an HTTPS source when available. Set `scale` to a reasonable absolute error in the question's unit. Choose a round duration of 10–120 seconds and set `active` to `true` or `false`.

```sh
npm run questions:check -- examples/question-pack.json
```

A moderator can upload the file under **Admin > Questions > Import JSON pack**. Regular contributors can share a checked pack with a moderator. For changes to a question already in rotation, a moderator can find it by prompt or category and edit it in place.

## Before opening a pull request

Run `npm test` and `npm run build`. For visual changes, open the affected page and check it at phone width. Describe what changed, how you verified it, and whether it affects existing data. Keep local databases and `.env` out of commits.
