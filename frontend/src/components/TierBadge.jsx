// ============================================================
//  TierBadge.jsx
//  Displays Peak Cinema 🔥 / Masterpiece ✦ / etc.
//  Props:
//    tier  — string: "Peak Cinema" | "Masterpiece" |
//                    "Great Watch" | "Mid" | "Skip"
//    size  — "sm" | "md" | "lg"  (default "md")
// ============================================================

const TIERS = {
  "Peak Cinema": {
    icon:    "🔥",
    color:   "var(--tier-peak)",
    bg:      "var(--tier-peak-bg)",
    border:  "rgba(200,130,26,0.35)",
  },
  "Masterpiece": {
    icon:    "✦",
    color:   "var(--tier-master)",
    bg:      "var(--tier-master-bg)",
    border:  "rgba(212,160,23,0.35)",
  },
  "Great Watch": {
    icon:    "◎",
    color:   "var(--tier-great)",
    bg:      "var(--tier-great-bg)",
    border:  "rgba(45,156,219,0.35)",
  },
  "Mid": {
    icon:    "—",
    color:   "var(--tier-mid)",
    bg:      "var(--tier-mid-bg)",
    border:  "rgba(138,117,96,0.35)",
  },
  "Skip": {
    icon:    "✕",
    color:   "var(--tier-skip)",
    bg:      "var(--tier-skip-bg)",
    border:  "rgba(139,69,19,0.35)",
  },
}

const SIZE = {
  sm: { fontSize: "11px", padding: "2px 8px",  gap: "4px",  iconSize: "11px" },
  md: { fontSize: "13px", padding: "4px 12px", gap: "5px",  iconSize: "13px" },
  lg: { fontSize: "15px", padding: "6px 16px", gap: "6px",  iconSize: "16px" },
}

export default function TierBadge({ tier, size = "md" }) {
  const meta = TIERS[tier] ?? TIERS["Mid"]
  const sz   = SIZE[size]  ?? SIZE["md"]

  return (
    <span style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           sz.gap,
      fontSize:      sz.fontSize,
      fontWeight:    600,
      padding:       sz.padding,
      borderRadius:  "20px",
      color:         meta.color,
      background:    meta.bg,
      border:        `1px solid ${meta.border}`,
      letterSpacing: "0.02em",
      whiteSpace:    "nowrap",
      userSelect:    "none",
    }}>
      <span style={{ fontSize: sz.iconSize, lineHeight: 1 }}>
        {meta.icon}
      </span>
      {tier}
    </span>
  )
}