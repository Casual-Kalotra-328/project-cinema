import { useState } from "react"

const API = "http://localhost:8000"

function Logo() {
  return (
    <svg width="48" height="48" viewBox="0 0 28 28" fill="none" style={{ margin:"0 auto 16px", display:"block" }}>
      <polygon points="14,10 6,0 10,0"  fill="#C8821A" opacity="0.3"/>
      <polygon points="14,10 11,0 17,0" fill="#D4A017" opacity="0.4"/>
      <polygon points="14,10 18,0 22,0" fill="#C8821A" opacity="0.3"/>
      <circle cx="14" cy="17" r="10" fill="none" stroke="#8A5208" strokeWidth="1.8"/>
      <circle cx="14" cy="17" r="2.5" fill="#8A5208"/>
      <line x1="14" y1="14.5" x2="14" y2="9"  stroke="#8A5208" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="14" y1="19.5" x2="14" y2="25" stroke="#8A5208" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="11.5" y1="17" x2="6"  y2="17" stroke="#8A5208" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="16.5" y1="17" x2="22" y2="17" stroke="#8A5208" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="14" cy="7"  r="1.5" fill="#E8D5A3" stroke="#8A5208" strokeWidth="1"/>
      <circle cx="14" cy="27" r="1.5" fill="#E8D5A3" stroke="#8A5208" strokeWidth="1"/>
      <circle cx="4"  cy="17" r="1.5" fill="#E8D5A3" stroke="#8A5208" strokeWidth="1"/>
      <circle cx="24" cy="17" r="1.5" fill="#E8D5A3" stroke="#8A5208" strokeWidth="1"/>
    </svg>
  )
}

const inputStyle = {
  width:"100%", padding:"12px 16px", fontSize:"14px",
  background:"var(--sand)", border:"1px solid var(--border)",
  borderRadius:"8px", color:"var(--text)", outline:"none",
  marginBottom:"12px", textAlign:"center", fontFamily:"inherit",
}

const btnStyle = (disabled) => ({
  width:"100%", padding:"12px", fontSize:"12px",
  letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600,
  background: disabled ? "var(--muted2)" : "var(--accent2)",
  color:"var(--sand)", border:"none", borderRadius:"8px",
  cursor: disabled ? "not-allowed" : "pointer", transition:"background 0.2s",
})

export default function UserSetup({ onComplete }) {
  const [tab,     setTab]     = useState("new")   // "new" | "returning"
  const [name,    setName]    = useState("")
  const [email,   setEmail]   = useState("")
  const [userId,  setUserId]  = useState("")
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`${API}/users`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ name:name.trim(), email:email.trim()||null }),
      })
      if (!res.ok) throw new Error("Failed to create account")
      const user = await res.json()
      localStorage.setItem("lumiere_user", JSON.stringify(user))
      onComplete(user)
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleReturn() {
    if (!userId.trim()) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`${API}/users/${userId.trim()}`)
      if (!res.ok) throw new Error("User not found. Check your ID.")
      const user = await res.json()
      localStorage.setItem("lumiere_user", JSON.stringify(user))
      onComplete(user)
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{
      position:"fixed", inset:0, background:"var(--bg)", zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center", padding:"20px",
    }}>
      <div style={{
        background:"var(--surface)", border:"1px solid var(--border2)",
        borderRadius:"14px", padding:"40px", width:"100%", maxWidth:"420px",
        textAlign:"center",
      }}>
        <Logo />

        <h1 style={{
          fontSize:"24px", fontWeight:700, color:"var(--accent2)",
          fontFamily:"Georgia, serif", marginBottom:"6px",
        }}>
          Welcome to Lumière
        </h1>
        <p style={{ fontSize:"13px", color:"var(--muted)", marginBottom:"28px", lineHeight:1.6 }}>
          Find your next Peak Cinema moment.
        </p>

        {/* Tabs */}
        <div style={{
          display:"flex", borderBottom:"1px solid var(--border)", marginBottom:"24px",
        }}>
          {[{id:"new",label:"New user"},{id:"returning",label:"Returning user"}].map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setError(null)}} style={{
              flex:1, padding:"8px", fontSize:"11px", letterSpacing:"0.1em",
              textTransform:"uppercase", background:"transparent", border:"none",
              borderBottom: tab===t.id?"2px solid var(--accent2)":"2px solid transparent",
              color: tab===t.id?"var(--accent2)":"var(--muted)",
              fontWeight: tab===t.id?600:400, cursor:"pointer", marginBottom:"-1px",
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "new" && (
          <>
            <input type="text" placeholder="Your name"
              value={name} onChange={e=>setName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleCreate()}
              style={inputStyle}
            />
            <input type="email" placeholder="Email (optional — helps you log back in)"
              value={email} onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleCreate()}
              style={inputStyle}
            />
            <p style={{ fontSize:"11px", color:"var(--muted2)", marginBottom:"16px", letterSpacing:"0.02em" }}>
              ⚠ Add an email so you can log back in later. Without one, save your User ID from your profile page.
            </p>
            {error && <div style={{ padding:"8px 12px", marginBottom:"12px", background:"#FDE8E2", borderRadius:"6px", color:"#8B4513", fontSize:"12px" }}>⚠ {error}</div>}
            <button onClick={handleCreate} disabled={!name.trim()||saving} style={btnStyle(!name.trim()||saving)}>
              {saving ? "Setting up…" : "Start watching →"}
            </button>
          </>
        )}

        {tab === "returning" && (
          <>
            <p style={{ fontSize:"13px", color:"var(--muted)", marginBottom:"16px", lineHeight:1.6 }}>
              Enter your email or user ID to continue where you left off.
            </p>

            {/* Try email first */}
            <input type="email" placeholder="Your email address"
              value={email} onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleReturnByEmail()}
              style={inputStyle}
            />
            <button onClick={handleReturnByEmail} disabled={!email.trim()||saving} style={{...btnStyle(!email.trim()||saving), marginBottom:"16px"}}>
              {saving ? "Looking up…" : "Continue with email →"}
            </button>

            <div style={{ display:"flex", alignItems:"center", gap:"10px", margin:"8px 0 16px" }}>
              <div style={{ flex:1, height:"1px", background:"var(--border)" }}/>
              <span style={{ fontSize:"11px", color:"var(--muted2)", letterSpacing:"0.1em" }}>OR</span>
              <div style={{ flex:1, height:"1px", background:"var(--border)" }}/>
            </div>

            <input type="number" placeholder="Your user ID (shown on profile)"
              value={userId} onChange={e=>setUserId(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleReturn()}
              style={inputStyle}
            />
            <button onClick={handleReturn} disabled={!userId.trim()||saving} style={btnStyle(!userId.trim()||saving)}>
              {saving ? "Looking up…" : "Continue with ID →"}
            </button>

            {error && <div style={{ padding:"8px 12px", marginTop:"12px", background:"#FDE8E2", borderRadius:"6px", color:"#8B4513", fontSize:"12px" }}>⚠ {error}</div>}
          </>
        )}
      </div>
    </div>
  )

  async function handleReturnByEmail() {
    if (!email.trim()) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`${API}/users/by-email?email=${encodeURIComponent(email.trim())}`)
      if (!res.ok) throw new Error("No account found with that email.")
      const user = await res.json()
      localStorage.setItem("lumiere_user", JSON.stringify(user))
      onComplete(user)
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }
}