import sharp from "sharp";
import { createHash } from "node:crypto";

const cache = new Map();
export async function profileThumbnail(value = "") {
  if (typeof value !== "string" || !value.startsWith("data:"))
    return value || "";
  const key = createHash("sha256").update(value).digest("hex");
  if (cache.has(key)) return cache.get(key);
  const work = (async () => {
    const match =
      /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,([\s\S]+)$/.exec(value);
    if (!match) return "";
    try {
      const image = await sharp(Buffer.from(match[1], "base64"), {
        limitInputPixels: 40000000,
      })
        .rotate()
        .resize(96, 96, { fit: "cover", withoutEnlargement: true })
        .webp({ quality: 65 })
        .toBuffer();
      return `data:image/webp;base64,${image.toString("base64")}`;
    } catch {
      return "";
    }
  })();
  if (cache.size >= 128) cache.delete(cache.keys().next().value);
  cache.set(key, work);
  return work;
}
