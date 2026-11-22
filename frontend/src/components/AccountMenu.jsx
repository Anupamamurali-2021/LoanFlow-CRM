
import { useEffect, useRef, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const fieldStyle = {
  display: "grid",
  gap: "7px",
  marginBottom: "15px",
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  border: "1px solid #b8a395",
  borderRadius: "9px",
  background: "#fffaf5",
  color: "#241710",
  boxSizing: "border-box",
};

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [toast, setToast] = useState(null);

  const menuRef = useRef(null);
  const timerRef = useRef(null);

  let savedUser = null;

  try {
    savedUser = JSON.parse(sessionStorage.getItem("user") || "null");
  } catch {
    savedUser = null;
  }

  const displayName = profile?.name || savedUser?.name || "User";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const notify = (message, type = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);

    setToast({ message, type });

    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, 3500);
  };

  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.replace("/login");
  };

  const openView = async (selectedView) => {
    setOpen(false);
    setView(selectedView);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    if (selectedView !== "profile") return;

    setLoading(true);

    try {
      const token = sessionStorage.getItem("token");

      const response = await fetch(`${API_BASE}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load profile.");
      }

      setProfile(data.user);
    } catch (error) {
      notify(error.message || "Unable to load profile.", "error");
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();

    if (newPassword.length < 8 || newPassword.length > 128) {
      notify("Password must contain 8 to 128 characters.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      notify("New passwords do not match.", "error");
      return;
    }

    setSaving(true);

    try {
      const token = sessionStorage.getItem("token");

      const response = await fetch(
        `${API_BASE}/api/auth/change-password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to change password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setView(null);

      notify("Password changed successfully. Please log in again.");

      // Clear the current browser session after password change.
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      window.location.replace("/login");
    } catch (error) {
      notify(error.message || "Unable to change password.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          className="admin-avatar"
          onClick={() => setOpen((previous) => !previous)}
          aria-label="Open account menu"
          aria-expanded={open}
          aria-haspopup="true"
          style={{
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initials || "U"}
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              width: "230px",
              padding: "9px",
              background: "#fffaf5",
              border: "1px solid #e8d9cc",
              borderRadius: "12px",
              boxShadow: "0 12px 30px rgba(48,32,25,0.18)",
              zIndex: 1200,
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid #e8d9cc",
                marginBottom: "6px",
              }}
            >
              <strong style={{ color: "#302019" }}>{displayName}</strong>
              <p style={{ color: "#79513a", fontSize: "12px" }}>
                {savedUser?.role === "admin" ? "Administrator" : "Staff"}
              </p>
            </div>

            {[
              ["👤 My Profile", "profile"],
              ["🔒 Change Password", "password"],
              ["🚪 Logout", "logout"],
            ].map(([label, action]) => (
              <button
                key={action}
                type="button"
                onClick={() =>
                  action === "logout" ? logout() : openView(action)
                }
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "12px",
                  background: "transparent",
                  color: action === "logout" ? "#b42318" : "#382218",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(24,15,10,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 3000,
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={view === "profile" ? "My Profile" : "Change Password"}
            style={{
              width: "100%",
              maxWidth: "440px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fffaf5",
              borderRadius: "16px",
              padding: "26px",
              boxSizing: "border-box",
              boxShadow: "0 20px 55px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ color: "#302019", margin: 0 }}>
                {view === "profile" ? "My Profile" : "Change Password"}
              </h2>

              <button
                type="button"
                onClick={() => setView(null)}
                aria-label="Close dialog"
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#382218",
                }}
              >
                ×
              </button>
            </div>

            {view === "profile" ? (
              loading ? (
                <p>Loading profile...</p>
              ) : profile ? (
                <div style={{ display: "grid", gap: "16px" }}>
                  <div>
                    <strong>Name</strong>
                    <p>{profile.name}</p>
                  </div>
                  <div>
                    <strong>Email</strong>
                    <p style={{ overflowWrap: "anywhere" }}>
                      {profile.email}
                    </p>
                  </div>
                  <div>
                    <strong>Role</strong>
                    <p>
                      {profile.role === "admin" ? "Administrator" : "Staff"}
                    </p>
                  </div>
                </div>
              ) : (
                <p>Profile could not be loaded. Please try again.</p>
              )
            ) : (
              <form onSubmit={changePassword}>
                <label style={fieldStyle}>
                  <strong>Current Password</strong>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) =>
                      setCurrentPassword(event.target.value)
                    }
                    style={inputStyle}
                    required
                    disabled={saving}
                  />
                </label>

                <label style={fieldStyle}>
                  <strong>New Password</strong>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(event.target.value)
                    }
                    style={inputStyle}
                    minLength={8}
                    maxLength={128}
                    required
                    disabled={saving}
                  />
                </label>

                <label style={fieldStyle}>
                  <strong>Confirm New Password</strong>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    style={inputStyle}
                    minLength={8}
                    maxLength={128}
                    required
                    disabled={saving}
                  />
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "13px",
                    background: saving ? "#8c7869" : "#382218",
                    color: "#fffaf5",
                    border: "none",
                    borderRadius: "9px",
                    fontWeight: "700",
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {toast && (
        <div
          role={toast.type === "error" ? "alert" : "status"}
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 5000,
            maxWidth: "350px",
            padding: "15px 18px",
            borderRadius: "12px",
            background: "#302019",
            color: "#fffaf5",
            borderLeft: `4px solid ${
              toast.type === "error" ? "#e77b72" : "#79c49a"
            }`,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          {toast.type === "error" ? "✕" : "✓"} {toast.message}
        </div>
      )}
    </>
  );
}

export default AccountMenu;
