import { useId } from "react";

interface CivicSnapLogoProps {
  iconOnly?: boolean;
  theme?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

const ICON_SIZES = {
  sm: 32,
  md: 40,
  lg: 50,
} as const;

const WORDMARK_CLASSES = {
  sm: "text-base",
  md: "text-[1.2rem]",
  lg: "text-[1.45rem]",
} as const;

/**
 * Updated CivicSnap brand emblem faithfully matching the pin-camera-city-leaf mark
 * with the two-tone CivicSnap wordmark for light and dark surfaces.
 */
export function CivicSnapLogo({
  iconOnly = false,
  theme = "light",
  size = "md",
  showTagline = false,
}: CivicSnapLogoProps) {
  const uid = useId().replace(/:/g, "");
  const px = ICON_SIZES[size];
  const isDark = theme === "dark";

  const pinGradId = `cs-pin-${uid}`;
  const leafGradId = `cs-leaf-${uid}`;
  const grassGradId = `cs-grass-${uid}`;
  const clipInnerId = `cs-inner-${uid}`;

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        width={px}
        height={px}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient
            id={pinGradId}
            x1="20"
            y1="14"
            x2="94"
            y2="98"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#00C6FF" />
            <stop offset="48%" stopColor="#0066E8" />
            <stop offset="100%" stopColor="#083090" />
          </linearGradient>

          <linearGradient
            id={leafGradId}
            x1="56"
            y1="112"
            x2="104"
            y2="58"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#65D638" />
            <stop offset="55%" stopColor="#28B53E" />
            <stop offset="100%" stopColor="#128A2E" />
          </linearGradient>

          <linearGradient
            id={grassGradId}
            x1="28"
            y1="72"
            x2="88"
            y2="88"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#5CD338" />
            <stop offset="100%" stopColor="#189B34" />
          </linearGradient>

          <clipPath id={clipInnerId}>
            <circle cx="57" cy="60" r="30.5" />
          </clipPath>
        </defs>

        {/* Inner white circle backdrop on dark surfaces for razor-sharp building contrast */}
        <circle
          cx="57"
          cy="60"
          r="30.5"
          fill={isDark ? "#F8FAFC" : "#FFFFFF"}
        />

        {/* Inner civic skyline + sweeping asphalt road + green verges */}
        <g clipPath={`url(#${clipInnerId})`}>
          {/* City buildings silhouette */}
          {/* Far left building */}
          <path d="M29 53L34.5 50.5V72H29V53Z" fill="#0B47B8" />
          <rect x="30.6" y="54.2" width="1.7" height="2.4" rx="0.3" fill="#FFFFFF" />
          <rect x="30.6" y="58.2" width="1.7" height="2.4" rx="0.3" fill="#FFFFFF" />
          <rect x="30.6" y="62.2" width="1.7" height="2.4" rx="0.3" fill="#FFFFFF" />

          {/* Second left building */}
          <path d="M36.5 46L44.5 42.5V71H36.5V46Z" fill="#0E53CE" />
          <rect x="38.2" y="47.4" width="2" height="2.6" rx="0.3" fill="#FFFFFF" />
          <rect x="41.2" y="46.2" width="2" height="2.6" rx="0.3" fill="#FFFFFF" />
          <rect x="38.2" y="51.6" width="2" height="2.6" rx="0.3" fill="#FFFFFF" />
          <rect x="41.2" y="50.5" width="2" height="2.6" rx="0.3" fill="#FFFFFF" />
          <rect x="38.2" y="55.8" width="2" height="2.6" rx="0.3" fill="#FFFFFF" />
          <rect x="41.2" y="54.8" width="2" height="2.6" rx="0.3" fill="#FFFFFF" />

          {/* Center hero skyscraper */}
          <path d="M47 36.5L56.5 31.5V69H47V36.5Z" fill="#0A45B5" />
          <path d="M56.5 31.5L62.5 36.5V69H56.5V31.5Z" fill="#073188" />
          <rect x="49.2" y="39" width="2.4" height="3" rx="0.4" fill="#FFFFFF" />
          <rect x="52.8" y="37.4" width="2.4" height="3" rx="0.4" fill="#FFFFFF" />
          <rect x="49.2" y="44" width="2.4" height="3" rx="0.4" fill="#FFFFFF" />
          <rect x="52.8" y="42.4" width="2.4" height="3" rx="0.4" fill="#FFFFFF" />
          <rect x="49.2" y="49" width="2.4" height="3" rx="0.4" fill="#FFFFFF" />
          <rect x="52.8" y="47.6" width="2.4" height="3" rx="0.4" fill="#FFFFFF" />
          <rect x="49.2" y="54" width="2.4" height="3" rx="0.4" fill="#FFFFFF" />
          <rect x="52.8" y="52.8" width="2.4" height="3" rx="0.4" fill="#FFFFFF" />
          <rect x="49.2" y="59" width="2.4" height="3" rx="0.4" fill="#FFFFFF" />
          <rect x="52.8" y="58" width="2.4" height="3" rx="0.4" fill="#FFFFFF" />

          {/* Fourth right building */}
          <path d="M64.5 44.5L71 41V69H64.5V44.5Z" fill="#0E53CE" />
          <path d="M71 41L75.5 44.5V69H71V41Z" fill="#073188" />
          <rect x="66.2" y="46.6" width="1.9" height="2.6" rx="0.3" fill="#FFFFFF" />
          <rect x="68.8" y="45.4" width="1.9" height="2.6" rx="0.3" fill="#FFFFFF" />
          <rect x="66.2" y="51" width="1.9" height="2.6" rx="0.3" fill="#FFFFFF" />
          <rect x="68.8" y="49.8" width="1.9" height="2.6" rx="0.3" fill="#FFFFFF" />
          <rect x="66.2" y="55.4" width="1.9" height="2.6" rx="0.3" fill="#FFFFFF" />
          <rect x="68.8" y="54.2" width="1.9" height="2.6" rx="0.3" fill="#FFFFFF" />

          {/* Far right small building */}
          <path d="M77.5 52.5L81.5 50L84.5 52.5V69H77.5V52.5Z" fill="#0B47B8" />
          <rect x="79.2" y="54.8" width="1.7" height="2.4" rx="0.3" fill="#FFFFFF" />
          <rect x="79.2" y="58.8" width="1.7" height="2.4" rx="0.3" fill="#FFFFFF" />

          {/* Curved white horizon arc separating skyline and road/grass */}
          <path
            d="M24 72C40 62 66 60 90 66V96H24V72Z"
            fill="#FFFFFF"
          />

          {/* Green roadside grass hills */}
          <path
            d="M24 74.5C40 65.5 64 63.5 89 68.5V95H24V74.5Z"
            fill={`url(#${grassGradId})`}
          />

          {/* Sweeping dark civic road */}
          <path
            d="M32 94C42 78 58 68 85 67.5C68 72.5 58 82 54 96H32V94Z"
            fill="#071E42"
          />

          {/* Dashed white lane markings along road curve */}
          <path
            d="M41.5 91.5C48.5 81 60 72.5 78 69.5"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="4.5 4.5"
          />
        </g>

        {/* Outer blue location-pin swoop merging into top-right camera head */}
        <path
          d="M52.5 111.5C50.7 110.2 15 84.8 15 55.5C15 29.5 35.8 11 61.5 11C67.5 11 72.8 12 77.6 13.7L80.2 8.8C81.2 7.1 83 6 85 6H94.8C96.8 6 98.6 7.1 99.6 8.8L102 13.4H105.5C110.2 13.4 114 17.2 114 21.9V35.2C114 40 110.2 43.8 105.5 43.8H95.5C90.2 43.8 85.4 41.3 81.4 37.9C74.8 32.3 66.4 29 57 29C39.8 29 26.5 42.6 26.5 59.8C26.5 76.2 39.4 89.2 55.6 90.3C57.6 90.4 59.3 92.2 58.6 94.1L54.9 109.7C54.6 111.3 53.6 112.3 52.5 111.5Z"
          fill={`url(#${pinGradId})`}
        />

        {/* Camera viewfinder pill + aperture lens on top-right */}
        <rect x="84.5" y="13.5" width="9.5" height="2.6" rx="1.3" fill="#FFFFFF" />
        <circle
          cx="95.5"
          cy="28.8"
          r="9.6"
          fill="#072D7A"
          stroke="#FFFFFF"
          strokeWidth="3.2"
        />
        <circle cx="96.8" cy="26.8" r="2.2" fill="#FFFFFF" />

        {/* Sweeping emerald green leaf forming bottom-right curve of pin */}
        <path
          d="M57.5 111.2C64.2 92.5 76.5 71 96.8 59.5C102.2 56.4 107.6 55.4 111.2 55.8C111.7 68.5 106.5 81.8 94.5 91.2C84.2 99.2 71.2 104.5 57.5 111.2Z"
          fill={`url(#${leafGradId})`}
        />
        {/* Crisp white leaf midrib / vein highlight */}
        <path
          d="M66.2 101.5C75.5 88.5 86.5 77.5 103.5 67.5"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeOpacity="0.92"
        />
      </svg>

      {!iconOnly && (
        <span className="flex flex-col leading-none">
          <span
            className={`font-heading font-extrabold tracking-tight ${WORDMARK_CLASSES[size]} ${
              isDark ? "text-white" : "text-[#0B1F3A]"
            }`}
          >
            Civic
            <span className={isDark ? "text-[#38BDF8]" : "text-[#0052D4]"}>
              Snap
            </span>
          </span>
          {showTagline && (
            <span
              className={`mt-1 text-[10px] font-medium tracking-wide ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Snap. Report. Track.
            </span>
          )}
        </span>
      )}
    </span>
  );
}
