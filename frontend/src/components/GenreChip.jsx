// ============================================================
//  GenreChip.jsx
//  Displays a genre tag with icon + colour
//  Props:
//    name   — string e.g. "Action"
//    icon   — string e.g. "⚡"
//    color  — hex string e.g. "#E8712A"
//    size   — "sm" | "md"
// ============================================================

export default function GenreChip({ name, icon, color, size = "sm" }) {
  const fontSize = size === "md" ? "12px" : "11px"
  const padding  = size === "md" ? "3px 10px" : "2px 8px"

  // Derive a soft background from the color at low opacity
  const bg = color + "18"   // 18 = ~10% opacity in hex

  return (
    <span style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           "4px",
      fontSize,
      fontWeight:    500,
      padding,
      borderRadius:  "20px",
      color,
      background:    bg,
      border:        `1px solid ${color}40`,
      letterSpacing: "0.02em",
      whiteSpace:    "nowrap",
      userSelect:    "none",
    }}>
      <span style={{ fontSize: "10px", lineHeight: 1 }}>{icon}</span>
      {name}
    </span>
  )
}

// ── Helper: render a list of genre chips from an array ───────
export function GenreChipList({ chips = [], size = "sm" }) {
  if (!chips.length) return null
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {chips.map(c => (
        <GenreChip
          key={c.name}
          name={c.name}
          icon={c.icon}
          color={c.color}
          size={size}
        />
      ))}
    </div>
  )
}