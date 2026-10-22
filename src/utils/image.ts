import * as ImageManipulator from "expo-image-manipulator";

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

export async function compressImage(uri: string): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_DIMENSION, height: null });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

export async function getImageBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Could not read the selected image");
  }
  return response.blob();
}
