# Supabase Setup

SpriteCraft Studio uses Supabase for user login and persistent asset storage.

## Environment

Copy these values into `.env.local`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are exposed to the browser. `SUPABASE_SERVICE_ROLE_KEY` is used only by the local API server and must never be committed.

## Storage

No SQL migration is required for the current implementation. The local API server validates the user's Supabase access token, creates the private `spritecraft-assets` Storage bucket when needed, and stores assets under:

```txt
users/{userId}/assets/{assetId}/frame-01.png
users/{userId}/library/{assetId}.json
```

The browser never writes directly to Storage. It calls the local API with the user's access token, and the server uses `SUPABASE_SERVICE_ROLE_KEY` to read/write only paths for that authenticated user.

## Product Flow

1. User registers or logs in from the top bar.
2. The app asks the local API to restore that user's cloud asset manifests.
3. New Seedream generations are uploaded to private Storage and recorded as JSON manifests.
4. Favorites update the same manifest in Storage.
5. Export remains a local download action and does not replace cloud persistence.
