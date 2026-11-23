import type { ContributorProfile, PublicIssueRecord } from "@/types/civic";

/**
 * Fixed reference date for deterministic demo age badges and date-range filters.
 */
export const DEMO_REFERENCE_DATE = new Date("2026-11-21T18:00:00.000Z");

export const DEMO_PROFILES: readonly ContributorProfile[] = [
  { userId: "demo-u1", alias: "CommuterNorth", leaderboardOptIn: true },
  { userId: "demo-u2", alias: "CivicWalker", leaderboardOptIn: true },
  { userId: "demo-u3", alias: "StreetWatch04", leaderboardOptIn: true },
  { userId: "demo-u4", alias: "PrivateResident", leaderboardOptIn: false },
] as const;

/**
 * Clearly fictional read-only demonstration dataset.
 * Never written to production databases or mixed with live production metrics.
 */
export const DEMO_ISSUES: readonly PublicIssueRecord[] = [
  {
    id: "CS-DEMO-101",
    title: "Deep asphalt pothole near Indiranagar school crossing",
    category: "pothole",
    locality: "Indiranagar",
    status: "pending",
    reviewState: "accepted",
    publicSummary:
      "Gravel-filled surface depression along the outer curb lane on 12th Main Rd in Indiranagar, just 120m from the primary school crossing.",
    createdAt: "2026-11-18T09:15:00.000Z",
    updatedAt: "2026-11-18T14:30:00.000Z",
    demoImageUrl: "/demo/pothole.jpg",
    demoImageAlt: "Sample road pothole filled with gravel near an urban curb",
    lat: 12.9739,
    lng: 77.6461,
    detectedAddress: "12th Main Rd, Indiranagar",
    highPriorityZone: true,
    surroundingLandmarks:
      "High-traffic market road ~120m from a primary school crossing and commuter bus stop",
    materialEstimate:
      "~60 kg hot-mix asphalt, 20 kg crushed aggregate base, 2L bitumen tack coat, 3 crew labor hours",
    socialImpactScore: 86,
    economicCostOfDelay:
      "Est. ₹32,000–₹54,000 over 30 days in two-wheeler wheel/suspension damage and peak-hour traffic congestion",
    aiSuggestionNote:
      "Suggested Pothole / Road Damage from photo. Reporter reviewed and kept the category.",
    isDemo: true,
    reporterId: "demo-u1",
    timeline: [
      {
        id: "ev-101-1",
        eventType: "submitted",
        statusTransition: "pending",
        label: "Report submitted",
        note: "Photo-based report logged via GPS at 12th Main Rd, Indiranagar.",
        actorLabel: "Reporter (alias hidden publicly)",
        createdAt: "2026-11-18T09:15:00.000Z",
      },
      {
        id: "ev-101-2",
        eventType: "reviewed",
        label: "Accepted by project team",
        note: "Reviewed as a distinct report and approved for public summary listing.",
        actorLabel: "CivicSnap Project Team",
        createdAt: "2026-11-18T14:30:00.000Z",
      },
    ],
  },
  {
    id: "CS-DEMO-102",
    title: "Overflowing sidewalk waste bin near St. John's Hospital road",
    category: "waste",
    locality: "Koramangala",
    status: "in_progress",
    reviewState: "accepted",
    publicSummary:
      "Public sidewalk waste container overflowing with stacked bags and loose cardboard spilling toward the curb along 80 Feet Rd in Koramangala near the hospital entrance.",
    createdAt: "2026-11-16T07:45:00.000Z",
    updatedAt: "2026-11-19T11:10:00.000Z",
    demoImageUrl: "/demo/waste.jpg",
    demoImageAlt: "Sample overflowing municipal waste bin and stacked garbage bags on a sidewalk",
    lat: 12.9298,
    lng: 77.6203,
    detectedAddress: "80 Feet Rd, Koramangala 4th Block",
    highPriorityZone: true,
    surroundingLandmarks:
      "Busy neighborhood market footpath adjacent to local food vendors and hospital clinic entrance",
    materialEstimate:
      "1 municipal compactor pickup, ~25L surface disinfectant, 1 replacement 240L bin liner, 2 sanitation workers (2 labor hours)",
    socialImpactScore: 79,
    economicCostOfDelay:
      "Est. ₹18,000–₹35,000 over 30 days in sanitation health risks, pest cleanup, and lost shopfront footfall",
    aiSuggestionNote:
      "Suggested Garbage / Waste from photo. Reporter edited title for clarity.",
    isDemo: true,
    reporterId: "demo-u2",
    timeline: [
      {
        id: "ev-102-1",
        eventType: "submitted",
        statusTransition: "pending",
        label: "Report submitted",
        note: "Initial report submitted with manual locality selection.",
        actorLabel: "Reporter (alias hidden publicly)",
        createdAt: "2026-11-16T07:45:00.000Z",
      },
      {
        id: "ev-102-2",
        eventType: "reviewed",
        label: "Accepted by project team",
        note: "Approved for safe public display without raw private location coordinates.",
        actorLabel: "CivicSnap Project Team",
        createdAt: "2026-11-16T15:20:00.000Z",
      },
      {
        id: "ev-102-3",
        eventType: "status_changed",
        statusTransition: "in_progress",
        label: "Marked In Progress",
        note: "Prototype status updated to In Progress while community volunteer follow-up is logged.",
        actorLabel: "CivicSnap Project Team",
        createdAt: "2026-11-19T11:10:00.000Z",
      },
    ],
  },
  {
    id: "CS-DEMO-103",
    title: "Unlit residential street lamp after dusk on 27th Main",
    category: "streetlight",
    locality: "HSR Layout",
    status: "pending",
    reviewState: "accepted",
    publicSummary:
      "Streetlight pole along the residential footpath on 27th Main Rd in HSR Layout remained unlit during evening hours while neighboring lamps on the same block were operating.",
    createdAt: "2026-11-14T18:40:00.000Z",
    updatedAt: "2026-11-15T10:05:00.000Z",
    demoImageUrl: "/demo/streetlight.jpg",
    demoImageAlt: "Sample unlit streetlight pole along a twilight residential sidewalk",
    lat: 12.9121,
    lng: 77.6446,
    detectedAddress: "27th Main Rd, HSR Layout Sector 1",
    highPriorityZone: false,
    surroundingLandmarks:
      "Residential pedestrian walkway connecting evening transit stop and local commuter lane",
    materialEstimate:
      "1 70W LED luminaire assembly, ~8m weatherproof cable, 1 bucket truck + 2 electricians (1.5 labor hours)",
    socialImpactScore: 74,
    economicCostOfDelay:
      "Est. ₹15,000–₹28,000 over 30 days in heightened evening trip/collision risk and commuter safety exposure",
    aiSuggestionNote:
      "Evening photo suggested Streetlight. Reporter confirmed fixture stayed dark after sunset.",
    isDemo: true,
    reporterId: "demo-u1",
    timeline: [
      {
        id: "ev-103-1",
        eventType: "submitted",
        statusTransition: "pending",
        label: "Report submitted",
        note: "Evening photo uploaded with ward HSR Layout.",
        actorLabel: "Reporter (alias hidden publicly)",
        createdAt: "2026-11-14T18:40:00.000Z",
      },
      {
        id: "ev-103-2",
        eventType: "reviewed",
        label: "Accepted by project team",
        note: "Verified as a clear evening report and published to demo tracker.",
        actorLabel: "CivicSnap Project Team",
        createdAt: "2026-11-15T10:05:00.000Z",
      },
    ],
  },
  {
    id: "CS-DEMO-104",
    title: "Cracked concrete pavement near Indiranagar pedestrian crossing",
    category: "pothole",
    locality: "Indiranagar",
    status: "resolved",
    reviewState: "accepted",
    publicSummary:
      "Broken concrete section beside the pedestrian crossing apron on 100 Feet Rd in Indiranagar patched and cleared of loose rubble.",
    createdAt: "2026-11-05T10:20:00.000Z",
    updatedAt: "2026-11-12T16:45:00.000Z",
    demoImageUrl: "/demo/pothole.jpg",
    demoImageAlt: "Damaged road surface before repair",
    beforeImageURL: "/demo/pothole.jpg",
    afterImageURL: "/demo/pothole-fixed.jpg",
    lat: 12.9784,
    lng: 77.6408,
    detectedAddress: "100 Feet Rd, Indiranagar",
    highPriorityZone: true,
    verificationStatus: "verified",
    verificationReason:
      "The after photo confirms the cracked road edge and loose gravel have been freshly resurfaced into a smooth, level pavement.",
    surroundingLandmarks:
      "Marked pedestrian crossing apron beside local school zone and neighborhood clinic",
    materialEstimate:
      "~45 kg rapid-set concrete patch mortar, 10 kg aggregate fill, 1.5L bonding primer, 2.5 crew labor hours",
    socialImpactScore: 82,
    economicCostOfDelay:
      "Est. ₹24,000–₹42,000 over 30 days in pedestrian trip hazards and curb-lane tire damage (averted by repair)",
    isDemo: true,
    reporterId: "demo-u3",
    timeline: [
      {
        id: "ev-104-1",
        eventType: "submitted",
        statusTransition: "pending",
        label: "Report submitted",
        note: "Submitted via mobile browser with GPS coordinates in Indiranagar.",
        actorLabel: "Reporter (alias hidden publicly)",
        createdAt: "2026-11-05T10:20:00.000Z",
      },
      {
        id: "ev-104-2",
        eventType: "status_changed",
        statusTransition: "in_progress",
        label: "Marked In Progress",
        note: "Prototype review logged active follow-up note.",
        actorLabel: "CivicSnap Project Team",
        createdAt: "2026-11-08T12:00:00.000Z",
      },
      {
        id: "ev-104-3",
        eventType: "status_changed",
        statusTransition: "resolved",
        label: "AI Fix Verified · Marked Resolved",
        note: "Gemini Vision compared the Before and After photos and returned Verified. +25 CivicPoints credited to reporter.",
        actorLabel: "Gemini Vision + CivicSnap Project Team",
        createdAt: "2026-11-12T16:45:00.000Z",
      },
    ],
  },
  {
    id: "CS-DEMO-105",
    title: "Blocked stormwater grate with dry leaves and debris",
    category: "other",
    locality: "Whitefield",
    status: "resolved",
    reviewState: "accepted",
    publicSummary:
      "Roadside drain inlet covered by packed debris near the ITPL Main Rd corner bus stop in Whitefield. Cleared and confirmed open.",
    createdAt: "2026-10-28T08:30:00.000Z",
    updatedAt: "2026-11-04T15:15:00.000Z",
    lat: 12.9698,
    lng: 77.75,
    detectedAddress: "ITPL Main Rd, Whitefield",
    highPriorityZone: false,
    isDemo: true,
    reporterId: "demo-u4",
    timeline: [
      {
        id: "ev-105-1",
        eventType: "submitted",
        statusTransition: "pending",
        label: "Report submitted",
        note: "Manual category Other / Unsure chosen by reporter.",
        actorLabel: "Reporter (alias hidden publicly)",
        createdAt: "2026-10-28T08:30:00.000Z",
      },
      {
        id: "ev-105-2",
        eventType: "status_changed",
        statusTransition: "resolved",
        label: "Marked Resolved",
        note: "Demo status closed after follow-up check.",
        actorLabel: "CivicSnap Project Team",
        createdAt: "2026-11-04T15:15:00.000Z",
      },
    ],
  },
  {
    id: "CS-DEMO-106",
    title: "Dumped construction rubble along footpath shoulder",
    category: "waste",
    locality: "Jayanagar",
    status: "pending",
    reviewState: "accepted",
    publicSummary:
      "Small pile of broken tiles and masonry sacks left along the footpath shoulder on 11th Main Rd in Jayanagar, narrowing walking space.",
    createdAt: "2026-11-19T13:10:00.000Z",
    updatedAt: "2026-11-20T09:00:00.000Z",
    lat: 12.9308,
    lng: 77.5838,
    detectedAddress: "11th Main Rd, Jayanagar 4th Block",
    highPriorityZone: false,
    isDemo: true,
    reporterId: "demo-u1",
    timeline: [
      {
        id: "ev-106-1",
        eventType: "submitted",
        statusTransition: "pending",
        label: "Report submitted",
        note: "Submitted using Bengaluru pilot ward selector (Jayanagar).",
        actorLabel: "Reporter (alias hidden publicly)",
        createdAt: "2026-11-19T13:10:00.000Z",
      },
      {
        id: "ev-106-2",
        eventType: "reviewed",
        label: "Accepted by project team",
        note: "Accepted for public summary feed.",
        actorLabel: "CivicSnap Project Team",
        createdAt: "2026-11-20T09:00:00.000Z",
      },
    ],
  },
];

export function getDemoIssueById(id: string): PublicIssueRecord | undefined {
  return DEMO_ISSUES.find((item) => item.id.toLowerCase() === id.toLowerCase());
}
