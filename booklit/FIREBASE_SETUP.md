# Turning on accounts

Booklit works without any of this. With no Firebase config it keeps profiles,
shelf edits and saved books in `localStorage` on this machine, and never asks
you to sign in. Follow this only when you want real accounts that sync.

## 1. Create the project

1. <https://console.firebase.google.com> → **Add project**. Analytics is not needed.
2. **Build → Authentication → Get started**. Enable **Email/Password**. Enable
   **Google** too if you want the "Continue with Google" button to work — it's
   shown either way, but errors with "that sign-in method isn't enabled" until
   you do.
3. **Build → Firestore Database → Create database**. Start in **production
   mode**; the rules below replace the default.

## 2. Get the config

**Project settings → General → Your apps → Web app** (create one if there
isn't one) → **SDK setup and configuration → Config**.

Copy `.env.example` to `.env.local` and paste the values in:

```
cp .env.example .env.local
```

Restart `npm run dev` afterwards — Vite only reads env files at startup.

If you launch from the desktop shortcut, that runs a production build
(`npm run build` then `vite preview`), and Vite bakes env values into the bundle
at **build** time. So after editing `.env.local`, close the app windows and
relaunch the shortcut — it rebuilds. Editing the file alone changes nothing for
an already-built `dist/`.

## 3. Lock down Firestore

**Firestore → Rules**, replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Everything Booklit writes lives under the signed-in user's own document.
    // Nobody can read anybody else's shelves or edits.
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Publish**. Without this the default production rules reject every write and
the app will silently fall back to local storage (check the console for
`Could not save profiles`).

## What gets stored

| Path | Contents |
| --- | --- |
| `users/{uid}/meta/profiles` | Your profile list — your own shelf plus whoever you follow — and which one is open |
| `users/{uid}/meta/overrides` | Your shelf edits: shelf moves, ratings, notes, removals, and books saved off other people's shelves |

Book data itself is **not** stored in Firestore. Shelves are re-read from
Goodreads and cached by the local backend, so an account holds your decisions,
not a copy of every library you've looked at.

## First sign-in

If you'd been using Booklit locally before setting this up, the first sign-in
uploads your existing local profiles and edits to the account rather than
starting empty.

## A note on Goodreads

None of this changes what Goodreads allows. Their API was retired — keys stopped
being issued in December 2020 and the legacy ones now return 403 — so Booklit
reads public shelves through the RSS feed and can never write back. Shelf edits
you make are Booklit's own. To push them to Goodreads, export a CSV from
Settings and run it through <https://www.goodreads.com/review/import>.
