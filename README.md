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

## Directory and moderation

The directory starts with 20 universities, three faculty profiles linked to official university sources, and six labeled fictional training opponents. Real faculty start from the same neutral gameplay prior. Demo profiles cannot receive official rankings. By default official faculty ranks require three ratings, and school ranks require two eligible faculty profiles.

To create the first moderator, start the server with `FMP_ADMIN_EMAIL` and `FMP_ADMIN_CODE` set in its environment. Visit `/#signup?admin=1` and register the designated address with the code. Keep the code private and remove it from the server environment after enrollment. Select **Admin** to review proposals or reports, edit numeric questions, adjust balance settings, or view the audit log.

Accounts use email and password authentication. The app issues a private recovery key at signup and rotates it after successful recovery. Password recovery revokes all active sessions for the account.

## Battle rules

Both fighters estimate the same number. The smaller absolute error wins the round, and exact ties deal zero damage. If both fighters survive seven rounds, the fighter with the higher remaining share of HP wins. Numeric answers and bot guesses stay on the server until the round ends. A completed battle can be reopened from its share link.

- Starting HP is base HP plus 25% of Durability.
- Bot estimate error is sampled symmetrically around the correct answer. Its maximum error is the question's scale multiplied by the configured bot spread and by `0.85 - 0.63 × Intelligence / 100`.
- The winner's damage starts at `base damage × (1.45 - 0.64 × min(error / scale, 1))`, plus Strength divided by 22. The target subtracts Durability divided by 32 and Agility divided by 60. The attacker adds Rizz divided by 40 in round three and Aura divided by 40 in round five. Damage rounds to the nearest integer with a minimum of one per non-tied hit.
- Registered players get 120 base XP for a win or 35 XP for a loss or draw by default. First wins and harder matchups can earn bonuses. Repeated matchups within a day earn reduced XP.
- Fighters start with three discretionary points and gain two per level, up to 80 per attribute. Milestone cosmetics are available in the character editor.

## Hosting

This app uses a long-running Node process and a writable SQLite database. For hosting, run a single instance on a Node host with a persistent volume for `FMP_DB`. Set `HOST=0.0.0.0` when the host requires it and `FMP_SECURE_COOKIES=1` when serving behind an HTTPS reverse proxy. Back up the SQLite database with SQLite's backup tooling.
