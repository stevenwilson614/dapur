/**
 * Phone photos are often 3–12MB. Base64 plus the model request blows past the
 * edge worker's 150MB/60s budget and Kong returns a bare 500. Shrink first.
 */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.78;

export async function fileToCompressedBase64(
  file: File
): Promise<{ image: string; media_type: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const base64 = dataUrl.split(",")[1];
    if (!base64) throw new Error("empty image");
    return { image: base64, media_type: "image/jpeg" };
  } catch {
    return readAsDataUrl(file);
  }
}

function readAsDataUrl(file: File): Promise<{ image: string; media_type: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that photo."));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        reject(new Error("Couldn't read that photo."));
        return;
      }
      const mediaType = dataUrl.slice(5, dataUrl.indexOf(";")) || file.type || "image/jpeg";
      resolve({ image: base64, media_type: mediaType });
    };
    reader.readAsDataURL(file);
  });
}
