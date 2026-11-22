
import "../Login.css";
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Remember which protected page the user originally requested.
  const requestedPath = location.state?.from;
  const isMobileAdminLogin =
    typeof requestedPath === "string" &&
    requestedPath.split(/[?#]/)[0] === "/mobile-admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();

    // Validate email address
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed.");
      }

      const role = data.user?.role;

      if (
        !data.token ||
        !data.user ||
        (role !== "admin" && role !== "staff")
      ) {
        throw new Error("Invalid account information received.");
      }

      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));

      // Redirect to the correct portal after login.
      if (role === "admin") {
        navigate(
          isMobileAdminLogin ? "/mobile-admin" : "/admin",
          { replace: true }
        );
      } else {
        navigate("/staff", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`login-page ${isMobileAdminLogin ? "mobile-admin-login-page" : ""
        }`}
    >
      <div className="login-container">
        {/* LEFT BRAND SECTION */}
        <section className="login-brand">
          <Link to="/" className="brand-logo">
            <span className="brand-symbol">◆</span>
            LoanFlow
          </Link>

          <div className="brand-content">
            <span className="brand-label">
              LOAN MANAGEMENT PLATFORM
            </span>

            <h1>Smarter lending starts here.</h1>

            <p>
              Manage customer leads, track conversations,
              and streamline every loan application
              from one powerful workspace.
            </p>

            <div className="brand-features">
              <div>✓ Customer &amp; Lead Management</div>
              <div>✓ Call Tracking &amp; Follow-ups</div>
              <div>✓ Loan Application Management</div>
            </div>
          </div>

          <div className="brand-footer">
            Secure • Simple • Efficient
          </div>
        </section>

        {/* RIGHT LOGIN SECTION */}
        <section className="login-form-section">
          <div className="login-form-wrapper">
            <span className="welcome-label">
              {isMobileAdminLogin
                ? "MOBILE ADMIN PORTAL"
                : "WELCOME BACK"}
            </span>

            <h2>Sign in to your account</h2>

            <p className="login-subtitle">
              {isMobileAdminLogin
                ? "Sign in as an Admin to access the Mobile Admin Portal."
                : "Enter your credentials to access your workspace."}
            </p>

            <form onSubmit={handleLogin}>
              <label htmlFor="email">
                Email Address
              </label>

              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                autoComplete="email"
                maxLength={254}
                required
              />

              <label htmlFor="password">
                Password
              </label>

              <div className="password-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="show-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  style={{
                    color: "#c0392b",
                    fontSize: "13px",
                    marginTop: "12px",
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading ? "Signing In..." : "Sign In →"}
              </button>
            </form>

            <p className="login-help">
              Need access? Contact your administrator.
            </p>

            <Link to="/" className="back-link">
              ← Back to Home
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
