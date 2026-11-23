# Fight My Professor

Fight My Professor is a campus arcade and parody faculty directory. Players rate six fictional combat attributes, build a pixel fighter, and challenge professors to closest-wins trivia.

## Run locally

Use Node.js 22.13 or later. The app uses built-in Node modules and SQLite.

```sh
npm start
```

Open [Fight My Professor](http://127.0.0.1:3000). The default database is `data/fmp.sqlite`. Set `FMP_DB` to use a different file, or set `PORT` to use a different port.

```sh
npm test
```

The integration test starts a local server and uses a temporary database. It exercises guest and registered battles, turn validation, timeout handling, XP, character persistence, moderation, rankings, and password recovery.

## Edit or contribute

Run `npm run dev` for automatic server restarts while editing. Copy `.env.example` to `.env` to customize local settings. The [contributor guide](CONTRIBUTING.md) maps features to files and explains how to validate and share question packs.

## Directory and moderation

The directory starts with 20 universities, three faculty profiles linked to official university sources, and six labeled fictional training opponents. Real faculty start from the same neutral gameplay prior. Demo profiles cannot receive official rankings. By default official faculty ranks require three ratings, and school ranks require two eligible faculty profiles.

To create the first moderator, set `FMP_ADMIN_EMAIL` and `FMP_ADMIN_CODE` in `.env` or in the server environment, then start the server. Visit `/signup?admin=1` and register the designated address with the code. Keep the code private and remove it from the server environment after enrollment. Select **Admin** to review proposals or reports, edit numeric questions, adjust balance settings, or view the audit log.

Accounts use email and password authentication. The app issues a private recovery key at signup and rotates it after successful recovery. Password recovery revokes all active sessions for the account.

## Battle rules

Both fighters estimate the same number. The smaller absolute error wins the round, and exact ties deal zero damage. If both fighters survive seven rounds, the fighter with the higher remaining share of HP wins. Numeric answers and bot guesses stay on the server until the round ends. A completed battle can be reopened from its share link.

- Starting HP is base HP plus 25% of Durability.
- Bot estimate error is sampled symmetrically around the correct answer. Its maximum error is the question's scale multiplied by the configured bot spread and by `0.85 - 0.63 × Intelligence / 100`.
- The winner's damage starts at `base damage × (1.45 - 0.64 × min(error / scale, 1))`, plus Strength divided by 22. The target subtracts Durability divided by 32 and Agility divided by 60. The attacker adds Rizz divided by 40 in round three and Aura divided by 40 in round five. Damage rounds to the nearest integer with a minimum of one per non-tied hit.
- Registered players get 120 base XP for a win or 35 XP for a loss or draw by default. First wins and harder matchups can earn bonuses. Repeated matchups within a day earn reduced XP.
- Fighters start with three discretionary points and gain two per level, up to 80 per attribute. Milestone cosmetics are available in the character editor.

## Hosting

The hosted build runs as a Worker with the `DB` D1 binding in `.openai/hosting.json`. Run `npm ci` and `npm run build` to produce the deployment artifact. Sites applies the SQL migrations in `drizzle/`. The local SQLite file and hosted D1 database are separate. `/api/health` checks database readiness.

For hosted moderation, set `FMP_ADMIN_EMAIL` and a strong secret `FMP_ADMIN_CODE` in the Site's runtime environment, deploy the environment change, then register at `/signup?admin=1`. Use an address that has yet to register on the game. Remove the invite code and redeploy after the moderator is enrolled.

Players can go to **Contribute** to suggest trivia, professors, and schools. The site shows them their submission status. Moderators review trivia in **Admin > Trivia Submissions** and check the linked source before approving a question. Approved questions enter the rotation automatically.

## Trivia and contact inbox

The arena offers one daily professor challenge per signed-in account or guest browser. The featured professor is shared and selected server-side, with a 75% preference for a configured list of ten campuses. The challenge resets at midnight Eastern. Guests use a default fighter, while accounts use their own stats and earn XP. A first rating unlocks one optional bonus match against that professor that day. The arena supports mixed, estimation, rarest-outcome, and most-common-outcome formats. Choice weights are counts or probabilities, and the server sends only the labels until the answer is locked.

Five checked math and probability questions enter the bank each UTC day, including three estimates and two ranked-choice questions. The runtime generates a rolling 120-day bank from date-based formulas. It prefers questions the player has not received in the last 30 days, then favors newer prompts. A repeat can occur if a player exhausts the unseen questions for a selected format. Moderators can also edit and import hand-written questions.

Signed-in players can send up to five private contact messages per day. Moderators review them under **Admin > Inbox**. This is an in-game inbox. The contact form does not send email.
