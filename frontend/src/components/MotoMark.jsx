import React from "react";

/**
 * Custom motorcycle mark — unlike generic bicycle iconography,
 * this silhouette shows engine, fuel tank, exhaust, fork and wheels.
 * Inherits currentColor so it follows each tenant's theme.
 */
export default function MotoMark({ className = "h-5 w-5", ...props }) {
  return (
    <svg
      viewBox="0 0 52 34"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="10" cy="25" r="7" />
      <circle cx="42" cy="25" r="7" />
      <path d="m10 25 10-12 12 2 10 10M20 13l-4 12h15l-5-10" />
      <path d="M20 12c3-5 9-5 13-2l3 4-4 3-12-1z" fill="currentColor" fillOpacity=".26" strokeWidth="1.7" />
      <path d="M12 11h10m12-4 7-2m-6 2 5 18M16 27l-5 3" />
      <rect x="23" y="20" width="8" height="7" rx="2" fill="currentColor" fillOpacity=".28" strokeWidth="1.5" />
      <path d="m24 27 9 3h6" />
    </svg>
  );
}
