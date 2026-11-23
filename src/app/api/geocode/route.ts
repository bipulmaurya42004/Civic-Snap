import { NextRequest, NextResponse } from "next/server";
import {
  detectHighPriorityZone,
  findNearestBengaluruWard,
  formatNominatimAddress,
  isValidCoordinatePair,
} from "@/lib/location-helpers";

export const runtime = "nodejs";

/**
 * Server-side Reverse Geocoding proxy using OpenStreetMap Nominatim with
 * strict coordinate validation, Nominatim-compliant User-Agent, timeout, and
 * deterministic Bengaluru Pilot Ward coordinate fallback if offline/rate-limited.
 */
export async function GET(request: NextRequest) {
  const latRaw = request.nextUrl.searchParams.get("lat");
  const lngRaw = request.nextUrl.searchParams.get("lng");

  const lat = latRaw !== null ? Number.parseFloat(latRaw) : Number.NaN;
  const lng = lngRaw !== null ? Number.parseFloat(lngRaw) : Number.NaN;

  if (!isValidCoordinatePair(lat, lng)) {
    return NextResponse.json(
      { error: "Valid numeric lat (-90..90) and lng (-180..180) are required." },
      { status: 400 }
    );
  }

  const roundedLat = Number(lat.toFixed(5));
  const roundedLng = Number(lng.toFixed(5));
  const nearestWard = findNearestBengaluruWard(roundedLat, roundedLng, 8);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      String(roundedLat)
    )}&lon=${encodeURIComponent(String(roundedLng))}&zoom=17&addressdetails=1`;

    const res = await fetch(nominatimUrl, {
      method: "GET",
      headers: {
        "User-Agent": "CivicSnap-BengaluruPilot/1.0 (civic-issue-tracker)",
        Accept: "application/json",
        "Accept-Language": "en",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.ok) {
      const data = (await res.json()) as {
        display_name?: string;
        address?: Record<string, string | undefined>;
      };
      const formatted = formatNominatimAddress(data);
      const matchedWard = formatted.matchedWard ?? nearestWard?.ward ?? null;
      const priority = detectHighPriorityZone({
        detectedAddress: formatted.readableAddress,
        locality: matchedWard ?? formatted.localityName,
        lat: roundedLat,
        lng: roundedLng,
      });

      return NextResponse.json({
        lat: roundedLat,
        lng: roundedLng,
        readableAddress: formatted.readableAddress,
        localityName: matchedWard ?? formatted.localityName,
        matchedWard,
        highPriorityZone: priority.isHighPriority,
        highPriorityReason: priority.reason,
        source: "nominatim",
      });
    }
  } catch {
    // Fall through to secondary reverse geocoder
  } finally {
    clearTimeout(timer);
  }

  // Secondary free global reverse geocoder (BigDataCloud) for reliable Indian & global addresses
  const bdcController = new AbortController();
  const bdcTimer = setTimeout(() => bdcController.abort(), 6000);
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
      String(roundedLat)
    )}&longitude=${encodeURIComponent(String(roundedLng))}&localityLanguage=en`;
    const bdcRes = await fetch(bdcUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: bdcController.signal,
      cache: "no-store",
    });

    if (bdcRes.ok) {
      const bdcData = (await bdcRes.json()) as {
        locality?: string;
        city?: string;
        principalSubdivision?: string;
        postcode?: string;
      };
      const area =
        bdcData.locality?.trim() || bdcData.city?.trim() || "";
      const city = bdcData.city?.trim() || bdcData.principalSubdivision?.trim() || "";
      const parts = [area, city, bdcData.postcode?.trim()].filter(
        (p, idx, arr): p is string =>
          Boolean(p) &&
          arr.findIndex((x) => x?.toLowerCase() === p?.toLowerCase()) === idx
      );
      if (parts.length > 0) {
        const readableAddress = parts.join(", ").slice(0, 160);
        const localityName = (nearestWard?.ward ?? area ?? city).slice(0, 80);
        const priority = detectHighPriorityZone({
          detectedAddress: readableAddress,
          locality: localityName,
          lat: roundedLat,
          lng: roundedLng,
        });
        return NextResponse.json({
          lat: roundedLat,
          lng: roundedLng,
          readableAddress,
          localityName,
          matchedWard: nearestWard?.ward ?? null,
          highPriorityZone: priority.isHighPriority,
          highPriorityReason: priority.reason,
          source: "bigdatacloud",
        });
      }
    }
  } catch {
    // Fall through to honest coordinate-based fallback
  } finally {
    clearTimeout(bdcTimer);
  }

  // Honest fallback when external geocoders are offline — never mislabel non-Bengaluru GPS as Bengaluru
  const fallbackAddress = nearestWard
    ? nearestWard.sampleStreet
    : `Live GPS (${roundedLat}, ${roundedLng})`;
  const fallbackLocality = nearestWard
    ? nearestWard.ward
    : `GPS (${roundedLat}, ${roundedLng})`;
  const priority = detectHighPriorityZone({
    detectedAddress: fallbackAddress,
    locality: fallbackLocality,
    lat: roundedLat,
    lng: roundedLng,
  });

  return NextResponse.json({
    lat: roundedLat,
    lng: roundedLng,
    readableAddress: fallbackAddress,
    localityName: fallbackLocality,
    matchedWard: nearestWard?.ward ?? null,
    highPriorityZone: priority.isHighPriority,
    highPriorityReason: priority.reason,
    source: "fallback",
  });
}
