export const BENGALURU_PILOT_WARDS = [
  "Indiranagar",
  "Koramangala",
  "HSR Layout",
  "Whitefield",
  "Jayanagar",
  "MG Road",
  "Malleshwaram",
] as const;

export const MANUAL_WARD_OPTION = "Other (Type Manually)" as const;

export const REPORT_WARD_DROPDOWN_OPTIONS = [
  ...BENGALURU_PILOT_WARDS,
  MANUAL_WARD_OPTION,
] as const;

export type BengaluruPilotWard = (typeof BENGALURU_PILOT_WARDS)[number];

export interface WardCoordinateAnchor {
  ward: BengaluruPilotWard;
  lat: number;
  lng: number;
  sampleStreet: string;
}

export const BENGALURU_WARD_ANCHORS: readonly WardCoordinateAnchor[] = [
  {
    ward: "Indiranagar",
    lat: 12.9784,
    lng: 77.6408,
    sampleStreet: "12th Main Rd, Indiranagar",
  },
  {
    ward: "Koramangala",
    lat: 12.9352,
    lng: 77.6245,
    sampleStreet: "80 Feet Rd, Koramangala 4th Block",
  },
  {
    ward: "HSR Layout",
    lat: 12.9121,
    lng: 77.6446,
    sampleStreet: "27th Main Rd, HSR Layout Sector 1",
  },
  {
    ward: "Whitefield",
    lat: 12.9698,
    lng: 77.75,
    sampleStreet: "ITPL Main Rd, Whitefield",
  },
  {
    ward: "Jayanagar",
    lat: 12.9308,
    lng: 77.5838,
    sampleStreet: "11th Main Rd, Jayanagar 4th Block",
  },
  {
    ward: "MG Road",
    lat: 12.9756,
    lng: 77.6066,
    sampleStreet: "Mahatma Gandhi Rd, Central Bengaluru",
  },
  {
    ward: "Malleshwaram",
    lat: 13.0031,
    lng: 77.5643,
    sampleStreet: "8th Cross Rd, Malleshwaram",
  },
] as const;

interface SensitiveZonePoint {
  name: string;
  type: "hospital" | "school";
  ward: BengaluruPilotWard;
  lat: number;
  lng: number;
}

/**
 * Representative hospitals and schools across Bengaluru pilot wards used for
 * automatic coordinate-based High Priority Zone tagging (within 500m radius).
 */
const BENGALURU_SENSITIVE_ZONES: readonly SensitiveZonePoint[] = [
  {
    name: "CMH / Chinmaya Mission Hospital",
    type: "hospital",
    ward: "Indiranagar",
    lat: 12.9789,
    lng: 77.6447,
  },
  {
    name: "National Public School Indiranagar",
    type: "school",
    ward: "Indiranagar",
    lat: 12.9739,
    lng: 77.6461,
  },
  {
    name: "St. John's Medical College Hospital",
    type: "hospital",
    ward: "Koramangala",
    lat: 12.9298,
    lng: 77.6203,
  },
  {
    name: "National Public School Koramangala",
    type: "school",
    ward: "Koramangala",
    lat: 12.9355,
    lng: 77.6269,
  },
  {
    name: "Narayana Multispeciality Hospital HSR",
    type: "hospital",
    ward: "HSR Layout",
    lat: 12.9114,
    lng: 77.6386,
  },
  {
    name: "Freedom International School HSR",
    type: "school",
    ward: "HSR Layout",
    lat: 12.9082,
    lng: 77.6487,
  },
  {
    name: "Manipal Hospital Whitefield",
    type: "hospital",
    ward: "Whitefield",
    lat: 12.9844,
    lng: 77.7279,
  },
  {
    name: "Deens Academy Whitefield",
    type: "school",
    ward: "Whitefield",
    lat: 12.9675,
    lng: 77.7495,
  },
  {
    name: "Jayadeva / Cloudnine Hospital Jayanagar",
    type: "hospital",
    ward: "Jayanagar",
    lat: 12.9279,
    lng: 77.5829,
  },
  {
    name: "National College & Public School Jayanagar",
    type: "school",
    ward: "Jayanagar",
    lat: 12.9317,
    lng: 77.5844,
  },
  {
    name: "Bishop Cotton Boys' & Girls' School",
    type: "school",
    ward: "MG Road",
    lat: 12.9718,
    lng: 77.5994,
  },
  {
    name: "KC General Hospital Malleshwaram",
    type: "hospital",
    ward: "Malleshwaram",
    lat: 12.9963,
    lng: 77.5701,
  },
];

