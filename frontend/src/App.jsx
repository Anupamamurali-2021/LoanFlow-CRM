
import { useNavigate } from "react-router-dom";
function App() {
  const navigate = useNavigate();
  const features = [
    { icon: "◈", title: "Lead Management", description: "Organize customer leads easily." },
    { icon: "◉", title: "Call Tracking", description: "Monitor calls and follow-ups." },
    { icon: "▣", title: "Loan Processing", description: "Track applications and approvals." },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8F5F1",
      color: "#24201E",
      fontFamily: "Arial, sans-serif",
      padding: "24px",
      boxSizing: "border-box"
    }}>
      <header style={{
        maxWidth: "1100px",
        margin: "0 auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <h2 style={{ color: "#3B241C" }}>LoanFlow CRM</h2>
        <span style={{
          background: "#E8D8C8",
          color: "#3B241C",
          padding: "10px 16px",
          borderRadius: "30px"
        }}>
          Management Platform
        </span>
      </header>

      <main style={{
        maxWidth: "1100px",
        margin: "80px auto 0",
        textAlign: "center"
      }}>
        <p style={{
          color: "#8B5E3C",
          fontWeight: "bold",
          letterSpacing: "2px"
        }}>
          SMARTER LOAN MANAGEMENT
        </p>

        <h1 style={{
          fontSize: "clamp(32px, 5vw, 56px)",
          marginBottom: "20px"
        }}>
          Manage loans. Grow faster.
        </h1>

        <p style={{
          color: "#786B63",
          fontSize: "18px",
          lineHeight: "1.7",
          maxWidth: "600px",
          margin: "0 auto 30px"
        }}>
          A simple and powerful platform to manage leads,
          track calls, and streamline loan applications.
        </p>

        <button onClick={() => navigate("/login")} style={{
          background: "#3B241C",
          color: "white",
          padding: "16px 36px",
          border: "none",
          borderRadius: "10px",
          fontSize: "16px",
          cursor: "pointer"
        }}>
          Get Started
        </button>

        <section style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
          marginTop: "80px"
        }}>
          {features.map((feature) => (
            <div key={feature.title} style={{
              background: "white",
              padding: "30px",
              borderRadius: "16px",
              border: "1px solid #E8D8C8",
              boxShadow: "0 8px 24px rgba(59,36,28,0.05)"
            }}>
              <div style={{
                fontSize: "32px",
                color: "#8B5E3C"
              }}>
                {feature.icon}
              </div>

              <h3>{feature.title}</h3>

              <p style={{ color: "#786B63" }}>
                {feature.description}
              </p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default App;
