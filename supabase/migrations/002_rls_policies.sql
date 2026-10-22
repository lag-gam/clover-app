-- Enable RLS on all tables
ALTER TABLE garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_profiles ENABLE ROW LEVEL SECURITY;

-- Garments: users can only access their own
CREATE POLICY "Users can view own garments" ON garments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own garments" ON garments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own garments" ON garments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own garments" ON garments
  FOR DELETE USING (auth.uid() = user_id);

-- Outfits: users can only access their own
CREATE POLICY "Users can view own outfits" ON outfits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own outfits" ON outfits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own outfits" ON outfits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own outfits" ON outfits
  FOR DELETE USING (auth.uid() = user_id);

-- Outfit items: access through outfit ownership
CREATE POLICY "Users can view own outfit items" ON outfit_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM outfits WHERE outfits.id = outfit_items.outfit_id AND outfits.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own outfit items" ON outfit_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM outfits WHERE outfits.id = outfit_items.outfit_id AND outfits.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own outfit items" ON outfit_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM outfits WHERE outfits.id = outfit_items.outfit_id AND outfits.user_id = auth.uid())
  );

-- Interactions: users can only access their own
CREATE POLICY "Users can view own interactions" ON interactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interactions" ON interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Style profiles: users can only access their own
CREATE POLICY "Users can view own style profile" ON style_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own style profile" ON style_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own style profile" ON style_profiles
  FOR UPDATE USING (auth.uid() = user_id);
