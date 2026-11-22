
import "./AdminDashboard.css";
import { useState, useEffect } from "react";
import LeadManagement from "./LeadManagement.jsx";
import EmployeeManagement from "./EmployeeManagement.jsx";
import BankSchemeManagement from "./BankSchemeManagement.jsx";
import LoanApplicationManagement from "./LoanApplicationManagement.jsx";
import ReportsAnalytics from "./ReportsAnalytics.jsx";
import AccountMenu from "../components/AccountMenu";
import CallTracking from "./CallTracking.jsx";

const DOCUMENT_API = "http://localhost:5000/api/documents";

const documentInputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "9px",
  border: "1px solid #b8a395",
  background: "#fffaf5",
  color: "#241710",
  fontSize: "14px",
  boxSizing: "border-box",
};

function formatDocumentDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getAdminToken() {
  const token = sessionStorage.getItem("token");

  if (!token) {
    throw new Error(
      "Your session has expired. Please log in again."
    );
  }

  return token;
}

function AdminDashboard() {
  const [activePage, setActivePage] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [totalLeads, setTotalLeads] = useState(0);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalLoanApplications, setTotalLoanApplications] = useState(null);
  const [callsToday, setCallsToday] = useState(null);
  const [teamDailyTarget, setTeamDailyTarget] = useState(0);
  const [callAchievement, setCallAchievement] = useState(0);
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState("");

  // Document Management
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");

  const [selectedDocumentId, setSelectedDocumentId] =
    useState("");
  const [verificationStatus, setVerificationStatus] =
    useState("");
  const [verificationRemarks, setVerificationRemarks] =
    useState("");

  const [savingVerification, setSavingVerification] =
    useState(false);
  const [verificationError, setVerificationError] =
    useState("");
  const [verificationSuccess, setVerificationSuccess] =
    useState("");
  const [openingDocumentId, setOpeningDocumentId] =
    useState("");
  // Fetch real daily call statistics from Reports API
  useEffect(() => {
    const controller = new AbortController();

    const fetchCallStatistics = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/reports/overview",
          {
            headers: {
              Authorization: `Bearer ${getAdminToken()}`,
            },
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success || !data.overview) {
          throw new Error(
            data.message || "Unable to load call statistics."
          );
        }

        if (!controller.signal.aborted) {
          setCallsToday(data.overview.callsToday);
          setTeamDailyTarget(data.overview.teamDailyTarget);
          setCallAchievement(
            data.overview.targetAchievementPercentage
          );
        }
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          console.error("Error fetching call statistics:", error);
          setCallsToday(null);
          setTeamDailyTarget(0);
          setCallAchievement(0);
        }
      }
    };

    fetchCallStatistics();

    return () => controller.abort();
  }, [activePage]);
  // Fetch real lead count from MongoDB
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const token = sessionStorage.getItem("token");

        const response = await fetch(
          "http://localhost:5000/api/leads",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch leads");
        }

        const data = await response.json();
        setTotalLeads(data.count);
      } catch (error) {
        console.error("Error fetching leads:", error);
      }
    };

    fetchLeads();
  }, [activePage]);

  // Fetch real employee count from MongoDB
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const token = sessionStorage.getItem("token");

        const response = await fetch(
          "http://localhost:5000/api/employees",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch employees");
        }

        const data = await response.json();
        setTotalEmployees(data.count);
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };

    fetchEmployees();
  }, [activePage]);

  // Fetch real loan application count from MongoDB.
  useEffect(() => {
    const controller = new AbortController();

    const fetchLoanApplications = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/loan-applications",
          {
            headers: {
              Authorization: `Bearer ${getAdminToken()}`,
            },
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success || !Array.isArray(data.applications)) {
          throw new Error(data.message || "Unable to load loan applications.");
        }

        if (!controller.signal.aborted) {
          setTotalLoanApplications(data.applications.length);
        }
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          setTotalLoanApplications(null);
          console.error("Error fetching loan applications:", error);
        }
      }
    };

    fetchLoanApplications();
    return () => controller.abort();
  }, [activePage]);

  // Load documents when the admin opens Documents.
  useEffect(() => {
    if (activePage !== "documents") return;

    const controller = new AbortController();

    const loadDocuments = async () => {
      setDocumentsLoading(true);
      setDocumentsError("");

      try {
        const response = await fetch(DOCUMENT_API, {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load documents."
          );
        }

        if (!Array.isArray(data.documents)) {
          throw new Error("Invalid document data received.");
        }

        if (!controller.signal.aborted) {
          setDocuments(data.documents);
        }
      } catch (error) {
        if (
          error.name !== "AbortError" &&
          !controller.signal.aborted
        ) {
          setDocumentsError(
            error.message || "Unable to load documents."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDocumentsLoading(false);
        }
      }
    };

    loadDocuments();

    return () => controller.abort();
  }, [activePage]);

  const stats = [
    { title: "Total Leads", value: totalLeads, change: "" },
    {
      title: "Total Employees",
      value: totalEmployees,
      change: "",
    },
    {
      title: "Calls Today",
      value: callsToday ?? "—",
      change: "",
    },
    { title: "Loan Applications", value: totalLoanApplications ?? "—", change: "" },
  ];

  // Load actual recent CRM events when opening the dashboard.
  useEffect(() => {
    if (activePage !== "dashboard") return;

    const controller = new AbortController();
    const fetchRecentActivity = async () => {
      setActivitiesLoading(true);
      setActivitiesError("");
      try {
        const response = await fetch(
          "http://localhost:5000/api/reports/recent-activity",
          {
            headers: { Authorization: `Bearer ${getAdminToken()}` },
            signal: controller.signal,
          }
        );
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.activities)) {
          throw new Error(data.message || "Unable to load recent activity.");
        }
        if (!controller.signal.aborted) setActivities(data.activities);
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          setActivitiesError(error.message || "Unable to load recent activity.");
        }
      } finally {
        if (!controller.signal.aborted) setActivitiesLoading(false);
      }
    };

    fetchRecentActivity();
    return () => controller.abort();
  }, [activePage]);

  // Change page without reloading the browser
  const navigateTo = (event, page) => {
    event.preventDefault();
    setActivePage(page);
    setMobileMenuOpen(false);
    setVerificationError("");
    setVerificationSuccess("");
  };

  const pageDetails = {
    dashboard: {
      title: "Dashboard Overview",
      subtitle: "Welcome back! Here's your business overview.",
    },
    leads: {
      title: "Lead Management",
      subtitle: "Manage customer leads and follow-ups.",
    },
    employees: {
      title: "Employee Management",
      subtitle: "Manage your team and staff access.",
    },
    banks: {
      title: "Banks & Loan Schemes",
      subtitle: "Manage partner banks and their loan offerings.",
    },
    loanApplications: {
      title: "Loan Applications",
      subtitle: "Create, review, approve, and track loan applications.",
    },
    documents: {
      title: "Document Verification",
      subtitle:
        "Review customer documents uploaded by your staff.",
    },
    reports: {
      title: "Reports & Analytics",
      subtitle:
        "Monitor employee performance, lead conversions, and loan applications.",
    },
    callTracking: {
      title: "Call Tracking",
      subtitle:
        "Monitor employee calls, daily targets, and customer interactions.",
    },
  };

  const currentPage = pageDetails[activePage];

  const pendingDocuments = documents.filter(
    (item) => item.verificationStatus === "Pending"
  ).length;

  const verifiedDocuments = documents.filter(
    (item) => item.verificationStatus === "Verified"
  ).length;

  const rejectedDocuments = documents.filter(
    (item) => item.verificationStatus === "Rejected"
  ).length;

  const selectedDocument = documents.find(
    (item) => item._id === selectedDocumentId
  );

  const startVerification = (document) => {
    setSelectedDocumentId(document._id);
    setVerificationStatus("");
    setVerificationRemarks("");
    setVerificationError("");
    setVerificationSuccess("");
  };

  const cancelVerification = () => {
    setSelectedDocumentId("");
    setVerificationStatus("");
    setVerificationRemarks("");
    setVerificationError("");
  };

  // Save an admin verification decision.
  const handleVerifyDocument = async (event) => {
    event.preventDefault();

    setVerificationError("");
    setVerificationSuccess("");

    if (!selectedDocument) {
      setVerificationError("Please select a document.");
      return;
    }

    if (
      !["Verified", "Rejected"].includes(verificationStatus)
    ) {
      setVerificationError(
        "Please select Verified or Rejected."
      );
      return;
    }

    const remarks = verificationRemarks.trim();

    if (remarks.length > 1000) {
      setVerificationError(
        "Remarks cannot exceed 1000 characters."
      );
      return;
    }

    if (
      verificationStatus === "Rejected" &&
      remarks.length < 2
    ) {
      setVerificationError(
        "Please enter a rejection reason."
      );
      return;
    }

    setSavingVerification(true);

    try {
      const response = await fetch(
        `${DOCUMENT_API}/${selectedDocumentId}/verify`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
          body: JSON.stringify({
            verificationStatus,
            verificationRemarks: remarks,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to update verification."
        );
      }

      // Use the saved MongoDB result.
      setDocuments((previousDocuments) =>
        previousDocuments.map((document) =>
          document._id === data.document._id
            ? data.document
            : document
        )
      );

      setVerificationSuccess(
        data.message || "Verification updated successfully."
      );

      setSelectedDocumentId("");
      setVerificationStatus("");
      setVerificationRemarks("");
    } catch (error) {
      setVerificationError(
        error.message || "Unable to verify document."
      );
    } finally {
      setSavingVerification(false);
    }
  };

  // Download a file through the authenticated API.
  const handleOpenDocument = async (documentId) => {
    setDocumentsError("");
    setOpeningDocumentId(documentId);

    let objectUrl = null;

    try {
      const response = await fetch(
        `${DOCUMENT_API}/${documentId}/file`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );

      if (!response.ok) {
        let message = "Unable to download document.";

        try {
          const data = await response.json();
          message = data.message || message;
        } catch {
          // Response was not JSON.
        }

        throw new Error(message);
      }

      const contentType = response.headers
        .get("Content-Type")
        ?.split(";")[0]
        .trim();

      if (
        ![
          "application/pdf",
          "image/jpeg",
          "image/png",
        ].includes(contentType)
      ) {
        throw new Error("Unexpected document file type.");
      }

      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;

      link.download =
        contentType === "application/pdf"
          ? "customer-document.pdf"
          : contentType === "image/png"
            ? "customer-document.png"
            : "customer-document.jpg";

      document.body.appendChild(link);
      link.click();
      link.remove();

      const urlToRelease = objectUrl;

      setTimeout(() => {
        URL.revokeObjectURL(urlToRelease);
      }, 60000);

      objectUrl = null;
    } catch (error) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

      setDocumentsError(
        error.message || "Unable to download document."
      );
    } finally {
      setOpeningDocumentId("");
    }
  };

  const isMobileAdmin =
    window.location.pathname === "/mobile-admin";

  return (
    <div
      className={`admin-layout ${isMobileAdmin ? "mobile-admin-layout" : ""
        }`}
    >
      {isMobileAdmin && (
        <button
          type="button"
          className="mobile-admin-menu-button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-admin-sidebar"
        >
          {mobileMenuOpen ? "✕ Close Menu" : "☰ Menu"}
        </button>
      )}

      <aside
        id={isMobileAdmin ? "mobile-admin-sidebar" : undefined}
        className={`admin-sidebar ${isMobileAdmin && mobileMenuOpen ? "mobile-menu-open" : ""
          }`}
      >
        <h2 className="admin-logo">◆ LoanFlow</h2>

        <p className="sidebar-label">WORKSPACE</p>

        <nav className="sidebar-nav">
          <a
            href="#dashboard"
            className={
              activePage === "dashboard" ? "nav-active" : ""
            }
            onClick={(event) =>
              navigateTo(event, "dashboard")
            }
          >
            ◈ Dashboard
          </a>

          <a
            href="#leads"
            className={
              activePage === "leads" ? "nav-active" : ""
            }
            onClick={(event) =>
              navigateTo(event, "leads")
            }
          >
            ▤ Lead Management
          </a>

          <a
            href="#employees"
            className={
              activePage === "employees" ? "nav-active" : ""
            }
            onClick={(event) =>
              navigateTo(event, "employees")
            }
          >
            ◉ Employees
          </a>

          <a
            href="#call-tracking"
            className={
              activePage === "callTracking" ? "nav-active" : ""
            }
            onClick={(event) => navigateTo(event, "callTracking")}
          >
            ▦ Call Tracking
          </a>

          <a
            href="#loan-applications"
            className={
              activePage === "loanApplications" ? "nav-active" : ""
            }
            onClick={(event) =>
              navigateTo(event, "loanApplications")
            }
          >
            ◇ Loan Applications
          </a>

          <a
            href="#banks"
            className={
              activePage === "banks" ? "nav-active" : ""
            }
            onClick={(event) =>
              navigateTo(event, "banks")
            }
          >
            ◈ Banks & Loan Schemes
          </a>

          <a
            href="#documents"
            className={
              activePage === "documents" ? "nav-active" : ""
            }
            onClick={(event) =>
              navigateTo(event, "documents")
            }
          >
            ▣ Documents
          </a>

          <a
            href="#reports"
            className={
              activePage === "reports" ? "nav-active" : ""
            }
            onClick={(event) => navigateTo(event, "reports")}
          >
            ▥ Reports
          </a>
        </nav>

        <div className="sidebar-bottom">
          <p>ADMIN PORTAL</p>
          <span>LoanFlow CRM</span>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="header-label">
              ADMIN WORKSPACE
            </p>

            <h1>{currentPage.title}</h1>

            <p className="header-subtitle">
              {currentPage.subtitle}
            </p>
          </div>

          <AccountMenu />
        </header>

        {/* LEAD MANAGEMENT */}
        {activePage === "leads" && (
          <LeadManagement />
        )}

        {/* EMPLOYEE MANAGEMENT */}
        {activePage === "employees" && (
          <EmployeeManagement />
        )}

        {/* BANKS AND LOAN SCHEMES */}
        {activePage === "banks" && (
          <BankSchemeManagement />
        )}

        {/* LOAN APPLICATION MANAGEMENT */}
        {activePage === "loanApplications" && (
          <LoanApplicationManagement />
        )}
        {/* REPORTS & ANALYTICS */}
        {activePage === "reports" && (
          <ReportsAnalytics />
        )}
        {/* CALL TRACKING */}
        {activePage === "callTracking" && (
          <CallTracking />
        )}

        {/* DOCUMENT MANAGEMENT */}
        {activePage === "documents" && (
          <>
            <section className="stats-grid">
              {[
                {
                  title: "Total Documents",
                  value: documents.length,
                },
                {
                  title: "Pending Review",
                  value: pendingDocuments,
                },
                {
                  title: "Verified",
                  value: verifiedDocuments,
                },
                {
                  title: "Rejected",
                  value: rejectedDocuments,
                },
              ].map((stat) => (
                <div className="stat-card" key={stat.title}>
                  <p>{stat.title}</p>

                  <h2>
                    {documentsLoading || documentsError
                      ? "—"
                      : stat.value}
                  </h2>

                  <span>Saved document records</span>
                </div>
              ))}
            </section>

            <section
              className="dashboard-panel"
              style={{ marginTop: "24px" }}
            >
              <h2>Customer Document Verification</h2>

              <p className="panel-subtitle">
                Review uploaded documents and record your
                verification decision.
              </p>

              {documentsError && (
                <p
                  role="alert"
                  style={{
                    color: "#b42318",
                    marginTop: "16px",
                  }}
                >
                  {documentsError}
                </p>
              )}

              {verificationSuccess && (
                <p
                  role="status"
                  style={{
                    color: "#287a4b",
                    fontWeight: "700",
                    marginTop: "16px",
                  }}
                >
                  ✓ {verificationSuccess}
                </p>
              )}

              {documentsLoading ? (
                <p className="panel-subtitle">
                  Loading customer documents...
                </p>
              ) : documentsError && documents.length === 0 ? (
                <p className="panel-subtitle">
                  Unable to display documents.
                </p>
              ) : documents.length === 0 ? (
                <p className="panel-subtitle">
                  No customer documents have been uploaded yet.
                </p>
              ) : (
                <div style={{ marginTop: "20px" }}>
                  {documents.map((item) => {
                    const status =
                      item.verificationStatus || "Pending";

                    const statusColor =
                      status === "Verified"
                        ? "#287a4b"
                        : status === "Rejected"
                          ? "#b42318"
                          : "#956519";

                    return (
                      <div
                        key={item._id}
                        style={{
                          padding: "20px",
                          marginBottom: "16px",
                          border:
                            "1px solid rgba(120,90,70,0.2)",
                          borderRadius: "12px",
                          background: "#fffaf5",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "12px",
                          }}
                        >
                          <strong
                            style={{
                              color: "#302019",
                              fontSize: "16px",
                            }}
                          >
                            {item.documentType}
                          </strong>

                          <span
                            style={{
                              color: statusColor,
                              fontWeight: "700",
                            }}
                          >
                            {status}
                          </span>
                        </div>

                        <p className="panel-subtitle">
                          Customer:{" "}
                          {item.lead?.name ||
                            "Customer unavailable"}
                        </p>

                        <p className="panel-subtitle">
                          Uploaded by:{" "}
                          {item.uploadedBy?.name ||
                            "Employee unavailable"}
                        </p>

                        <p className="panel-subtitle">
                          File: {item.originalName}
                        </p>

                        <p className="panel-subtitle">
                          Uploaded:{" "}
                          {formatDocumentDate(item.createdAt)}
                        </p>

                        {item.verifiedAt && (
                          <p className="panel-subtitle">
                            Last reviewed:{" "}
                            {formatDocumentDate(item.verifiedAt)}
                          </p>
                        )}

                        {item.verificationRemarks && (
                          <p
                            style={{
                              marginTop: "12px",
                              overflowWrap: "anywhere",
                            }}
                          >
                            <strong>
                              Verification Remarks:
                            </strong>{" "}
                            {item.verificationRemarks}
                          </p>
                        )}

                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            flexWrap: "wrap",
                            marginTop: "16px",
                          }}
                        >
                          <button
                            type="button"
                            disabled={
                              openingDocumentId === item._id
                            }
                            onClick={() =>
                              handleOpenDocument(item._id)
                            }
                            style={{
                              padding: "11px 16px",
                              borderRadius: "9px",
                              border: "1px solid #79513a",
                              background: "#fffaf5",
                              color: "#382218",
                              fontWeight: "700",
                              cursor: "pointer",
                            }}
                          >
                            {openingDocumentId === item._id
                              ? "Downloading..."
                              : "Download Document"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              startVerification(item)
                            }
                            style={{
                              padding: "11px 16px",
                              borderRadius: "9px",
                              border: "none",
                              background: "#382218",
                              color: "#fffaf5",
                              fontWeight: "700",
                              cursor: "pointer",
                            }}
                          >
                            {status === "Pending"
                              ? "Review Document"
                              : "Update Verification"}
                          </button>
                        </div>

                        {/* VERIFICATION FORM */}
                        {selectedDocumentId === item._id && (
                          <form
                            onSubmit={handleVerifyDocument}
                            style={{
                              display: "grid",
                              gap: "16px",
                              marginTop: "20px",
                              padding: "20px",
                              borderRadius: "10px",
                              background: "#f3e8dc",
                              maxWidth: "650px",
                            }}
                          >
                            <h3
                              style={{
                                color: "#302019",
                                margin: 0,
                              }}
                            >
                              Review Document
                            </h3>

                            {verificationError && (
                              <p
                                role="alert"
                                style={{
                                  color: "#b42318",
                                }}
                              >
                                {verificationError}
                              </p>
                            )}

                            <label
                              style={{
                                display: "grid",
                                gap: "8px",
                              }}
                            >
                              <strong>
                                Verification Decision *
                              </strong>

                              <select
                                value={verificationStatus}
                                onChange={(event) => {
                                  setVerificationStatus(
                                    event.target.value
                                  );
                                  setVerificationError("");
                                }}
                                required
                                disabled={savingVerification}
                                style={documentInputStyle}
                              >
                                <option value="">
                                  Select decision
                                </option>

                                <option value="Verified">
                                  Verified
                                </option>

                                <option value="Rejected">
                                  Rejected
                                </option>
                              </select>
                            </label>

                            <label
                              style={{
                                display: "grid",
                                gap: "8px",
                              }}
                            >
                              <strong>
                                Remarks{" "}
                                {verificationStatus ===
                                  "Rejected"
                                  ? "*"
                                  : "(Optional)"}
                              </strong>

                              <textarea
                                value={verificationRemarks}
                                onChange={(event) => {
                                  setVerificationRemarks(
                                    event.target.value
                                  );
                                  setVerificationError("");
                                }}
                                rows={4}
                                maxLength={1000}
                                minLength={
                                  verificationStatus ===
                                    "Rejected"
                                    ? 2
                                    : undefined
                                }
                                required={
                                  verificationStatus ===
                                  "Rejected"
                                }
                                disabled={savingVerification}
                                placeholder={
                                  verificationStatus ===
                                    "Rejected"
                                    ? "Explain why the document was rejected..."
                                    : "Add verification notes..."
                                }
                                style={{
                                  ...documentInputStyle,
                                  resize: "vertical",
                                  fontFamily: "inherit",
                                }}
                              />

                              <span
                                className="panel-subtitle"
                                style={{ fontSize: "12px" }}
                              >
                                {verificationRemarks.length}/1000
                                characters
                              </span>
                            </label>

                            <div
                              style={{
                                display: "flex",
                                gap: "10px",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="submit"
                                disabled={savingVerification}
                                style={{
                                  padding: "12px 18px",
                                  border: "none",
                                  borderRadius: "9px",
                                  background:
                                    savingVerification
                                      ? "#8c7869"
                                      : "#382218",
                                  color: "#fffaf5",
                                  fontWeight: "700",
                                  cursor: savingVerification
                                    ? "not-allowed"
                                    : "pointer",
                                }}
                              >
                                {savingVerification
                                  ? "Saving..."
                                  : "Save Verification"}
                              </button>

                              <button
                                type="button"
                                disabled={savingVerification}
                                onClick={cancelVerification}
                                style={{
                                  padding: "12px 18px",
                                  border:
                                    "1px solid #79513a",
                                  borderRadius: "9px",
                                  background: "transparent",
                                  color: "#382218",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* DASHBOARD OVERVIEW */}
        {activePage === "dashboard" && (
          <>
            <section className="stats-grid">
              {stats.map((stat) => (
                <div
                  className="stat-card"
                  key={stat.title}
                >
                  <p>{stat.title}</p>
                  <h2>{stat.value}</h2>
                  <span>{stat.change}</span>
                </div>
              ))}
            </section>

            <section className="dashboard-content">
              <div className="dashboard-panel">
                <h2>Recent Activity</h2>

                <p className="panel-subtitle">
                  Latest updates
                </p>

                {activitiesLoading ? (
                  <p className="panel-subtitle">Loading recent activity...</p>
                ) : activitiesError ? (
                  <p role="alert" style={{ color: "#b42318" }}>
                    {activitiesError}
                  </p>
                ) : activities.length === 0 ? (
                  <p className="panel-subtitle">No recent activity available.</p>
                ) : (
                  activities.map((activity, index) => (
                    <div className="activity-item" key={activity.id || index}>
                      <div className="activity-icon">✓</div>
                      <div>
                        <strong>{activity.name || "CRM activity"}</strong>
                        <p>{activity.action || "Activity recorded"}</p>
                      </div>
                      <span>
                        {activity.occurredAt && !Number.isNaN(new Date(activity.occurredAt).getTime())
                          ? new Date(activity.occurredAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="dashboard-panel">
                <h2>Daily Call Performance</h2>

                <p className="panel-subtitle">
                  Team progress for today
                </p>

                <div className="performance-number">
                  {callsToday ?? "—"}{" "}
                  <span>/ {teamDailyTarget} calls</span>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, callAchievement))}%`,
                    }}
                  ></div>
                </div>

                <p className="performance-note">
                  {callsToday === null
                    ? "Unable to load today's call performance."
                    : teamDailyTarget === 0
                      ? "No active employee call targets available."
                      : `${callAchievement}% of today's team call target completed.`}
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
