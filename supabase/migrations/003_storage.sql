-- Create storage bucket for garment images
INSERT INTO storage.buckets (id, name, public) VALUES ('garment-images', 'garment-images', true);

-- Storage policies: users can upload to their own folder
CREATE POLICY "Users can upload garment images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'garment-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view garment images" ON storage.objects
  FOR SELECT USING (bucket_id = 'garment-images');

CREATE POLICY "Users can update own garment images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'garment-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own garment images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'garment-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
