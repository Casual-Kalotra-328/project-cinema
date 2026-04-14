// ============================================================
//  AvatarUpload.jsx
//  Profile picture upload component
//  Props:
//    user      — current user object
//    onUpdated — callback with updated user after upload
// ============================================================

import { useState, useRef } from "react"

const API = "http://localhost:8000"
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

function InitialsAvatar({ name, size = 64 }) {
  const initials = name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div style={{
      width:          size,
      height:         size,
      minWidth:       size,
      minHeight:      size,
      borderRadius:   "50%",
      background:     "var(--accent2)",
      border:         "2px solid var(--border)",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      fontSize:       size * 0.35,
      fontWeight:     700,
      color:          "var(--sand)",
      flexShrink:     0,
      userSelect:     "none",
      boxSizing:      "border-box",
    }}>
      {initials}
    </div>
  )
}

export function Avatar({ user, size = 64 }) {
  const common = {
    width:      size,
    height:     size,
    minWidth:   size,
    minHeight:  size,
    borderRadius: "50%",
    border:     "2px solid var(--border)",
    flexShrink: 0,
    boxSizing:  "border-box",
    overflow:   "hidden",
    background: "var(--surface)",
  }

  if (user?.avatar) {
    return (
      <div style={common}>
        <img
          src={user.avatar}
          alt={user.name}
          style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
        />
      </div>
    )
  }
  return <InitialsAvatar name={user?.name ?? "?"} size={size} />
}

export default function AvatarUpload({ user, onUpdated, showButton = true }) {
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState(null)
  const inputRef = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > MAX_SIZE) {
      setError("Image too large. Max 2MB.")
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Convert to base64
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch(`${API}/users/${user.id}/avatar`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ avatar: b64 }),
      })

      if (!res.ok) throw new Error((await res.json()).detail ?? "Upload failed")
      const updated = await res.json()
      const newUser = { ...user, avatar: b64 }
      localStorage.setItem("lumiere_user", JSON.stringify(newUser))
      onUpdated(newUser)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:"8px" }}>
      <div
        style={{
          position:  "relative",
          width:     80,
          height:    80,
          minWidth:  80,
          minHeight: 80,
          cursor:    "pointer",
          flexShrink: 0,
        }}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={e => e.currentTarget.querySelector('.overlay').style.opacity = "1"}
        onMouseLeave={e => { if (!uploading) e.currentTarget.querySelector('.overlay').style.opacity = "0" }}
      >
        <Avatar user={user} size={80} />
        <div className="overlay" style={{
          position:       "absolute",
          inset:          0,
          borderRadius:   "50%",
          background:     "rgba(26,18,8,0.45)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          opacity:        uploading ? 1 : 0,
          transition:     "opacity 0.15s",
          pointerEvents:  "none",
        }}>
          <span style={{ fontSize:"11px", color:"#fff", fontWeight:600, letterSpacing:"0.06em" }}>
            {uploading ? "…" : "EDIT"}
          </span>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      {/* Upload button */}
      {showButton && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            padding:"5px 14px", fontSize:"11px", letterSpacing:"0.1em",
            textTransform:"uppercase", background:"transparent",
            border:"1px solid var(--border2)", borderRadius:"6px",
            color:"var(--muted)", cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "Uploading…" : user?.avatar ? "Change photo" : "Upload photo"}
        </button>
      )}

      {error && (
        <p style={{ fontSize: "11px", color: "#8B4513", marginTop: "4px" }}>
          ⚠ {error}
        </p>
      )}
    </div>
  )
}