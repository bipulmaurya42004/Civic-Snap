/**
 * CivicSnap Anti-Spam, Fraud-Prevention & Cryptographic Audit Utilities
 * - Pure deterministic functions for EXIF GPS/timestamp validation, perceptual
 *   image hashing (Hamming distance), daily limits, 50m/30-day cooldowns, and
 *   SHA-256 certificate hashing (runs synchronously in SSR, browser, and node:test).
 * - Browser utilities to read EXIF privately via `exifr`, strip EXIF via `<canvas>`,
 *   and compute a 64-bit average perceptual hash (aHash) prior to upload.
 */

export const MAX_EXIF_GPS_DRIFT_METERS = 500;
export const MAX_EXIF_AGE_HOURS = 24;
export const MAX_REPORTS_PER_DAY = 5;
export const LOCATION_COOLDOWN_METERS = 50;
export const LOCATION_COOLDOWN_DAYS = 30;
export const DUPLICATE_HASH_MAX_BIT_DISTANCE = 8; // <=8/64 bits (~87.5%+ perceptual similarity)

/**
 * Great-circle Haversine distance in meters between two WGS-84 coordinates.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Computes Hamming distance (differing bits) between two equal-length hex hashes.
 * Returns Infinity if either hash is invalid or lengths differ.
 */
export function computeHammingDistance(hashA: string, hashB: string): number {
  const a = (hashA || "").trim().toLowerCase();
  const b = (hashB || "").trim().toLowerCase();
  if (!a || !b || a.length !== b.length || !/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) {
    return Number.POSITIVE_INFINITY;
  }

  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    let xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

export function isDuplicateImageHash(
  hashA: string,
  hashB: string,
  maxBitDistance: number = DUPLICATE_HASH_MAX_BIT_DISTANCE
): boolean {
  const dist = computeHammingDistance(hashA, hashB);
  return Number.isFinite(dist) && dist <= maxBitDistance;
}

export interface ExifValidationInput {
  exifLat?: number | null;
  exifLng?: number | null;
  exifTimestampMs?: number | null;
  reportedLat?: number | null;
  reportedLng?: number | null;
  nowMs?: number;
}

export interface ExifFraudEvaluation {
  needsReview: boolean;
  reasons: string[];
  gpsDriftMeters: number | null;
  ageHours: number | null;
}

/**
 * Evaluates internal EXIF GPS & capture timestamp against reported GPS and current time.
 * Never returns raw EXIF values for public display — only boolean flag & sanitized reason strings.
 */
export function evaluateExifFraudFlags(
  input: ExifValidationInput
): ExifFraudEvaluation {
  const reasons: string[] = [];
  let gpsDriftMeters: number | null = null;
  let ageHours: number | null = null;

  const hasExifGps =
    typeof input.exifLat === "number" &&
    Number.isFinite(input.exifLat) &&
    typeof input.exifLng === "number" &&
    Number.isFinite(input.exifLng);

  const hasReportedGps =
    typeof input.reportedLat === "number" &&
    Number.isFinite(input.reportedLat) &&
    typeof input.reportedLng === "number" &&
    Number.isFinite(input.reportedLng);

  if (hasExifGps && hasReportedGps) {
    gpsDriftMeters = haversineDistanceMeters(
      input.exifLat as number,
      input.exifLng as number,
      input.reportedLat as number,
      input.reportedLng as number
    );
    if (gpsDriftMeters > MAX_EXIF_GPS_DRIFT_METERS) {
      reasons.push(
        `EXIF GPS mismatch (${gpsDriftMeters}m > ${MAX_EXIF_GPS_DRIFT_METERS}m from reported GPS)`
      );
    }
  }

  if (
    typeof input.exifTimestampMs === "number" &&
    Number.isFinite(input.exifTimestampMs)
  ) {
    const nowMs = input.nowMs ?? Date.now();
    const diffMs = nowMs - input.exifTimestampMs;
    ageHours = Math.max(0, Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10);
    if (diffMs > MAX_EXIF_AGE_HOURS * 60 * 60 * 1000) {
      reasons.push(
        `EXIF timestamp older than ${MAX_EXIF_AGE_HOURS} hours (${Math.floor(ageHours)}h old)`
      );
    }
  }

  return {
    needsReview: reasons.length > 0,
    reasons,
    gpsDriftMeters,
    ageHours,
  };
}

export interface DailyLimitEvaluation {
  allowed: boolean;
  usedToday: number;
  remaining: number;
  error?: string;
}

/**
 * Checks whether a citizen has reached the daily submission cap (max 5 reports/day).
 */
export function evaluateDailyLimit(
  reportCreatedAtIsos: readonly string[],
  nowMs: number = Date.now(),
  maxPerDay: number = MAX_REPORTS_PER_DAY
): DailyLimitEvaluation {
  const nowDate = new Date(nowMs);
  const startOfUtcDayMs = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate()
  );

  let usedToday = 0;
  for (const iso of reportCreatedAtIsos) {
    const ms = new Date(iso).getTime();
    if (Number.isFinite(ms) && ms >= startOfUtcDayMs) {
      usedToday += 1;
    }
  }

  const remaining = Math.max(0, maxPerDay - usedToday);
  if (usedToday >= maxPerDay) {
    return {
      allowed: false,
      usedToday,
      remaining: 0,
      error: `Daily limit reached (${maxPerDay} reports per day). Please try again tomorrow.`,
    };
  }

  return {
    allowed: true,
    usedToday,
    remaining,
  };
}

