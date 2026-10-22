# Pinterest taste setup

Clover uses Pinterest API v5 and OAuth authorization-code flow. It does not
scrape Pinterest. The app receives only board metadata and sync status; the app
secret, access tokens, and refresh tokens remain in Supabase Edge Functions and
service-only database rows.

## 1. Pinterest developer setup

1. Create a Pinterest developer app and request production access to the
   official API.
2. Request approval for these scopes:
   - `boards:read`
   - `pins:read`
   - `user_accounts:read`
3. In the Pinterest app, register this exact redirect URI, replacing the
   project reference:

   `https://<project-ref>.supabase.co/functions/v1/pinterest-oauth/callback`

Pinterest may reject board or Pin calls until the app and scopes are approved.
Clover surfaces that as an approval/configuration message instead of failing
the Profile screen.

## 2. Database and secrets

Link the Supabase project and apply migrations, including
`006_pinterest_taste.sql`:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Set server-only secrets. `OPENAI_API_KEY` is also used by the existing garment
processor; the Pinterest sync uses it to create 256-dimensional Pin embeddings.

```bash
supabase secrets set \
  PINTEREST_APP_ID=<pinterest-app-id> \
  PINTEREST_APP_SECRET=<pinterest-app-secret> \
  PINTEREST_OAUTH_REDIRECT_URI=https://<project-ref>.supabase.co/functions/v1/pinterest-oauth/callback \
  OPENAI_API_KEY=<openai-api-key>
```

For a deployed web build, also set its exact origin:

```bash
supabase secrets set PINTEREST_ALLOWED_RETURN_ORIGIN=https://app.example.com
```

Native development and production use the `clover` app scheme already declared
in `app.config.ts`. Expo Go development return URLs (`exp:` / `exps:`) are
accepted by the OAuth callback.

## 3. Deploy Edge Functions

The OAuth function must use `--no-verify-jwt` because Pinterest calls its public
GET callback without a Supabase token. Its POST start route still validates the
signed-in Supabase user itself. Board and sync functions keep gateway JWT
verification enabled.

```bash
supabase functions deploy pinterest-oauth --no-verify-jwt
supabase functions deploy pinterest-boards
supabase functions deploy pinterest-sync
```

## 4. Use and verify

1. Open Profile and tap **Connect Pinterest**.
2. Approve Pinterest access and return to Clover.
3. Select up to 10 boards, then tap **Save boards & sync Pins**.
4. Open a garment and choose **Style this item**. The three-look flow ranks
   against the blended profile and labels Pinterest-informed results.
5. Use **Disconnect Pinterest** to delete tokens, cached boards/Pins, and the
   Pinterest vector. Clover keeps the interaction-derived style profile.

Each manual sync processes at most 50 Pins and advances a per-board API
bookmark. The taste vector uses at most the 200 most recent cached Pins. This
keeps API and embedding work bounded while later syncs continue incrementally.

If credentials are absent, setup is incomplete, a token expires without a
refresh token, or Pinterest has not approved the scopes, Profile displays a
recoverable message. Reconnect after correcting configuration or approval.
