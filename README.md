# Clover AI Closet v2

Photograph garments, browse your digital closet, generate outfits, rate them, and get personalized recommendations that improve over time.

## Stack

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

```bash
npm install
# Create .env and fill in the variables below
npx expo start --clear
```

The CLI should say **Using Expo Go** and show an `exp://` QR code. Open Expo Go
on the phone and scan that QR code. If the phone camera reports “No usable
data,” use Expo Go's scanner instead. If LAN discovery is blocked, run
`npx expo start --tunnel`.

SDK 57 matches the current App Store build of Expo Go. This workflow does not
require Xcode, Apple signing, a development client, or generated `ios/` and
`android/` projects. See
[Browser-based Google authentication](docs/social-auth.md) for the Google and
Supabase dashboard setup.

## Environment Variables

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

OpenAI and remove.bg credentials must never use `EXPO_PUBLIC_*` variables.
Store them only as Supabase Edge Function secrets, then deploy the background
processor:

```bash
supabase link --project-ref your-project-ref
supabase db push
supabase secrets set OPENAI_API_KEY=your-openai-key REMOVEBG_API_KEY=your-removebg-key
supabase functions deploy process-garment
```

Failed garments show the actual analysis error and a step-by-step log
on the garment screen. Apply migration `013_garment_processing_events.sql`
so those logs persist in the database, then deploy the processor.

```bash
npx supabase db push
npx supabase functions deploy process-garment
npx supabase functions logs process-garment --follow
```

Pinterest taste learning is optional. It requires an approved Pinterest
developer app and additional server-only secrets/functions. Follow the exact
[Pinterest API v5 setup and deployment steps](docs/pinterest.md).

## Database

Core tables use RLS (row-level security) so users only access their own data.
Pinterest OAuth tokens and states have no client policies and are service-only:

| Table | Purpose |
|---|---|
| `garments` | Clothes with auto-extracted category, subtype, metal tone, color, material, tags, and 256-dim embedding |
| `outfits` | Generated outfit combinations with averaged embedding and style score |
| `outfit_items` | Junction table linking outfits to garments with slot info (top, bottom, shoes, etc.) |
| `interactions` | Every user action: shown, skipped, liked, disliked, selected, worn, repeated, item_swapped |
| `style_profiles` | Weighted-average embedding vector computed from interaction history |
| `pinterest_connections` | Service-only Pinterest OAuth and refresh tokens |
| `pinterest_boards` | User-scoped cached board metadata and selection |
| `pinterest_pins` | User-scoped bounded Pin embedding cache |

Storage bucket `garment-images` (public) with user-scoped paths.

## Architecture

### Garment Ingestion Pipeline

Camera/gallery → compress (1024px, 80% JPEG) → upload original to Supabase
Storage → save a pending garment → return to capture. The authenticated
`process-garment` Edge Function responds with `202`, then uses
`EdgeRuntime.waitUntil` to run remove.bg and GPT-4o Vision concurrently,
generate the embedding, and mark the garment ready or failed.

Pending and failed states appear in closet/detail views. Failed enrichment can
be retried without uploading the original photo again. The `MetadataEditor`
component remains available after enrichment finishes.

### Outfit Generation

Slot-based sampling with compatibility filtering and deterministic rendering:

- **Required slots**: top + bottom + shoes (or dress + shoes)
- **Optional slots**: outerwear and several distinct accessory subtypes
- **Sag mode**: user-controlled; pants looks require underwear and expose its waistband, while dress looks never include underwear
- **Compatibility rules**: max 3 unique colors, no bold pattern clashes, formality spread ≤ 2
- **Presentation**: exact user cutouts arranged by `FlatLayCollage` on a complementary soft canvas; no generated outfit imagery

Each outfit's embedding is the average of its garments' embeddings.

### Interaction System

Swipe-based (Tinder/TikTok style):

- **Swipe right** → like
- **Swipe left** → dislike
- **Swipe down** → skip
- **Double-tap** → like
- **Tap garment** → swap with compatible alternative from same category

All interactions are logged with full context (outfit ID, swap pairs) for training data.

### Style Learning

Weighted average of outfit embeddings from interaction history:

| Interaction | Weight |
|---|---|
| worn / repeated | +2.0 |
| selected | +1.5 |
| liked | +1.0 |
| disliked | -1.0 |
| skipped / shown | 0 |

Auto-recalculates after every 5 new ratings. Cold start: random ranking until 5+ interactions, with prompt to keep rating.

Generated outfits are ranked by cosine similarity to the user's style
embedding. When Pinterest is connected, Clover blends 65% interaction taste
with 35% selected-board Pin taste; Pinterest-only taste also supports cold
start ranking.

### Key Design Decisions

- **Embeddings without pgvector**: Stored as JSONB arrays, cosine similarity computed in JS. Fine for <500 garments.
- **Provider keys stay server-side**: OpenAI and remove.bg run only in the Supabase Edge Function.
- **No Python backend**: ML orchestration runs in the Deno-compatible Edge Function.
- **No collage model training**: layout is deterministic React Native positioning, so recommendations preserve the exact scanned garments instead of hallucinating replacements.

See [Flat-lay outfits](docs/flatlay-outfits.md) for the taxonomy, Sag mode, and
rendering design.

## Project Structure

```
app/                              # Expo Router (file-based routing)
├── _layout.tsx                   # Root: AuthProvider + Google sign-in gate
├── (tabs)/                       # Main app (bottom tab navigator)
│   ├── index.tsx                 # Outfit recommendation feed with swipe
│   ├── closet.tsx                # Browse garments grid with category filter
│   ├── add.tsx                   # Camera → upload → background analysis
│   └── profile.tsx               # Style stats + sign out
├── garment/[id].tsx              # Garment detail / edit / delete
└── outfit/[id].tsx               # Outfit detail + mark as worn

src/
├── lib/
│   └── supabase.ts               # Supabase client (AsyncStorage session)
├── services/
│   ├── garment.service.ts        # Ingestion pipeline + CRUD
│   ├── outfit.service.ts         # Generation + compatibility + ranking
│   ├── interaction.service.ts    # Log all interaction types
│   └── style.service.ts          # Weighted style vector computation
├── hooks/
│   ├── useAuth.ts
│   ├── useGarments.ts
│   └── useStyleProfile.ts
├── components/
│   ├── GarmentCard.tsx
│   ├── OutfitCard.tsx            # Swipeable card with gesture handling
│   ├── SwapSheet.tsx             # Bottom sheet for garment swap
│   ├── CategoryFilter.tsx
│   └── MetadataEditor.tsx
├── providers/AuthProvider.tsx
├── types/database.ts
├── constants/
│   └── categories.ts
└── utils/
    ├── math.ts                   # Cosine similarity, vector averaging
    └── image.ts                  # Local image compression

supabase/migrations/
├── 001_create_tables.sql
├── 002_rls_policies.sql
├── 003_storage.sql
└── 004_async_garment_processing.sql
└── 007_flatlay_outfit_taxonomy.sql

supabase/functions/
└── process-garment/index.ts      # Authenticated background enrichment
```

## Verification

1. **Auth**: Google sign-in → session persists on restart → sign out
2. **Ingestion**: Photograph a garment → returns after upload/save → pending item becomes ready in closet
3. **Closet**: Browse grid → filter by category → tap to view detail → edit metadata → delete
4. **Outfits**: Generate → swipe through → swap items → interactions logged in DB
5. **Style**: After 5+ ratings → style profile activates → outfit ranking changes from random to personalized
