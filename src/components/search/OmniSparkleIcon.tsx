import { useId } from "react";

/**
 * The custom "search + sparkle" AI omnibar icon (from Figma). A purple-gradient
 * magnifying glass with a sparkle, sized to 1em so it scales with the
 * container's font-size. Two gradient variants: `navbar` (#D4B4FE → #9F55F7,
 * brighter so it reads on the dark navbar) and `menu` (#B984FC → #7422CE, for
 * the light omni-search overlay).
 */
export function OmniSparkleIcon({
  className,
  variant = "menu",
}: {
  className?: string;
  variant?: "navbar" | "menu";
}) {
  const [from, to] =
    variant === "navbar" ? ["#D4B4FE", "#9F55F7"] : ["#B984FC", "#7422CE"];
  // Unique gradient id per instance — the icon mounts in both the navbar and
  // the search overlay, and duplicate SVG ids would cross-reference.
  const gradId = `omni-sparkle-grad-${useId()}`;
  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 15.5 15.7432"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5.6875 1.75C6.4281 1.75 7.1347 1.89266 7.7832 2.14941L7.5752 2.59863L6.43652 3.12793C6.19294 3.08545 5.94275 3.0625 5.6875 3.0625C3.28125 3.0625 1.3125 5.03125 1.3125 7.4375C1.3125 9.84375 3.28125 11.8125 5.6875 11.8125C6.89384 11.8125 7.98973 11.3172 8.7832 10.5205L8.82812 10.6172L8.83984 10.6426C9.11211 11.1871 9.65769 11.5 10.25 11.5C10.3808 11.5 10.5082 11.4821 10.6309 11.4512L13.8086 14.6289C14.0547 14.875 14.0547 15.3125 13.8086 15.5586C13.5625 15.8047 13.125 15.8047 12.8789 15.5586L9.21484 11.8945C8.25781 12.6602 7.02734 13.125 5.6875 13.125C2.54297 13.125 0 10.582 0 7.4375C0 4.29297 2.54297 1.75 5.6875 1.75Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M10.25 0C10.4609 0 10.6484 0.140625 10.7422 0.328125L12.1484 3.35156L15.1719 4.75781C15.3594 4.85156 15.5 5.03906 15.5 5.25C15.5 5.48438 15.3594 5.67188 15.1719 5.76562L12.1484 7.17188L10.7422 10.1953C10.6484 10.3828 10.4609 10.5 10.25 10.5C10.0156 10.5 9.82812 10.3828 9.73438 10.1953L8.32812 7.17188L5.30469 5.76562C5.11719 5.67188 5 5.48438 5 5.25C5 5.03906 5.11719 4.85156 5.30469 4.75781L8.32812 3.35156L9.73438 0.328125C9.82812 0.140625 10.0156 0 10.25 0ZM10.25 1.92188L9.26562 4.00781C9.21875 4.125 9.125 4.24219 8.98438 4.28906L6.89844 5.25L8.98438 6.23438C9.125 6.28125 9.21875 6.375 9.26562 6.51562L10.25 8.60156L11.2109 6.51562C11.2578 6.375 11.3516 6.28125 11.4922 6.23438L13.5781 5.25L11.4922 4.28906C11.375 4.24219 11.2578 4.14844 11.2109 4.00781L10.25 1.92188Z"
        fill={`url(#${gradId})`}
      />
      <defs>
        <linearGradient
          id={gradId}
          x1="13.75"
          y1="2.31226"
          x2="3.37408"
          y2="13.9794"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
    </svg>
  );
}