export interface LocationCooldownCandidate {
  id: string;
  privateLat?: number;
  privateLng?: number;
  createdAtIso: string;
  pointsAwarded?: number;
  status?: string;
}

export interface LocationCooldownEvaluation {
  onCooldown: boolean;
  nearestReportId?: string;
  distanceMeters?: number;
  reason?: string;
}

/**
 * Checks if a user already has a point-eligible or verified report within 50m
 * during the last 30 days so the same spot cannot farm points twice.
 */
export function evaluateLocationCooldown(
  existingReports: readonly LocationCooldownCandidate[],
  targetLat?: number | null,
  targetLng?: number | null,
  nowMs: number = Date.now(),
  radiusMeters: number = LOCATION_COOLDOWN_METERS,
  cooldownDays: number = LOCATION_COOLDOWN_DAYS
): LocationCooldownEvaluation {
  if (
    typeof targetLat !== "number" ||
    !Number.isFinite(targetLat) ||
    typeof targetLng !== "number" ||
    !Number.isFinite(targetLng)
  ) {
    return { onCooldown: false };
  }

  const cutoffMs = nowMs - cooldownDays * 24 * 60 * 60 * 1000;

  for (const item of existingReports) {
    if (
      typeof item.privateLat !== "number" ||
      !Number.isFinite(item.privateLat) ||
      typeof item.privateLng !== "number" ||
      !Number.isFinite(item.privateLng)
    ) {
      continue;
    }
    const createdMs = new Date(item.createdAtIso).getTime();
    if (!Number.isFinite(createdMs) || createdMs < cutoffMs) {
      continue;
    }
    const dist = haversineDistanceMeters(
      targetLat,
      targetLng,
      item.privateLat,
      item.privateLng
    );
    if (dist <= radiusMeters) {
      return {
        onCooldown: true,
        nearestReportId: item.id,
        distanceMeters: dist,
        reason: `Location cooldown active (${dist}m from report ${item.id} within ${cooldownDays} days — 0 CivicPoints eligible)`,
      };
    }
  }

  return { onCooldown: false };
}

/**
 * Pure synchronous SHA-256 hex digest (FIPS 180-4) for tamper-evident certificate
 * verification across SSR, browser, and Node unit tests with zero dependencies.
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function computeSha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((val) => val.toString(16).padStart(8, "0"))
    .join("");
}

/**
 * Browser-only: Reads EXIF GPS and timestamp privately via `exifr` for fraud checks.
 * Caller must NEVER render these raw EXIF coordinates/timestamps publicly.
 */
