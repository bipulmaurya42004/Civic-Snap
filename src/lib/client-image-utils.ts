"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

const UPLOAD_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)} seconds.`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function sanitizeStorageFilename(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

/**
 * Uploads an image File to Firebase Storage and returns its public HTTPS download URL.
 * Gracefully catches errors (such as Storage not enabled in Firebase Console) so callers
 * can surface helpful guidance without crashing.
 */
export async function uploadCivicPhotoToStorage(
  file: File,
  folderPath: string
): Promise<{ url: string | null; storagePath: string; error?: string }> {
  const safeName = sanitizeStorageFilename(file.name || "photo.jpg");
  const storagePath = `${folderPath.replace(/\/+$/, "")}/${Date.now()}-${safeName}`;

  if (!storage) {
    return {
      url: null,
      storagePath,
      error: "Firebase Storage is not initialized in this environment.",
    };
  }

  try {
    const fileRef = ref(storage, storagePath);
    const contentType =
      file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
    await withTimeout(
      uploadBytes(fileRef, file, { contentType }),
      UPLOAD_TIMEOUT_MS,
      "Firebase Storage upload"
    );
    const downloadUrl = await withTimeout(
      getDownloadURL(fileRef),
      UPLOAD_TIMEOUT_MS,
      "Firebase Storage URL fetch"
    );
    return { url: downloadUrl, storagePath };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not upload image to Firebase Storage.";
    return {
      url: null,
      storagePath,
      error: msg,
    };
  }
}

/**
 * Resizes a browser image File on an offscreen canvas (max 1024px) into a compact
 * JPEG base64 payload suitable for fast Gemini Vision analysis.
 */
export async function fileToCompactBase64(
  file: File,
  maxDimension = 1024
): Promise<{ mimeType: string; base64: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read selected image."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });

  // Try resizing via HTMLImageElement + canvas to keep payload fast and small
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image decode failed."));
      el.src = dataUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height, 1));
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const jpegUrl = canvas.toDataURL("image/jpeg", 0.82);
      const base64 = jpegUrl.split(",")[1] ?? "";
      if (base64.length > 20) {
        return { mimeType: "image/jpeg", base64 };
      }
    }
  } catch {
    // Fall back to raw DataURL if canvas decode fails (e.g., HEIC in some browsers)
  }

  const [header, rawBase64] = dataUrl.split(",");
  const mimeMatch = /^data:([^;]+);base64$/i.exec(header ?? "");
  const mimeType = mimeMatch?.[1]?.toLowerCase() || file.type || "image/jpeg";
  return {
    mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
    base64: rawBase64 ?? "",
  };
}
