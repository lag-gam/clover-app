# Clover AI Closet v2

Photograph garments, browse your digital closet, generate outfits, rate them, and get personalized recommendations that improve over time.

## Stack

- **Frontend**: Expo SDK 57, React Native, Expo Router (file-based routing), TypeScript, NativeWind (Tailwind CSS)
- **Backend**: Supabase (auth, Postgres, Storage)
- **AI**: OpenAI GPT-4o Vision (metadata extraction), text-embedding-3-small (256-dim embeddings), remove.bg (background removal)

## Prerequisites

1. **Supabase project** — create at [supabase.com](https://supabase.com), then run the SQL migrations in `supabase/migrations/` (001 → 002 → 003) in the SQL editor
2. **OpenAI API key** — from [platform.openai.com](https://platform.openai.com)
3. **remove.bg API key** — from [remove.bg](https://www.remove.bg/api) (50 free calls/month)

## Setup

```bash
npm install
cp .env.example .env
# Fill in your keys in .env
npx expo start
```

Scan the QR code with Expo Go on your phone.

## Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_OPENAI_API_KEY=your-openai-api-key
EXPO_PUBLIC_REMOVEBG_API_KEY=your-removebg-api-key
```

## Database

5 tables with RLS (row-level security) — users only access their own data:

| Table | Purpose |
|---|---|
| `garments` | Clothes with auto-extracted metadata (category, color, pattern, material, fit, formality) and 256-dim embedding |
| `outfits` | Generated outfit combinations with averaged embedding and style score |
| `outfit_items` | Junction table linking outfits to garments with slot info (top, bottom, shoes, etc.) |
| `interactions` | Every user action: shown, skipped, liked, disliked, selected, worn, repeated, item_swapped |
| `style_profiles` | Weighted-average embedding vector computed from interaction history |

Storage bucket `garment-images` (public) with user-scoped paths.

## Architecture

### Garment Ingestion Pipeline

Camera/gallery → compress (1024px, 80% JPEG) → upload original to Supabase Storage → remove.bg background removal → upload cutout → GPT-4o Vision metadata extraction → text-embedding-3-small embedding → save to DB

The `MetadataEditor` component lets users review and correct AI-extracted metadata before saving.

### Outfit Generation

Slot-based random sampling with compatibility filtering:

- **Required slots**: top + bottom + shoes (or dress + shoes)
- **Optional slots**: outerwear (30%), accessory (30%)
- **Compatibility rules**: max 3 unique colors, no bold pattern clashes, formality spread ≤ 2

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

Generated outfits are ranked by cosine similarity to the user's style embedding.

### Key Design Decisions

- **Embeddings without pgvector**: Stored as JSONB arrays, cosine similarity computed in JS. Fine for <500 garments.
- **API keys in client**: Acceptable for single-user MVP. Move to Edge Functions before any public release.
- **No Python backend**: All ML logic runs in TypeScript on the client.

## Project Structure

```
app/                              # Expo Router (file-based routing)
├── _layout.tsx                   # Root: AuthProvider + auth-gated redirect
├── (auth)/                       # Unauthenticated screens
│   ├── login.tsx
│   └── signup.tsx
├── (tabs)/                       # Main app (bottom tab navigator)
│   ├── index.tsx                 # Outfit recommendation feed with swipe
│   ├── closet.tsx                # Browse garments grid with category filter
│   ├── add.tsx                   # Camera → process → review → save
│   └── profile.tsx               # Style stats + sign out
├── garment/[id].tsx              # Garment detail / edit / delete
└── outfit/[id].tsx               # Outfit detail + mark as worn

src/
├── lib/
│   ├── supabase.ts               # Supabase client (AsyncStorage session)
│   ├── openai.ts                 # GPT-4o Vision + embeddings
│   └── background-removal.ts     # remove.bg API
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
│   ├── MetadataEditor.tsx
│   └── LoadingOverlay.tsx
├── providers/AuthProvider.tsx
├── types/database.ts
├── constants/
│   ├── categories.ts
│   └── prompts.ts
└── utils/
    ├── math.ts                   # Cosine similarity, vector averaging
    └── image.ts                  # Compression, base64 conversion

supabase/migrations/
├── 001_create_tables.sql
├── 002_rls_policies.sql
└── 003_storage.sql
```

## Verification

1. **Auth**: Sign up → sign in → session persists on restart → sign out
2. **Ingestion**: Photograph a garment → see processing steps → review/edit metadata → save → appears in closet
3. **Closet**: Browse grid → filter by category → tap to view detail → edit metadata → delete
4. **Outfits**: Generate → swipe through → swap items → interactions logged in DB
5. **Style**: After 5+ ratings → style profile activates → outfit ranking changes from random to personalized
