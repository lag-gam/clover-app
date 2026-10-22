# Browser-based Google authentication

Clover uses Supabase's browser OAuth flow on Expo SDK 57 so it can run in the
App Store version of Expo Go without a custom native development build.
Firebase and the native Google Sign-In SDK are not used.

## 1. Create a Google OAuth client

In Google Cloud Console:

1. Configure the OAuth consent screen.
2. Create an OAuth client with application type **Web application**.
3. Add the Supabase callback URL shown in the Supabase Google provider settings
   under **Authorized redirect URIs**. It has this form:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

Save the Web client ID and client secret.

## 2. Enable Google in Supabase

In **Supabase Dashboard → Authentication → Providers → Google**:

1. Enable Google.
2. Add the Web client ID and client secret.
3. Leave nonce checking enabled; browser OAuth handles the provider exchange.

Keep the Google client secret in Supabase only. It must not be added to `.env`
or bundled with the app.

## 3. Allow Expo redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**, add these
redirect URLs:

```text
exp://**/--/auth/callback
clover://auth/callback
```

The first wildcard supports Expo Go on changing local network addresses. The
second supports a future standalone Clover build.

## 4. Run in Expo Go

```bash
npm install
npx expo start --clear
```

Confirm that the CLI says **Using Expo Go** and displays an `exp://` URL, not an
`exp+clover://` development-client URL. Make sure the phone and computer are on
the same Wi-Fi network, then scan the QR code from Expo Go. If the phone camera
reports “No usable data,” use Expo Go's built-in scanner.

If LAN discovery is blocked, use:

```bash
npx expo start --tunnel
```

This flow does not require Xcode, Apple signing, a connected iPhone, or
generated native projects. Google opens in the system browser and returns to
Expo Go at `/auth/callback`.