const HIGH_PRIORITY_KEYWORD_REGEX =
  /\b(hospital|clinic|medical|nursing\s+home|healthcare|emergency|trauma|school|college|university|academy|vidyalaya|kindergarten|preschool|daycare|campus|pediatric|manipal|st\.?\s*john|kc\s+general|bishop\s+cotton)\b/i;

export function isValidCoordinatePair(
  lat: unknown,
  lng: unknown
): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Great-circle Haversine distance in kilometers.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Builds the exact static Google Maps URL requested:
 * https://www.google.com/maps/search/?api=1&query={lat},{lng}
 */
export function buildGoogleMapsUrl(
  lat: number | null | undefined,
  lng: number | null | undefined
): string | null {
  if (!isValidCoordinatePair(lat, lng)) {
    return null;
  }
  const safeLat = Number((lat as number).toFixed(6));
  const safeLng = Number((lng as number).toFixed(6));
  return `https://www.google.com/maps/search/?api=1&query=${safeLat},${safeLng}`;
}

export function getBengaluruWardAnchor(
  wardName: string | null | undefined
): WardCoordinateAnchor | null {
  if (!wardName) return null;
  const normalized = wardName.trim().toLowerCase();
  return (
    BENGALURU_WARD_ANCHORS.find(
      (anchor) => anchor.ward.toLowerCase() === normalized
    ) ?? null
  );
}

/**
 * Matches a free-text address or locality string to one of the Bengaluru pilot wards.
 */
export function matchBengaluruWardFromText(
  text: string | null | undefined
): BengaluruPilotWard | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes("indiranagar") || lower.includes("indira nagar")) {
    return "Indiranagar";
  }
  if (lower.includes("koramangala") || lower.includes("kormangala")) {
    return "Koramangala";
  }
  if (lower.includes("hsr layout") || /\bhsr\b/.test(lower)) {
    return "HSR Layout";
  }
  if (lower.includes("whitefield") || lower.includes("itpl")) {
    return "Whitefield";
  }
  if (lower.includes("jayanagar") || lower.includes("jaya nagar")) {
    return "Jayanagar";
  }
  if (
    lower.includes("mg road") ||
    lower.includes("m.g. road") ||
    lower.includes("mahatma gandhi road") ||
    lower.includes("mahatma gandhi rd")
  ) {
    return "MG Road";
  }
  if (lower.includes("malleshwaram") || lower.includes("malleswaram")) {
    return "Malleshwaram";
  }
  return null;
}

/**
 * Finds the nearest Bengaluru pilot ward anchor within a configurable radius (default 6 km).
 */
export function findNearestBengaluruWard(
  lat: number,
  lng: number,
  maxRadiusKm = 6
): { ward: BengaluruPilotWard; distanceKm: number; sampleStreet: string } | null {
  if (!isValidCoordinatePair(lat, lng)) return null;

  let best: {
    ward: BengaluruPilotWard;
    distanceKm: number;
    sampleStreet: string;
  } | null = null;

  for (const anchor of BENGALURU_WARD_ANCHORS) {
    const dist = haversineDistanceKm(lat, lng, anchor.lat, anchor.lng);
    if (dist <= maxRadiusKm && (!best || dist < best.distanceKm)) {
      best = {
        ward: anchor.ward,
        distanceKm: Number(dist.toFixed(2)),
        sampleStreet: anchor.sampleStreet,
      };
    }
  }

  return best;
}

