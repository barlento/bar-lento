# Bar Lento — staff schedule site

Live site: **https://bar-lento.vercel.app** (Vercel project `bar-lento`, team "BAR LENTO", auto-deploys from `main`, ~60–90 s).
Owner: Bar Lento, 158 8th Avenue, New York (info@barlentony.com). Floor manager: **Marta** (not technical — she edits from the site, never from code).
The owner writes in Italian; answer him in Italian. Everything staff sees on the site is in **English** (the team is mixed Italian/American). The IT/EN toggle exists only inside manager mode.

## How to publish a change (the only job that needs code)
Edit the files, commit, `git push origin main`. That's it — Vercel builds and publishes automatically. No build step, no npm install locally (Vercel installs `web-push`).
Push directly to `main` (no PR needed) unless the owner asks otherwise. If a direct push is refused, push a branch and tell the owner to tap **Create PR → Merge**.
Verify after ~90 s at https://bar-lento.vercel.app (add `?v=<n>` to bypass caches). `*.vercel.app` may be unreachable from the sandbox network — say so instead of guessing.

## Golden rules from the owner
- **Simplicity first** ("più semplice e veloce"). One obvious button beats three clever ones. Marta must never need Claude.
- Light, readable theme; must look great on iPhone (installable PWA, home-screen app) and on PC. Playful "alive" effects: pulsing LEDs, rising cards, confetti — never at the cost of clarity.
- Staff confirm a shift by typing `confirm` (or `remove`) in a popup — no accidental taps.
- Notifications: ONLY (a) "new week posted" and (b) one batched summary of changes that affect employees (shift added/removed/time changed, day closed/opened). Never spam. Quiet hours 11 PM–10 AM New York.
- Past weeks are a locked legal archive: never editable/deletable; removing a person deletes only their **upcoming** shifts.
- Manager password lives only in Vercel env `admin_password` (any case). Never print secrets in chat, code or logs.

## Architecture (vanilla, no framework)
- `index.html` — the whole UI (staff + manager) in one file: CSS, i18n dict `I18N.en/it` (`t()`, `data-t`), IIFE app. Polls `/api/data` every 45 s. Service worker `sw.js` (push display only, no caching). PWA: `manifest.webmanifest`, `icons/`.
- `api/*.js` — Vercel serverless functions (Node, CommonJS):
  `data` (GET schedule / POST save with optimistic `version`, 409 on conflict; removing a staff name also wipes their PIN + devices), `login`, `confirm`, `log`, `export` (CSV archive), `push` (subscriptions), `notify` (manager flush), `toast` (POS: `status`, `today`, `clock`, `employees`, `who`), `me` (personal access: `begin`/`create`/`login`/`logout`, `who`, `hours&week=` per-person Toast entries, manager `list`/`reset`).
- `lib/store.js` — Upstash Redis via REST (env prefix auto-detected KV_/UPSTASH_REDIS_/STORAGE_/REDIS_); seed fallback `data.json`. Keys: `barlento:schedule`, `barlento:confirm`, `barlento:log`, `barlento:pending*`, `barlento:announce`, `barlento:push`, `barlento:toast:*`, `barlento:pin` (name → scrypt hash), `barlento:sessions` (device token → name).
- `lib/accounts.js` — staff PIN accounts: 4 digits, scrypt+salt, 5 wrong tries → growing lock (5→60 min), random 48-hex device token in header `x-staff-token` (localStorage `bl_me_token`/`bl_me_name`), `resetPin` = clear PIN + sign out everywhere.
- `lib/diff.js` — computes changes between saves → history log + "notable" changes for the batched push.
- `lib/push.js` — Web Push (VAPID; public key in file, private in env `VAPID_PRIVATE_KEY`), `flushPending` with quiet hours.
- `lib/toast.js` — Toast POS Standard API (read-only): login, restaurant auto-discovery, employees (paginated), time entries, `dayStatus`, `autoMap` (fuzzy first-name matching so nobody maps names by hand). Env: `TOAST_CLIENT_ID`, `TOAST_CLIENT_SECRET` (optional `TOAST_RESTAURANT_GUID`).
- Data model: `{staff[], birthdays{name:YYYY-MM-DD}, toastMap{name:guid}, weeks{<MondayISO>:{mon..sun:[{id,name,station,start,end}], notes:{day:{status:''|closed|holiday|half|event,text,open?,close?}}}}}`.

## Features already live (don't rebuild — extend)
**My week (personal access)**: first visit → "Who are you?" name grid → create/enter 4-digit PIN on a big keypad → device remembered. Header button 👤 + strip "Hi Marco · Next shift…" + own shifts tagged YOU; sheet with week nav, tiles scheduled / worked (Toast) / difference, per-shift clock-ins, tap to confirm, "Not you? Switch", "Log out here". Manager roster: PIN status, **📅 view someone's week**, **🔑 Reset PIN** (double tap). No PIN → "Not now" snoozes the prompt 24 h.
Weekly view with tabs; today hero with LED; typed confirmation; manager mode (add/edit/delete shifts, staff + birthdays with confetti popup, day closures with presets incl. half-day hours, US holidays auto-detected, one-tap **New week** (copy last / empty), delete current/future week with double confirm, change history, CSV export, Notify team, IT/EN); push notifications with bell button; new-week popup once per device; **⏱ Time clock** button for everyone (Toast clock-ins/outs, day navigation, live counter) and clock badges on today's shifts.

## Ideas the owner liked (next candidates)
1. "My shifts" follow-ups: personal push + morning-of reminder, add-to-calendar (.ics). (Name+PIN login, personal view and hours are live.)
2. Shift swap / unavailability requests approved by Marta.
3. "My hours": scheduled vs worked (from Toast) per person per week.
4. Punctuality streaks/badges.
5. Weather on day cards (Open-Meteo, no key).
6. Printable week + monthly hours summary for the owner.

## Local testing
`_devserver.js` (not deployed) fakes Redis + Toast and serves `/api/*` on :4173; Playwright scripts live outside the repo. Password in dev: `segreta`.
