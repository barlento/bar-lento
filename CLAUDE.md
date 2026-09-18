# Bar Lento — staff schedule site

Live site: **https://bar-lento.vercel.app** (Vercel project `bar-lento`, team "BAR LENTO", auto-deploys from `main`, ~60–90 s).
Owner: Bar Lento, 158 8th Avenue, New York (info@barlentony.com). Floor manager: **Marta** (not technical — she edits from the site, never from code).
The owner writes in Italian; answer him in Italian. Everything staff sees on the site is in **English** (the team is mixed Italian/American). The IT/EN toggle exists only inside manager mode and must translate EVERYTHING the manager sees (header, hero, tabs, day/month names, cards, time clock, ranking, personal panels): use `t()`/`data-t` and the `L_EN`/`L_IT` day-month tables for any new text. The choice is per device (`bl_lang`), applied only while logged in as manager, English again on logout, restored on login. "Copy as text" stays English (it goes to the team).

## How to publish a change (the only job that needs code)
Edit the files, commit, `git push origin main`. That's it — Vercel builds and publishes automatically. No build step, no npm install locally (Vercel installs `web-push`).
Push directly to `main` (no PR needed) unless the owner asks otherwise. If a direct push is refused, push a branch and tell the owner to tap **Create PR → Merge**.
Verify after ~90 s at https://bar-lento.vercel.app (add `?v=<n>` to bypass caches). `*.vercel.app` may be unreachable from the sandbox network — say so instead of guessing.

## Golden rules from the owner
- **Simplicity first** ("più semplice e veloce"). One obvious button beats three clever ones. Marta must never need Claude.
- Light, readable theme; must look great on iPhone (installable PWA, home-screen app) and on PC. Playful "alive" effects: pulsing LEDs, rising cards, confetti — never at the cost of clarity.
- Personal access is mandatory: the schedule is blurred behind "Who are you?" until a person enters their PIN (or the manager logs in). Each person can confirm ONLY their own shifts (server-checked), via a two-step popup (tap shift → tap Confirm).
- Notifications: ONLY (a) "new week posted" and (b) one batched summary of changes that affect employees (shift added/removed/time changed, day closed/opened). Never spam. Quiet hours 11 PM–10 AM New York.
- No public comparisons between employees (Marta's request): personal stats only for staff, rankings only in Manager mode. Exception decided by the owner: the **⏱ Time clock** (who punched in/out, times, past days) stays visible to every signed-in employee — it is operational info, not a ranking. Don't restrict it.
- **Toast is read-only, always.** Clock-ins/outs happen ONLY on the real Toast POS terminal with the employee's own account. The site just mirrors them (history, confirmation, a nice extra to check from home). Never add a way to punch in/out, edit or create time entries from the site — for anyone, manager included.
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
Weekly view with tabs; today hero with LED; typed confirmation; manager mode (add/edit/delete shifts, staff + birthdays with confetti popup, day closures with presets incl. half-day hours, US holidays auto-detected, one-tap **New week** (copy last / empty), delete current/future week with double confirm, change history, CSV export, Notify team, IT/EN); push notifications with bell button; new-week popup once per device; **⏱ Time clock** button for everyone (Toast clock-ins/outs, day navigation, live counter) and clock badges on today's shifts.
**Personal access (name + PIN)**: first visit → "Who are you?" name grid → create/enter 4-digit PIN on a big keypad → device remembered (token). Header button 👤 + strip "Hi Marco · Next shift…" with two buttons, own shifts tagged YOU. **📅 My week**: week nav, tiles scheduled / worked (Toast) / difference, per-shift clock-ins, tap to confirm, "Not you? Switch", "Log out here". **🌟 Week in review** popup once per person per week (`/api/me?action=recap&week=`): last week vs the week before, always encouraging (more hours, punctuality up, early bird, gentle nudge) — never negative. **⭐ My stats** (`/api/toast?action=mystats`, identity from the PIN token, or manager + `&name=`): ONLY own hours, on-time % (after 3 scheduled shifts), streak, badges, encouraging message, anonymous team totals — never other people's numbers or a rank. Manager roster: PIN status, **📅 view someone's week**, **🔑 Reset PIN** (double tap; also signs out their devices). **🏆 Team ranking** exists only in Manager mode (`?action=leaderboard`, password required; `lib/leaderboard.js`): Hours + On-time columns, podium, live re-ordering. The manager (Marta) explicitly asked that staff never see comparisons — keep it that way.

**📜 House Rules** (`rules.js` = the text, `rules.html` = printable page, both static): shown ONCE per version right after the PIN login, blocking: read to the end → email → checkbox → "I have read and agree" → `POST /api/me {action:"ackRules"}` stores name/email/time/device in `barlento:rules_ack` (kept even if the person is removed: legal record) and writes a line in the change history. `version: null` = dormant; set `version: "YYYY-MM-DD"` to publish (a new version asks everyone again). Manager roster shows "Rules ✓ date · email" / "not acknowledged yet". Text is English only, written to fit NY law: no wage deductions for theft (Labor Law §193), lawful off-duty conduct protected (§201-d), cameras never in restrooms/changing area (§203-c), electronic-monitoring notice (Civil Rights Law §52-c), voluntary health disclosure, at-will + non-retaliation + NLRA §7 statements. It does not replace the separate NY sexual-harassment policy/training, pay notices or posters — have a NY employment attorney review before publishing.

## Ideas the owner liked (next candidates)
1. Personal follow-ups: personal push + morning-of reminder, add-to-calendar (.ics). (Name+PIN login, My week, My stats are live.)
2. Shift swap / unavailability requests approved by Marta.
4. My stats extras: personal weekly recap push (opt-in), personal bests; manager ranking: monthly export.
5. Weather on day cards (Open-Meteo, no key).
6. Printable week + monthly hours summary for the owner.

## Local testing
`_devserver.js` (not deployed) fakes Redis + Toast and serves `/api/*` on :4173; Playwright scripts live outside the repo. Password in dev: `segreta`.
