import { createServerFn } from "@tanstack/react-start";
import type { ScannedReceipt } from "@/lib/receipts/model";

export const readReceipt = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object" || typeof (input as { image?: unknown }).image !== "string") {
      return { image: "" };
    }
    return { image: (input as { image: string }).image };
  })
  .handler(async ({ data }): Promise<{ ok: true; receipt: ScannedReceipt } | { ok: false; error: string }> => {
    const image = data.image;
    if (!image.startsWith("data:image/jpeg;base64,") && !image.startsWith("data:image/png;base64,")) {
      return { ok: false, error: "Use a JPEG or PNG photo of the receipt." };
    }
    if (image.length > 1_800_000) {
      return { ok: false, error: "That photo is too large. Try a closer picture." };
    }
    const { readWithGrok } = await import("./scan.server");
    return readWithGrok(image);
  });
