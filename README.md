# Clover AI Closet v2

Photograph garments, browse your digital closet, generate outfits, rate them, and get personalized recommendations that improve over time.

## About Clover

- **Frontend**: Expo SDK 57, React Native, Expo Router (file-based routing), TypeScript, NativeWind (Tailwind CSS)
- **Backend**: Supabase (auth, Postgres, Storage)
- **AI**: OpenAI GPT-4o Vision (metadata extraction), text-embedding-3-small (256-dim embeddings), remove.bg (background removal)

## Prerequisites

1. **Supabase project** — create at [supabase.com](https://supabase.com), then apply the SQL migrations in `supabase/migrations/`
2. **OpenAI API key** — from [platform.openai.com](https://platform.openai.com)
3. **remove.bg API key** — from [remove.bg](https://www.remove.bg/api) (50 free calls/month)
4. **Google Cloud OAuth client** — Web client configured through Supabase Auth
5. **Node.js 22.13+** — required by Expo SDK 57
6. **Expo Go** — install the latest App Store version on your iPhone

## Setup

**Built with <3 for sustainable fashion** 
