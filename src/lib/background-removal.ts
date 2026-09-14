const REMOVEBG_API_KEY = process.env.EXPO_PUBLIC_REMOVEBG_API_KEY!;

export async function removeBackground(base64Image: string): Promise<string> {
  const formData = new FormData();
  formData.append("image_file_b64", base64Image);
  formData.append("size", "regular");
  formData.append("format", "png");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": REMOVEBG_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`remove.bg API error: ${err}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip the data:image/png;base64, prefix
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