/**
 * Automatically detects whether an issue is in a High Priority Zone
 * (near a Hospital or School via keywords OR within 500m of known hospital/school coordinates).
 */
export function detectHighPriorityZone(input: {
  title?: string | null;
  description?: string | null;
  publicSummary?: string | null;
  locality?: string | null;
  detectedAddress?: string | null;
  surroundingLandmarks?: string | null;
  lat?: number | null;
  lng?: number | null;
  explicitFlag?: boolean | null;
}): { isHighPriority: boolean; reason: string | null } {
  if (input.explicitFlag === true) {
    return {
      isHighPriority: true,
      reason: "Hospital / School Zone",
    };
  }

  const combinedText = [
    input.title,
    input.description,
    input.publicSummary,
    input.locality,
    input.detectedAddress,
    input.surroundingLandmarks,
  ]
    .filter(Boolean)
    .join(" ");

  const keywordMatch = HIGH_PRIORITY_KEYWORD_REGEX.exec(combinedText);
  if (keywordMatch) {
    const term = keywordMatch[0].toLowerCase();
    const isMedical =
      term.includes("hosp") ||
      term.includes("clinic") ||
      term.includes("med") ||
      term.includes("nurs") ||
      term.includes("health") ||
      term.includes("emerg") ||
      term.includes("trauma") ||
      term.includes("pediatric") ||
      term.includes("manipal") ||
      term.includes("john") ||
      term.includes("kc");
    return {
      isHighPriority: true,
      reason: isMedical ? "Near Hospital / Medical Zone" : "Near School / Campus Zone",
    };
  }

  if (isValidCoordinatePair(input.lat, input.lng)) {
    for (const zone of BENGALURU_SENSITIVE_ZONES) {
      const distKm = haversineDistanceKm(
        input.lat as number,
        input.lng as number,
        zone.lat,
        zone.lng
      );
      if (distKm <= 0.6) {
        return {
          isHighPriority: true,
          reason:
            zone.type === "hospital"
              ? `Near ${zone.name}`
              : `Near ${zone.name}`,
        };
      }
    }
  }

  return { isHighPriority: false, reason: null };
}

/**
 * Formats an OpenStreetMap Nominatim reverse-geocode payload into a concise,
 * human-readable street + locality string (e.g., "12th Main Rd, Indiranagar").
 */
export function formatNominatimAddress(payload: {
  display_name?: string;
  address?: Record<string, string | undefined>;
}): { readableAddress: string; localityName: string; matchedWard: BengaluruPilotWard | null } {
  const addr = payload.address ?? {};
  const road =
    addr.road ||
    addr.pedestrian ||
    addr.residential ||
    addr.neighbourhood ||
    addr.amenity ||
    "";
  const area =
    addr.suburb ||
    addr.neighbourhood ||
    addr.quarter ||
    addr.city_district ||
    addr.town ||
    addr.village ||
    addr.city ||
    "";

  const matchedWard =
    matchBengaluruWardFromText(
      [area, road, addr.suburb, addr.neighbourhood, payload.display_name]
        .filter(Boolean)
        .join(", ")
    ) ?? null;

  const primaryLocality = matchedWard || area || addr.city || "Detected Location";
  const parts = [road, primaryLocality].filter(
    (part, idx, arr) =>
      Boolean(part) &&
      arr.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === idx
  );

  const readableAddress = (
    parts.length > 0
      ? parts.join(", ")
      : (payload.display_name ?? "")
          .split(",")
          .slice(0, 2)
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ") || primaryLocality
  ).slice(0, 160);

  return {
    readableAddress,
    localityName: primaryLocality.slice(0, 80),
    matchedWard,
  };
}
