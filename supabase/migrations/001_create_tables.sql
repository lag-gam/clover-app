-- Garments table
CREATE TABLE garments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories')),
  color TEXT NOT NULL,
  secondary_color TEXT,
  pattern TEXT NOT NULL DEFAULT 'solid',
  material TEXT NOT NULL DEFAULT 'cotton',
  fit TEXT NOT NULL DEFAULT 'regular',
  formality INTEGER NOT NULL DEFAULT 3 CHECK (formality BETWEEN 1 AND 5),
  image_url TEXT NOT NULL,
  cutout_url TEXT,
  embedding JSONB,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Outfits table
CREATE TABLE outfits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  embedding JSONB,
  score FLOAT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Outfit items (junction table)
CREATE TABLE outfit_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  outfit_id UUID REFERENCES outfits(id) ON DELETE CASCADE NOT NULL,
  garment_id UUID REFERENCES garments(id) ON DELETE CASCADE NOT NULL,
  slot TEXT NOT NULL
);

-- Interactions table (core training data)
CREATE TABLE interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  outfit_id UUID REFERENCES outfits(id) ON DELETE CASCADE NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('shown', 'skipped', 'liked', 'disliked', 'selected', 'worn', 'repeated', 'item_swapped')),
  swapped_garment_id UUID REFERENCES garments(id) ON DELETE SET NULL,
  replacement_garment_id UUID REFERENCES garments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Style profiles table
CREATE TABLE style_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  style_embedding JSONB,
  interaction_count INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_garments_user_id ON garments(user_id);
CREATE INDEX idx_garments_category ON garments(user_id, category);
CREATE INDEX idx_outfits_user_id ON outfits(user_id);
CREATE INDEX idx_outfit_items_outfit_id ON outfit_items(outfit_id);
CREATE INDEX idx_interactions_user_id ON interactions(user_id);
CREATE INDEX idx_interactions_outfit_id ON interactions(outfit_id);
CREATE INDEX idx_style_profiles_user_id ON style_profiles(user_id);
