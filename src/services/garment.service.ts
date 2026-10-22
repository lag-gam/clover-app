import { supabase } from "@/lib/supabase";
import { compressImage, getImageBlob } from "@/utils/image";
import {
  Formality,
  Garment,
  GarmentCategory,
  GarmentColor,
  GarmentFit,
  GarmentMaterial,
  GarmentPattern,
  GarmentSubtype,
  MetalTone,
} from "@/types/database";

export type IngestionStep =
  | "compressing"
  | "uploading_original"
  | "saving";

export type GarmentMetadataInput = {
  name: string;
  category: GarmentCategory;
  subtype: GarmentSubtype | null;
  metal_tone: MetalTone;
  color: GarmentColor;
  secondary_color: GarmentColor | null;
  pattern: GarmentPattern;
  material: GarmentMaterial;
  fit: GarmentFit;
  formality: Formality;
  tags: string[];
};

const STALE_PROCESSING_MS = 5 * 60 * 1000;

export function isGarmentProcessingStale(
  garment: Pick<
    Garment,
    "processing_status" | "processing_started_at" | "updated_at"
  >,
  now = Date.now()
): boolean {
  if (
    garment.processing_status !== "pending" &&
    garment.processing_status !== "processing"
  ) {
    return false;
  }

  const timestamp =
    garment.processing_status === "processing"
      ? garment.processing_started_at
      : garment.updated_at;
  if (!timestamp) return true;

  const startedAt = Date.parse(timestamp);
  return !Number.isFinite(startedAt) || now - startedAt >= STALE_PROCESSING_MS;
}

export async function createPendingGarment(
  imageUri: string,
  userId: string,
  onStep: (step: IngestionStep) => void
): Promise<Garment> {
  onStep("compressing");
  const compressedUri = await compressImage(imageUri);

  onStep("uploading_original");
  const fileName = `${userId}/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}_original.jpg`;
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

  onStep("saving");
  const { data, error } = await supabase
    .from("garments")
    .insert({
      user_id: userId,
      name: "Analyzing garment",
      category: "tops",
      subtype: null,
      metal_tone: "none",
      color: "multicolor",
      secondary_color: null,
      pattern: "solid",
      material: "other",
      fit: "regular",
      formality: 3,
      image_url: imageUrl,
      cutout_url: null,
      embedding: null,
      tags: [],
      processing_status: "pending",
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from("garment-images").remove([fileName]);
    throw new Error(`Save error: ${error.message}`);
  }

  queueGarmentProcessing(data.id);
  return data as Garment;
}

export function queueGarmentProcessing(garmentId: string): void {
  void supabase.functions
    .invoke("process-garment", { body: { garmentId } })
    .then(({ error }) => {
      if (error) {
        return markDispatchFailed(garmentId);
      }
    })
    .catch(() => markDispatchFailed(garmentId));
}

async function markDispatchFailed(garmentId: string): Promise<void> {
  const { error } = await supabase
    .from("garments")
    .update({
      processing_status: "failed",
      processing_error: "Could not start analysis. Please retry.",
      processing_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", garmentId)
    .eq("processing_status", "pending");

  if (error) {
    console.error("Could not record garment dispatch failure:", error.message);
  }
}

export async function retryGarmentProcessing(garmentId: string): Promise<void> {
  const { data: retried, error } = await supabase.rpc(
    "retry_garment_processing",
    { p_garment_id: garmentId }
  );

  if (error) throw new Error(`Retry error: ${error.message}`);
  if (!retried) {
    throw new Error("Analysis is already running or is not retryable yet.");
  }
  queueGarmentProcessing(garmentId);
}

export async function fetchGarments(
  userId: string,
  category?: string,
  includeProcessing = false
): Promise<Garment[]> {
  let query = supabase
    .from("garments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!includeProcessing) {
    query = query.eq("processing_status", "ready");
  }

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
