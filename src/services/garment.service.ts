import { supabase } from "@/lib/supabase";
import { extractGarmentMetadata, generateEmbedding } from "@/lib/openai";
import { removeBackground } from "@/lib/background-removal";
import { compressImage, imageToBase64, getImageBlob } from "@/utils/image";
import { Garment } from "@/types/database";
import { File, Paths } from "expo-file-system";

export type IngestionStep =
  | "compressing"
  | "uploading_original"
  | "removing_background"
  | "uploading_cutout"
  | "analyzing"
  | "generating_embedding"
  | "saving";

export type GarmentMetadataInput = {
  name: string;
  category: string;
  color: string;
  secondary_color: string | null;
  pattern: string;
  material: string;
  fit: string;
  formality: number;
  tags: string[];
};

export async function ingestGarment(
  imageUri: string,
  userId: string,
  onStep: (step: IngestionStep) => void
): Promise<{ metadata: GarmentMetadataInput; imageUrl: string; cutoutUrl: string | null; embedding: number[] }> {
  // 1. Compress image
  onStep("compressing");
  const compressedUri = await compressImage(imageUri);
  const base64 = await imageToBase64(compressedUri);

  // 2. Upload original to Supabase Storage
  onStep("uploading_original");
  const fileName = `${userId}/${Date.now()}_original.jpg`;
  const imageBlob = await getImageBlob(compressedUri);

  const { error: uploadError } = await supabase.storage
    .from("garment-images")
    .upload(fileName, imageBlob, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

  const {
    data: { publicUrl: imageUrl },
  } = supabase.storage.from("garment-images").getPublicUrl(fileName);

  // 3. Remove background
  onStep("removing_background");
  let cutoutUrl: string | null = null;
  try {
    const cutoutBase64 = await removeBackground(base64);
    const cutoutFileName = `${userId}/${Date.now()}_cutout.png`;

    // Write base64 to temp file then upload
    const tempFile = new File(Paths.cache, `cutout_${Date.now()}.png`);
    const binaryStr = atob(cutoutBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    tempFile.write(bytes);
    const tempPath = tempFile.uri;

    onStep("uploading_cutout");
    const cutoutBlob = await getImageBlob(tempPath);
    const { error: cutoutUploadError } = await supabase.storage
      .from("garment-images")
      .upload(cutoutFileName, cutoutBlob, {
        contentType: "image/png",
        upsert: false,
      });

    if (!cutoutUploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("garment-images").getPublicUrl(cutoutFileName);
      cutoutUrl = publicUrl;
    }
  } catch (e) {
    console.warn("Background removal failed, continuing without cutout:", e);
  }

  // 4. Extract metadata with Vision API
  onStep("analyzing");
  const metadata = await extractGarmentMetadata(base64);

  // 5. Generate embedding
  onStep("generating_embedding");
  const embedding = await generateEmbedding(metadata);

  return { metadata, imageUrl, cutoutUrl, embedding };
}

export async function saveGarment(
  userId: string,
  metadata: GarmentMetadataInput,
  imageUrl: string,
  cutoutUrl: string | null,
  embedding: number[]
): Promise<Garment> {
  const { data, error } = await supabase
    .from("garments")
    .insert({
      user_id: userId,
      name: metadata.name,
      category: metadata.category,
      color: metadata.color,
      secondary_color: metadata.secondary_color,
      pattern: metadata.pattern,
      material: metadata.material,
      fit: metadata.fit,
      formality: metadata.formality,
      image_url: imageUrl,
      cutout_url: cutoutUrl,
      embedding: embedding,
      tags: metadata.tags,
    })
    .select()
    .single();

  if (error) throw new Error(`Save error: ${error.message}`);
  return data as Garment;
}

export async function fetchGarments(
  userId: string,
  category?: string
): Promise<Garment[]> {
  let query = supabase
    .from("garments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Fetch error: ${error.message}`);
  return (data ?? []) as Garment[];
}

export async function updateGarment(
  id: string,
  updates: Partial<GarmentMetadataInput>
): Promise<Garment> {
  const { data, error } = await supabase
    .from("garments")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Update error: ${error.message}`);
  return data as Garment;
}

export async function deleteGarment(id: string): Promise<void> {
  const { error } = await supabase.from("garments").delete().eq("id", id);
  if (error) throw new Error(`Delete error: ${error.message}`);
}
