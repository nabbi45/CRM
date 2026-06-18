import sharp from "sharp";

const MAX_IMAGE_DIMENSION = 1920;
const COMPRESSIBLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/tiff",
  "image/avif",
]);

const getCloudinaryResourceType = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "raw";
};

export const getCloudinaryPublicExtension = (file = {}) => {
  const extension = String(file?.originalname || "").split(".").pop();
  if (!extension || extension === String(file?.originalname || "")) return "";
  return extension.toLowerCase();
};

const shouldCompressImage = (file = {}) =>
  COMPRESSIBLE_IMAGE_TYPES.has(String(file?.mimetype || "").toLowerCase()) &&
  !String(file?.mimetype || "").toLowerCase().includes("svg");

const compressImageBuffer = async (file = {}) => {
  const image = sharp(file.buffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();

  if ((metadata.width || 0) > MAX_IMAGE_DIMENSION || (metadata.height || 0) > MAX_IMAGE_DIMENSION) {
    image.resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const mimeType = String(file.mimetype || "").toLowerCase();
  if (mimeType === "image/png") {
    image.png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: false,
    });
  } else if (mimeType === "image/webp") {
    image.webp({ quality: 84 });
  } else if (mimeType === "image/avif") {
    image.avif({ quality: 58 });
  } else if (mimeType === "image/tiff") {
    image.tiff({ quality: 84, compression: "jpeg" });
  } else {
    image.jpeg({
      quality: 84,
      mozjpeg: true,
      chromaSubsampling: "4:4:4",
    });
  }

  const compressedBuffer = await image.toBuffer();
  if (!compressedBuffer?.length || compressedBuffer.length >= file.buffer.length) {
    return {
      ...file,
      wasCompressed: false,
      originalSize: file.size || file.buffer.length,
      compressedSize: file.size || file.buffer.length,
    };
  }

  return {
    ...file,
    buffer: compressedBuffer,
    size: compressedBuffer.length,
    wasCompressed: true,
    originalSize: file.size || file.buffer.length,
    compressedSize: compressedBuffer.length,
  };
};

export const prepareUploadFile = async (file = {}) => {
  if (!file?.buffer) {
    return {
      ...file,
      resourceType: getCloudinaryResourceType(file?.mimetype || ""),
      originalSize: file?.size || 0,
      compressedSize: file?.size || 0,
      wasCompressed: false,
    };
  }

  if (!shouldCompressImage(file)) {
    return {
      ...file,
      resourceType: getCloudinaryResourceType(file.mimetype || ""),
      originalSize: file.size || file.buffer.length,
      compressedSize: file.size || file.buffer.length,
      wasCompressed: false,
    };
  }

  const compressedFile = await compressImageBuffer(file);
  return {
    ...compressedFile,
    resourceType: "image",
  };
};

export const prepareUploadFiles = async (files = []) => Promise.all((files || []).map((file) => prepareUploadFile(file)));

export const toDataUri = (file = {}) =>
  `data:${file.mimetype};base64,${Buffer.from(file.buffer).toString("base64")}`;
