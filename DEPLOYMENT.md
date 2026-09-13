# Deploying to Hostinger (Phase 10)

Tailored to: shared hosting with Node.js app support, a MySQL database not yet created, manual file
upload (File Manager or FTP). I can't do the account-side steps myself — no Hostinger credentials, and
I wouldn't log into hPanel on your behalf even if given a password. Everything below marked **(you)**
needs your hands in hPanel; everything marked **(me)** I've already done or can do once you hand back
what that step produces.

## 1. Create the MySQL database **(you)**

In hPanel → **Databases → MySQL Databases**:

1. Create a new database (e.g. `u123456789_voiceeng` — Hostinger prefixes database/user names with
   your account ID, that's normal).
2. Create a database user and attach it to that database with full privileges.
3. Note down: **database host** (often `localhost` from inside Hostinger, but check — some plans give
   a specific host), **port** (usually `3306`), **database name**, **username**, **password**.

Hostinger's MySQL users are scoped to the one database you attach them to — they can't create other
databases. `scripts/init-db.mjs` already handles this: it tries to create the database first (works
locally with root), and if that fails due to permissions, it just proceeds assuming the database (the
one you created above) already exists.

**Send me those 5 values** and I'll fill them into `.env.production` (already created locally, with
fresh production `JWT_SECRET`/`ENCRYPTION_KEY` generated — deliberately different from your local dev
ones, since this is a new, separate database with no user data in it yet).

## 2. Create the Node.js application **(you)**

In hPanel → **Advanced → Node.js** (exact menu name may vary slightly by hPanel version):

1. Create a new Node.js application.
2. Node.js version: use the latest available 20.x or 22.x LTS (this app was built against Node 24
   locally, but Next.js 16 supports any current Node LTS — check what Hostinger offers).
3. Application root: a folder like `communication-coach` under your domain.
4. Application startup file: `node_modules/.bin/next` won't work directly as a startup file in most
   Node.js-app panels — instead set the startup command to run `npm start` if the panel supports a
   custom start command, or point it at a small wrapper. If hPanel only accepts a single JS entry file,
   ask me and I'll add a `server.js` that calls Next's programmatic API — not needed if you can set the
   run command directly to `npm start`.
5. Domain/subdomain: attach the domain or subdomain this app will live on.

## 3. Upload the app files **(you, or me if you set up FTP access)**

Upload everything **except**: `node_modules/`, `.next/`, `.git/`, `.env.local`, `.env.production` (env
vars get set separately in hPanel — see step 4).

If you'd rather I do the upload directly, an FTP client here can connect with host/user/password/port
from hPanel → **Files → FTP Accounts** — share those and I'll push the files.

## 4. Set environment variables **(you, using values from step 1)**

Once you've created the database (step 1), send me the 5 values and I'll hand you back a filled-in
`.env.production`. In hPanel's Node.js app screen there's usually an **Environment variables** section
— add each line from that file there (most panels want them one at a time, not as an uploaded file).
If hPanel instead supports uploading a `.env` file directly into the app root, that works too.

## 5. Install dependencies and build **(you, via hPanel's Node.js screen)**

Hostinger's Node.js app management screen has buttons (or a terminal box) for running npm commands
without full SSH — usually **"Run NPM Install"** and a way to run an arbitrary command like
`npm run build`. Run, in order:

```bash
npm install
npm run build
```

**Important**: run `npm install` on Hostinger's server itself, not by uploading `node_modules` from a
local machine. Tailwind v4's CSS engine (`@tailwindcss/oxide`) ships a different native binary per OS —
a Windows-built `node_modules` will not work on Hostinger's Linux server. This only works cleanly
because `npm install` resolves the right one automatically when run on the target machine.

If your plan includes SSH (check hPanel → **Advanced → SSH Access** — often available even on shared
plans above the entry tier), you can run these same commands over SSH instead, which is more reliable
than a panel's command box for anything that takes a while.

## 6. Initialize the database **(you or me, once app files + env vars are in place)**

Run once, the same way you ran `npm install`:

```bash
npm run db:init
```

This applies `db/schema.sql` and seeds the scenario library + one admin account, using
`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` from the environment — **set a real password for this before
running it**, don't ship the local placeholder.

## 7. Enable SSL **(you)**

hPanel → **Security → SSL** → issue a free Let's Encrypt certificate for the domain. This is not
optional: the app sets its session cookie with `secure: true` in production (`NODE_ENV=production`,
already set in `.env.production`), meaning login will silently fail over plain HTTP. The domain must
serve HTTPS before anyone can log in.

## 8. Start the app **(you)**

Back in the Node.js app screen, start/restart the application. It should come up listening on whatever
port Hostinger assigns via the `PORT` environment variable — `next start` reads that automatically, no
code change needed.

## 9. Re-verify **(together)**

Once it's live, send me the URL and I can browser-test it the same way I verified everything locally
this session: log in as the seeded admin, add a real Gemini API key, and run through Speaking, Writing,
Listening, Vocabulary, Grammar, Progress, Client Track, and YouTube Learning end-to-end against the
production database.

---

**What I need from you to keep going**: the 5 database values from step 1 (host, port, name, user,
password), and confirmation of which of steps 3/5/6 you want me involved in vs. handling yourself.