export async function extractExifPrivately(file: File): Promise<{
  exifLat: number | null;
  exifLng: number | null;
  exifTimestampMs: number | null;
}> {
  try {
    const exifrModule = await import("exifr");
    const exifr = exifrModule.default ?? exifrModule;
    const parsed = (await exifr.parse(file, {
      gps: true,
      pick: ["DateTimeOriginal", "CreateDate", "ModifyDate", "latitude", "longitude"],
    })) as
      | {
          latitude?: number;
          longitude?: number;
          DateTimeOriginal?: Date | string;
          CreateDate?: Date | string;
          ModifyDate?: Date | string;
        }
      | null
      | undefined;

    if (!parsed) {
      return { exifLat: null, exifLng: null, exifTimestampMs: null };
    }

    const exifLat =
      typeof parsed.latitude === "number" && Number.isFinite(parsed.latitude)
        ? parsed.latitude
        : null;
    const exifLng =
      typeof parsed.longitude === "number" && Number.isFinite(parsed.longitude)
        ? parsed.longitude
        : null;

    const rawDate =
      parsed.DateTimeOriginal ?? parsed.CreateDate ?? parsed.ModifyDate ?? null;
    let exifTimestampMs: number | null = null;
    if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
      exifTimestampMs = rawDate.getTime();
    } else if (typeof rawDate === "string") {
      const ms = new Date(rawDate).getTime();
      if (Number.isFinite(ms)) {
        exifTimestampMs = ms;
      }
    }

    return { exifLat, exifLng, exifTimestampMs };
  } catch {
    return { exifLat: null, exifLng: null, exifTimestampMs: null };
  }
}

/**
 * Browser-only: Computes a 64-bit grayscale average perceptual hash (16-char hex)
 * for client-side duplicate image detection.
 */
export async function computePerceptualImageHash(file: File): Promise<string> {
  if (typeof window === "undefined") {
    return "";
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image for hashing."));
      el.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.drawImage(img, 0, 0, 8, 8);
    const { data } = ctx.getImageData(0, 0, 8, 8);

    const gray: number[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray.push(luma);
      sum += luma;
    }

    const avg = sum / gray.length;
    let hex = "";
    for (let i = 0; i < 64; i += 4) {
      let nibble = 0;
      for (let bit = 0; bit < 4; bit += 1) {
        if (gray[i + bit] >= avg) {
          nibble |= 1 << (3 - bit);
        }
      }
      hex += nibble.toString(16);
    }
    return hex;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Browser-only: Strips all EXIF/GPS/camera metadata by re-encoding the image through
 * a clean `<canvas>` JPEG buffer (also bounding size under 200KB for fast upload).
 */
export async function stripExifAndOptimizeImage(file: File): Promise<{
  cleanFile: File;
  previewDataUrl: string;
  originalBytes: number;
  finalBytes: number;
}> {
  if (typeof window === "undefined") {
    return {
      cleanFile: file,
      previewDataUrl: "",
      originalBytes: file.size,
      finalBytes: file.size,
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image for EXIF stripping."));
      el.src = objectUrl;
    });

    const maxDim = 1280;
    let width = img.naturalWidth || img.width || 800;
    let height = img.naturalHeight || img.height || 600;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context unavailable.");
    }
    ctx.drawImage(img, 0, 0, width, height);

    const targetMaxBytes = 195 * 1024;
    let quality = 0.82;
    let blob: Blob | null = null;

    while (quality >= 0.4) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      if (blob && blob.size <= targetMaxBytes) {
        break;
      }
      quality -= 0.12;
    }

    if (!blob) {
      throw new Error("Could not encode EXIF-stripped JPEG.");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "capture";
    const cleanFile = new File([blob], `${baseName}-clean.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    const previewDataUrl = canvas.toDataURL("image/jpeg", Math.max(0.5, quality));

    return {
      cleanFile,
      previewDataUrl,
      originalBytes: file.size,
      finalBytes: cleanFile.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
