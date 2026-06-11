# World Cup Draft Room — deploy guide

A draft app where you create groups, invite players by a shareable link, run a snake
draft of all 48 teams, and track matchups, rivals, and standings live. Everyone uses
their own phone; all phones share one database.

This guide gets you from zero to a live URL you can text to a friend. Two accounts,
about 20 minutes, all free tiers. Nothing here needs a credit card.

---

## What you'll do
1. Create a free Supabase project (the shared database).
2. Create one table by pasting in some SQL.
3. Push this folder to GitHub.
4. Deploy on Vercel and paste in two secret values.
5. Open your live URL, make a group, and share the invite link.

---

## 1. Supabase (the database)

1. Go to https://supabase.com and sign up (GitHub login is easiest).
2. Click **New project**. Give it any name, set a database password (save it
   somewhere, though you won't need it for this app), pick the closest region,
   and create it. Wait ~2 minutes for it to finish setting up.
3. In the left sidebar open **SQL Editor**, click **New query**, paste the entire
   contents of `supabase-setup.sql` from this folder, and click **Run**. You should
   see "Success. No rows returned." That created the `groups` table.
4. Now get your two values. Click the **Connect** button at the top (or go to
   **Settings -> API Keys**):
   - **Project URL** — looks like `https://abcdxyz.supabase.co`. This is `SUPABASE_URL`.
   - **Secret key** — under **API Keys -> Secret keys**, copy the secret value
     (`sb_secret_...`). On older projects this is labeled **service_role** under
     Legacy API Keys; either works. This is `SUPABASE_SECRET_KEY`.

   Keep the secret key private. It's used only on the server, never in the browser.

---

## 2. Put the code on GitHub

If you have `git` and the GitHub CLI:

```bash
cd world-cup-draft
git init
git add .
git commit -m "World Cup draft app"
gh repo create world-cup-draft --private --source=. --push
```

No CLI? Create an empty private repo at https://github.com/new, then on its page
follow "push an existing repository from the command line", or use GitHub Desktop
to add this folder and publish it.

---

## 3. Deploy on Vercel

1. Go to https://vercel.com and sign up with your GitHub account.
2. Click **Add New… -> Project**, then **Import** your `world-cup-draft` repo.
3. Before clicking Deploy, open **Environment Variables** and add both:
   - `SUPABASE_URL`  =  your project URL from step 1
   - `SUPABASE_SECRET_KEY`  =  your secret key from step 1
4. Click **Deploy**. After a minute you'll get a live URL like
   `https://world-cup-draft-xxx.vercel.app`.

That URL is your app. It works on any phone, anywhere.

---

## 4. Run a draft

1. Open your live URL. Tap **I'm the organizer -> New draft group**.
2. Name it, add each player with the **phone number** you'll invite them at, pick a
   scoring twist, choose **Everyone on their own phone**, and pick **Now** or a
   scheduled time. Create it.
3. On the draft screen you'll see an **invite link** (`...vercel.app/?g=XXXX`).
   Tap **Share** to copy or send it. Text it to your friend.
4. Your friend opens the link on his phone, enters the phone number you listed for
   him, and accepts. You'll see him appear as accepted. (Last to accept loses a point.)
5. When everyone's in, tap **Launch draft now**. Players draft on their own phones;
   each turn is timed. After the draft, players pick a rival and watch standings.

To log game results during the tournament, use the organizer view: open the group,
go to **Matchups**, and tap the winner of each game. Standings update for everyone.

---

## Local development (optional)

```bash
cp .env.local.example .env.local   # then fill in your two Supabase values
npm install
npm run dev                        # open http://localhost:3000
```

---

## Notes and limits

- **Live sync** is by polling every ~4 seconds, so a pick on one phone shows up on
  others within a few seconds. It's not instant websockets, but it's plenty for a draft.
- **No real login/security.** Anyone with the invite link who knows a listed phone
  number can act as that player. Fine for friends; don't use it for anything sensitive.
- **One database, many groups.** You can run family, friends, and work drafts from the
  same deployment; each is separate.
- **SMS** isn't wired up — invites are by shared link. The code has a `NOTIFY` stub if
  you later want to add Twilio.
