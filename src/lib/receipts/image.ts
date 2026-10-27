const MAX_EDGE = 1400;
const MAX_CHARS = 1_500_000;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    image.src = url;
  });
}

function exportJpeg(image: HTMLImageElement, edge: number, quality: number) {
  const scale = Math.min(1, edge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function compressReceiptImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo.");
  const image = await loadImage(file);
  let data = exportJpeg(image, MAX_EDGE, 0.72);
  if (data.length > MAX_CHARS) data = exportJpeg(image, 1100, 0.58);
  if (data.length > MAX_CHARS) data = exportJpeg(image, 800, 0.5);
  if (!data.startsWith("data:image/jpeg;base64,") || data.length > MAX_CHARS) {
    throw new Error("That photo is too large. Try a closer picture.");
  }
  return data;
}
