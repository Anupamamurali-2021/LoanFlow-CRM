
import { useEffect, useRef, useState } from "react";
import "./AdminDashboard.css";
import LoanApplicationManagement from "./LoanApplicationManagement";
import AccountMenu from "../components/AccountMenu";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/leads`;
const DOCUMENT_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/documents`;
const callStatuses = [
  "Contacted",
  "Interested",
  "Not Interested",
  "Follow-up",
];

const documentTypes = [
  "Aadhaar Card",
  "PAN Card",
  "Bank Statement",
  "Salary Slip",
  "Address Proof",
  "Other",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "9px",
  border: "1px solid #b8a395",
  background: "#fffaf5",
  color: "#241710",
  fontSize: "14px",
  boxSizing: "border-box",
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
};

const tableCellStyle = {
  padding: "14px",
  borderBottom: "1px solid rgba(120,90,70,0.15)",
};

const historyCardStyle = {
  padding: "16px",
  marginTop: "12px",
  border: "1px solid rgba(120,90,70,0.2)",
  borderRadius: "10px",
};

const primaryButtonStyle = {
  padding: "13px 22px",
  background: "#382218",
  color: "#fffaf5",
  border: "none",
  borderRadius: "9px",
  fontWeight: "700",
  cursor: "pointer",
  fontSize: "14px",
};

function formatAmount(amount) {
  if (typeof amount !== "number") return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date) {
  if (!date) return "Not scheduled";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Invalid date";
  }

  return parsedDate.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getToken() {
  const token = sessionStorage.getItem("token");

  if (!token) {
    throw new Error(
      "Your session has expired. Please log in again."
    );
  }

  return token;
}

async function getAPIData(path, signal) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    signal,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Unable to load information."
    );
  }

  return data;
}

async function getDocumentData(signal) {
  const response = await fetch(
    `${DOCUMENT_API}/my-documents`,
    {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
      signal,
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Unable to load documents."
    );
  }

  if (!Array.isArray(data.documents)) {
    throw new Error("Invalid document data received.");
  }

  return data.documents;
}

function StaffDashboard() {
  const [activePage, setActivePage] = useState("dashboard");

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [callStats, setCallStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [callStatus, setCallStatus] = useState("");
  const [callRemarks, setCallRemarks] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");

  const [showCallForm, setShowCallForm] = useState(false);
  const [savingCall, setSavingCall] = useState(false);
  const [callError, setCallError] = useState("");
  const [callSuccess, setCallSuccess] = useState("");

  // Document Management states
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");

  const [documentLeadId, setDocumentLeadId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentFile, setDocumentFile] = useState(null);

  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [openingDocumentId, setOpeningDocumentId] = useState("");

  const toastTimer = useRef(null);
  const documentInputRef = useRef(null);

  const savedUser = sessionStorage.getItem("user");

  let user = null;

  try {
    user = savedUser ? JSON.parse(savedUser) : null;
  } catch {
    user = null;
  }

  const employeeName = user?.name || "Employee";

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const showSuccessToast = (message) => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    setCallSuccess(message);

    toastTimer.current = setTimeout(() => {
      setCallSuccess("");
      toastTimer.current = null;
    }, 3000);
  };

  // Fetch assigned leads
  useEffect(() => {
    const controller = new AbortController();

    const loadLeads = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await getAPIData(
          "/my-leads",
          controller.signal
        );

        if (!Array.isArray(data.leads)) {
          throw new Error("Invalid lead data received.");
        }

        if (!controller.signal.aborted) {
          setLeads(data.leads);
        }
      } catch (err) {
        if (
          err.name !== "AbortError" &&
          !controller.signal.aborted
        ) {
          setError(
            err.message || "Unable to load assigned leads."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadLeads();

    return () => controller.abort();
  }, [activePage]);

  // Fetch real call statistics
  useEffect(() => {
    const controller = new AbortController();

    const loadStats = async () => {
      setStatsLoading(true);
      setStatsError("");

      try {
        const data = await getAPIData(
          "/my-call-stats",
          controller.signal
        );

        if (
          typeof data.callsToday !== "number" ||
          typeof data.dailyTarget !== "number" ||
          !Array.isArray(data.recentCalls)
        ) {
          throw new Error(
            "Invalid call statistics received."
          );
        }

        if (!controller.signal.aborted) {
          setCallStats(data);
        }
      } catch (err) {
        if (
          err.name !== "AbortError" &&
          !controller.signal.aborted
        ) {
          setStatsError(
            err.message || "Unable to load call statistics."
          );
          setCallStats(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setStatsLoading(false);
        }
      }
    };

    loadStats();

    return () => controller.abort();
  }, [activePage]);

  const refreshCallStats = async () => {
    setStatsLoading(true);
    setStatsError("");

    try {
      const data = await getAPIData("/my-call-stats");

      if (
        typeof data.callsToday !== "number" ||
        typeof data.dailyTarget !== "number" ||
        !Array.isArray(data.recentCalls)
      ) {
        throw new Error(
          "Invalid call statistics received."
        );
      }

      setCallStats(data);
    } catch (err) {
      setStatsError(
        err.message || "Unable to refresh call statistics."
      );
      setCallStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch documents when the Documents page opens
  useEffect(() => {
    if (activePage !== "documents") return;

    const controller = new AbortController();

    const loadDocuments = async () => {
      setDocumentsLoading(true);
      setDocumentsError("");

      try {
        const result = await getDocumentData(
          controller.signal
        );

        if (!controller.signal.aborted) {
          setDocuments(result);
        }
      } catch (err) {
        if (
          err.name !== "AbortError" &&
          !controller.signal.aborted
        ) {
          setDocumentsError(
            err.message || "Unable to load documents."
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

  
  const pages = {
    dashboard: {
      title: "Staff Dashboard",
      subtitle: "Your daily work overview.",
    },
    leads: {
      title: "My Assigned Leads",
      subtitle: "View customer leads assigned to you.",
    },
    calls: {
      title: "Call Tracking",
      subtitle: "Record customer calls and follow-ups.",
    },
    followups: {
      title: "My Follow-ups",
      subtitle: "Keep track of scheduled customer follow-ups.",
    },
    documents: {
      title: "Customer Documents",
      subtitle: "Upload documents and track verification.",
    },
    loanApplications: {
      title: "My Loan Applications",
      subtitle: "Create, edit, submit, and track your loan applications.",
    },
  };

  const currentPage = pages[activePage];

  const navigateTo = (event, page) => {
    event.preventDefault();
    setActivePage(page);
    setCallError("");
    setUploadError("");
    setCallSuccess("");
  };

  const upcomingFollowUps = leads.filter((lead) => {
    if (!lead.nextFollowUp) return false;

    const date = new Date(lead.nextFollowUp);

    return (
      !Number.isNaN(date.getTime()) &&
      date.getTime() > Date.now()
    );
  });

  const callsToday = callStats?.callsToday ?? 0;
  const dailyTarget = callStats?.dailyTarget ?? 100;
  const recentCalls = callStats?.recentCalls ?? [];

  const progressPercentage =
    dailyTarget > 0
      ? Math.min(100, (callsToday / dailyTarget) * 100)
      : 0;

  const closeCallForm = () => {
    if (savingCall) return;
    setShowCallForm(false);
    setSelectedLeadId("");
    setCallStatus("");
    setCallRemarks("");
    setNextFollowUp("");
    setCallError("");
  };

  // Record a customer call
  const handleRecordCall = async (event) => {
    event.preventDefault();

    setCallError("");
    setCallSuccess("");

    if (!selectedLeadId) {
      setCallError("Please select a customer.");
      return;
    }

    if (!leads.some((lead) => lead._id === selectedLeadId)) {
      setCallError("Select a customer assigned to you.");
      return;
    }

    if (!callStatuses.includes(callStatus)) {
      setCallError("Please select a valid call status.");
      return;
    }

    const trimmedRemarks = callRemarks.trim();

    if (
      trimmedRemarks.length < 2 ||
      trimmedRemarks.length > 1000
    ) {
      setCallError(
        "Call remarks must be between 2 and 1000 characters."
      );
      return;
    }

    let followUpISO = null;

    if (nextFollowUp) {
      const date = new Date(nextFollowUp);

      if (
        Number.isNaN(date.getTime()) ||
        date.getTime() <= Date.now()
      ) {
        setCallError(
          "Follow-up date must be in the future."
        );
        return;
      }

      followUpISO = date.toISOString();
    }

    if (callStatus === "Follow-up" && !followUpISO) {
      setCallError(
        "Please schedule a future date for the follow-up."
      );
      return;
    }

    setSavingCall(true);

    try {
      const response = await fetch(
        `${API_URL}/${selectedLeadId}/calls`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            status: callStatus,
            remarks: trimmedRemarks,
            nextFollowUp: followUpISO,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to record the call."
        );
      }

      if (data.lead) {
        setLeads((previousLeads) =>
          previousLeads.map((lead) =>
            lead._id === data.lead._id
              ? {
                  ...lead,
                  status: data.lead.status,
                  remarks: data.lead.remarks,
                  nextFollowUp: data.lead.nextFollowUp,
                  lastCalledAt: data.lead.lastCalledAt,
                  callCount: data.lead.callCount,
                }
              : lead
          )
        );
      }

      await refreshCallStats();

      showSuccessToast("Call recorded successfully!");
      setShowCallForm(false);

      setSelectedLeadId("");
      setCallStatus("");
      setCallRemarks("");
      setNextFollowUp("");
    } catch (err) {
      setCallError(
        err.message || "Unable to record the call."
      );
    } finally {
      setSavingCall(false);
    }
  };

  // Validate the selected document
  const handleDocumentFileChange = (event) => {
    const file = event.target.files?.[0] || null;

    setUploadError("");
    setDocumentFile(null);

    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];

    const extension = file.name
      .split(".")
      .pop()
      ?.toLowerCase();

    const validExtension = [
      "pdf",
      "jpg",
      "jpeg",
      "png",
    ].includes(extension);

    if (!allowedTypes.includes(file.type) || !validExtension) {
      setUploadError(
        "Only PDF, JPG, and PNG files are allowed."
      );

      event.target.value = "";
      return;
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      setUploadError(
        "Document must be larger than 0 bytes and no more than 5 MB."
      );

      event.target.value = "";
      return;
    }

    setDocumentFile(file);
  };

  // Upload a document to the protected backend
  const handleUploadDocument = async (event) => {
    event.preventDefault();

    setUploadError("");

    if (
      !documentLeadId ||
      !leads.some((lead) => lead._id === documentLeadId)
    ) {
      setUploadError(
        "Please select a customer assigned to you."
      );
      return;
    }

    if (!documentTypes.includes(documentType)) {
      setUploadError("Please select a document type.");
      return;
    }

    if (!documentFile) {
      setUploadError("Please select a document.");
      return;
    }

    if (
      documentFile.size < 1 ||
      documentFile.size > MAX_FILE_SIZE
    ) {
      setUploadError(
        "Document must be no more than 5 MB."
      );
      return;
    }

    setUploadingDocument(true);

    try {
      const formData = new FormData();

      formData.append("leadId", documentLeadId);
      formData.append("documentType", documentType);
      formData.append("file", documentFile);

      const response = await fetch(
        `${DOCUMENT_API}/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Document upload failed."
        );
      }

      setDocumentLeadId("");
      setDocumentType("");
      setDocumentFile(null);

      if (documentInputRef.current) {
        documentInputRef.current.value = "";
      }

      setShowDocumentForm(false);
      showSuccessToast("Document uploaded successfully!");

      // Reload saved documents from MongoDB.
      try {
        setDocumentsLoading(true);
        setDocumentsError("");

        const updatedDocuments = await getDocumentData();
        setDocuments(updatedDocuments);
      } catch (refreshError) {
        setDocumentsError(
          refreshError.message ||
            "Document uploaded, but the list could not refresh."
        );
      } finally {
        setDocumentsLoading(false);
      }
    } catch (err) {
      setUploadError(
        err.message || "Unable to upload document."
      );
    } finally {
      setUploadingDocument(false);
    }
  };

  // Open a document using an authenticated request.
  // The JWT is never placed in the URL.
  const handleOpenDocument = async (documentId) => {
    setDocumentsError("");
    setOpeningDocumentId(documentId);

    let objectUrl = null;

    try {
      const response = await fetch(
        `${DOCUMENT_API}/${documentId}/file`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) {
        let message = "Unable to open document.";

        try {
          const data = await response.json();
          message = data.message || message;
        } catch {
          // The server did not return JSON.
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

      // Give the browser time to start the download.
      const urlToRelease = objectUrl;
      setTimeout(() => {
        URL.revokeObjectURL(urlToRelease);
      }, 60000);

      objectUrl = null;
    } catch (err) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

      setDocumentsError(
        err.message || "Unable to open document."
      );
    } finally {
      setOpeningDocumentId("");
    }
  };

  return (
    <div className="admin-layout">
      {/* SUCCESS TOAST */}
      {callSuccess && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            width: "calc(100vw - 40px)",
            maxWidth: "350px",
            boxSizing: "border-box",
            padding: "16px 18px",
            background: "#302019",
            color: "#fffaf5",
            border: "1px solid #795a46",
            borderLeft: "4px solid #79c49a",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          <span
            style={{
              color: "#79c49a",
              fontSize: "23px",
            }}
          >
            ✓
          </span>

          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: "14px" }}>
              {callSuccess}
            </strong>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: "12px",
                color: "#d9c9bb",
              }}
            >
              Your changes have been saved.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close notification"
            onClick={() => {
              if (toastTimer.current) {
                clearTimeout(toastTimer.current);
                toastTimer.current = null;
              }

              setCallSuccess("");
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#d9c9bb",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="admin-sidebar">
        <h2 className="admin-logo">◆ LoanFlow</h2>

        <p className="sidebar-label">
          STAFF WORKSPACE
        </p>

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
            ▤ My Leads
          </a>

          <a
            href="#calls"
            className={
              activePage === "calls" ? "nav-active" : ""
            }
            onClick={(event) =>
              navigateTo(event, "calls")
            }
          >
            ◉ Call Tracking
          </a>

          <a
            href="#followups"
            className={
              activePage === "followups" ? "nav-active" : ""
            }
            onClick={(event) =>
              navigateTo(event, "followups")
            }
          >
            ◷ Follow-ups
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
            href="#loan-applications"
            className={
              activePage === "loanApplications" ? "nav-active" : ""
            }
            onClick={(event) =>
              navigateTo(event, "loanApplications")
            }
          >
            ◫ Loan Applications
          </a>
        </nav>

        <div className="sidebar-bottom">
          <p>STAFF PORTAL</p>
          <span>{employeeName}</span>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="header-label">
              STAFF WORKSPACE
            </p>

            <h1>{currentPage.title}</h1>

            <p className="header-subtitle">
              {currentPage.subtitle}
            </p>
          </div>

          <AccountMenu />
        </header>

        {/* LEAD ERROR */}
        {error && activePage !== "documents" && (
          <section
            className="dashboard-panel"
            role="alert"
            style={{
              marginBottom: "20px",
              borderLeft: "4px solid #c0392b",
            }}
          >
            <p style={{ color: "#c0392b" }}>
              {error}
            </p>
          </section>
        )}

        {/* DASHBOARD */}
        {activePage === "dashboard" && (
          <>
            <section className="dashboard-panel">
              <h2>Welcome, {employeeName}!</h2>

              <p className="panel-subtitle">
                View your assigned leads and manage your
                daily customer follow-ups.
              </p>
            </section>

            <section
              className="stats-grid"
              style={{ marginTop: "25px" }}
            >
              <div className="stat-card">
                <p>Assigned Leads</p>

                <h2>
                  {loading || error ? "—" : leads.length}
                </h2>

                <span>
                  {loading
                    ? "Loading assigned leads..."
                    : error
                    ? "Unable to load leads"
                    : "Assigned to your account"}
                </span>
              </div>

              <div className="stat-card">
                <p>Daily Call Target</p>

                <h2>
                  {statsLoading || statsError
                    ? "—"
                    : dailyTarget}
                </h2>

                <span>Calls per day</span>
              </div>

              <div className="stat-card">
                <p>Calls Completed Today</p>

                <h2>
                  {statsLoading || statsError
                    ? "—"
                    : callsToday}
                </h2>

                <span>
                  {statsLoading
                    ? "Loading call statistics..."
                    : statsError
                    ? "Unable to load call count"
                    : `${callStats.remainingCalls} calls remaining`}
                </span>
              </div>

              <div className="stat-card">
                <p>Upcoming Follow-ups</p>

                <h2>
                  {loading || error
                    ? "—"
                    : upcomingFollowUps.length}
                </h2>

                <span>
                  {loading
                    ? "Loading follow-ups..."
                    : error
                    ? "Unable to load follow-ups"
                    : "Future scheduled follow-ups"}
                </span>
              </div>
            </section>

            <section
              className="dashboard-panel"
              style={{ marginTop: "24px" }}
            >
              <h2>Daily Call Progress</h2>

              {statsError ? (
                <p role="alert" style={{ color: "#b42318" }}>
                  {statsError}
                </p>
              ) : statsLoading ? (
                <p className="panel-subtitle">
                  Loading your daily progress...
                </p>
              ) : (
                <>
                  <p className="panel-subtitle">
                    {callsToday} of {dailyTarget} calls
                    completed today (IST).
                  </p>

                  <div
                    role="progressbar"
                    aria-label="Daily call target progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPercentage}
                    style={{
                      height: "14px",
                      background: "#e5d9cd",
                      borderRadius: "20px",
                      overflow: "hidden",
                      marginTop: "16px",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${progressPercentage}%`,
                        background: "#79513a",
                        borderRadius: "20px",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>

                  <p
                    className="panel-subtitle"
                    style={{ marginTop: "10px" }}
                  >
                    {callStats.targetAchieved
                      ? "Daily target achieved!"
                      : `${callStats.remainingCalls} more calls to reach your target.`}
                  </p>
                </>
              )}
            </section>
          </>
        )}

        {/* MY LEADS */}
        {activePage === "leads" && (
          <section className="dashboard-panel">
            <h2>My Assigned Leads</h2>

            <p className="panel-subtitle">
              Customer records assigned to your account.
            </p>

            {loading ? (
              <p className="panel-subtitle">
                Loading your assigned leads...
              </p>
            ) : error ? (
              <p className="panel-subtitle">
                Unable to display assigned leads.
              </p>
            ) : leads.length === 0 ? (
              <p className="panel-subtitle">
                No leads have been assigned to you yet.
              </p>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  marginTop: "20px",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                    minWidth: "750px",
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "Customer",
                        "Phone",
                        "Loan Type",
                        "Amount",
                        "Status",
                        "Follow-up",
                      ].map((heading) => (
                        <th
                          key={heading}
                          style={tableCellStyle}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead._id}>
                        <td style={tableCellStyle}>
                          {lead.name}
                        </td>

                        <td style={tableCellStyle}>
                          {lead.phone}
                        </td>

                        <td style={tableCellStyle}>
                          {lead.loanType}
                        </td>

                        <td style={tableCellStyle}>
                          {formatAmount(lead.loanAmount)}
                        </td>

                        <td style={tableCellStyle}>
                          {lead.status}
                        </td>

                        <td style={tableCellStyle}>
                          {formatDate(lead.nextFollowUp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* CALL TRACKING */}
        {activePage === "calls" && (
          <>
            <section className="dashboard-panel">
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px",
              }}>
                <div>
                  <h2 style={{ margin: "0 0 8px" }}>Customer Call Records</h2>
                  <p className="panel-subtitle" style={{ margin: 0 }}>
                    Record calls and manage customer follow-ups.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingCall}
                  onClick={() => {
                    if (showCallForm) {
                      closeCallForm();
                    } else {
                      setCallError("");
                      setShowCallForm(true);
                    }
                  }}
                  style={primaryButtonStyle}
                >
                  {showCallForm ? "✕ Cancel" : "+ Record Customer Call"}
                </button>
              </div>

              {showCallForm && (
                <div style={{
                  marginTop: "22px",
                  padding: "clamp(16px, 3vw, 24px)",
                  background: "#fffaf5",
                  border: "1px solid #eaded3",
                  borderRadius: "12px",
                }}>
                  <h3 style={{ marginTop: 0 }}>Record Customer Call</h3>
                  <p className="panel-subtitle">
                    Save the outcome of a call to one of your assigned customers.
                  </p>

              {callError && (
                <p
                  role="alert"
                  style={{
                    color: "#b42318",
                    marginTop: "16px",
                  }}
                >
                  {callError}
                </p>
              )}

              {loading ? (
                <p className="panel-subtitle">
                  Loading assigned customers...
                </p>
              ) : error ? (
                <p className="panel-subtitle">
                  Unable to load customers. Please try
                  again later.
                </p>
              ) : leads.length === 0 ? (
                <p className="panel-subtitle">
                  No customers are assigned to you yet.
                  Ask your admin to assign a lead.
                </p>
              ) : (
                <form
                  onSubmit={handleRecordCall}
                  style={{
                    display: "grid",
                    gap: "20px",
                    marginTop: "24px",
                    width: "100%",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                  }}
                >
                  <label style={{ ...fieldStyle, minWidth: 0 }}>
                    <strong>Select Customer *</strong>

                    <select
                      value={selectedLeadId}
                      onChange={(event) => {
                        setSelectedLeadId(event.target.value);
                        setCallError("");
                        setCallSuccess("");
                      }}
                      style={inputStyle}
                      required
                      disabled={savingCall}
                    >
                      <option value="">
                        Choose assigned customer
                      </option>

                      {leads.map((lead) => (
                        <option
                          key={lead._id}
                          value={lead._id}
                        >
                          {lead.name} - {lead.phone}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ ...fieldStyle, minWidth: 0 }}>
                    <strong>Call Status *</strong>

                    <select
                      value={callStatus}
                      onChange={(event) => {
                        setCallStatus(event.target.value);
                        setCallError("");
                        setCallSuccess("");
                      }}
                      style={inputStyle}
                      required
                      disabled={savingCall}
                    >
                      <option value="">
                        Choose call outcome
                      </option>

                      {callStatuses.map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ ...fieldStyle, minWidth: 0, gridColumn: "1 / -1" }}>
                    <strong>Call Remarks *</strong>

                    <textarea
                      value={callRemarks}
                      onChange={(event) => {
                        setCallRemarks(event.target.value);
                        setCallError("");
                        setCallSuccess("");
                      }}
                      placeholder="Write what happened during the customer call..."
                      rows={4}
                      maxLength={1000}
                      minLength={2}
                      required
                      disabled={savingCall}
                      style={{
                        ...inputStyle,
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />

                    <span
                      className="panel-subtitle"
                      style={{ fontSize: "12px" }}
                    >
                      {callRemarks.length}/1000 characters
                    </span>
                  </label>

                  <label style={{ ...fieldStyle, minWidth: 0 }}>
                    <strong>
                      Next Follow-up{" "}
                      {callStatus === "Follow-up"
                        ? "*"
                        : "(Optional)"}
                    </strong>

                    <input
                      type="datetime-local"
                      value={nextFollowUp}
                      onChange={(event) => {
                        setNextFollowUp(event.target.value);
                        setCallError("");
                        setCallSuccess("");
                      }}
                      style={inputStyle}
                      required={callStatus === "Follow-up"}
                      disabled={savingCall}
                    />

                    <span
                      className="panel-subtitle"
                      style={{ fontSize: "12px" }}
                    >
                      Select a future date and time.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={savingCall}
                    style={{
                      ...primaryButtonStyle,
                      gridColumn: "1 / -1",
                      width: "100%",
                      background: savingCall
                        ? "#8c7869"
                        : "#382218",
                      cursor: savingCall
                        ? "not-allowed"
                        : "pointer",
                    }}
                  >
                    {savingCall
                      ? "Saving Call..."
                      : "Save Call Record"}
                  </button>
                  <button
                    type="button"
                    disabled={savingCall}
                    onClick={closeCallForm}
                    style={{
                      gridColumn: "1 / -1",
                      justifySelf: "start",
                      padding: "10px 18px",
                      border: "none",
                      borderRadius: "9px",
                      background: "#ead9c9",
                      color: "#382218",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </form>
              )}
                </div>
              )}
            </section>

            {/* DAILY CALL ACTIVITY */}
            <section
              className="dashboard-panel"
              style={{ marginTop: "24px" }}
            >
              <h2>Call Activity</h2>

              <p className="panel-subtitle">
                Calls recorded today in Indian Standard Time.
              </p>

              {statsLoading ? (
                <p className="panel-subtitle">
                  Loading call activity...
                </p>
              ) : statsError ? (
                <p role="alert" style={{ color: "#b42318" }}>
                  {statsError}
                </p>
              ) : (
                <>
                  <h2 style={{ marginTop: "12px" }}>
                    {callsToday}
                  </h2>

                  <p className="panel-subtitle">
                    Completed today out of {dailyTarget} calls.
                  </p>
                </>
              )}
            </section>

            {/* RECENT CALL HISTORY */}
            <section
              className="dashboard-panel"
              style={{ marginTop: "24px" }}
            >
              <h2>Recent Call History</h2>

              <p className="panel-subtitle">
                Your 20 most recent saved call records,
                including calls from previous days.
              </p>

              {statsLoading ? (
                <p className="panel-subtitle">
                  Loading call history...
                </p>
              ) : statsError ? (
                <p role="alert" style={{ color: "#b42318" }}>
                  {statsError}
                </p>
              ) : recentCalls.length === 0 ? (
                <p className="panel-subtitle">
                  No call records found yet.
                </p>
              ) : (
                <div style={{ marginTop: "18px" }}>
                  {recentCalls.map((call, index) => (
                    <div
                      key={call.callId || index}
                      style={historyCardStyle}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "10px",
                        }}
                      >
                        <strong>
                          {call.customerName}
                        </strong>

                        <span
                          style={{
                            color: "#79513a",
                            fontWeight: "700",
                          }}
                        >
                          {call.status}
                        </span>
                      </div>

                      <p className="panel-subtitle">
                        {call.customerPhone}
                      </p>

                      <p
                        style={{
                          marginTop: "10px",
                          overflowWrap: "anywhere",
                        }}
                      >
                        <strong>Remarks:</strong>{" "}
                        {call.remarks}
                      </p>

                      <p className="panel-subtitle">
                        Called: {formatDate(call.calledAt)}
                      </p>

                      {call.nextFollowUp && (
                        <p className="panel-subtitle">
                          Follow-up:{" "}
                          {formatDate(call.nextFollowUp)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* FOLLOW-UPS */}
        {activePage === "followups" && (
          <section className="dashboard-panel">
            <h2>My Follow-ups</h2>

            <p className="panel-subtitle">
              Upcoming follow-ups for your assigned customers.
            </p>

            {loading ? (
              <p className="panel-subtitle">
                Loading follow-ups...
              </p>
            ) : error ? (
              <p className="panel-subtitle">
                Unable to display follow-ups.
              </p>
            ) : upcomingFollowUps.length === 0 ? (
              <p className="panel-subtitle">
                No upcoming follow-ups scheduled.
              </p>
            ) : (
              <div style={{ marginTop: "20px" }}>
                {upcomingFollowUps.map((lead) => (
                  <div
                    key={lead._id}
                    style={historyCardStyle}
                  >
                    <strong>{lead.name}</strong>

                    <p className="panel-subtitle">
                      {lead.phone}
                    </p>

                    <p className="panel-subtitle">
                      Follow-up:{" "}
                      {formatDate(lead.nextFollowUp)}
                    </p>

                    <p className="panel-subtitle">
                      Status: {lead.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* DOCUMENT MANAGEMENT */}
        {activePage === "documents" && (
          <>
            {showDocumentForm && (
            <section className="dashboard-panel" style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <h2>Upload Customer Document</h2>
                <button type="button" disabled={uploadingDocument} onClick={() => { setShowDocumentForm(false); setUploadError(""); setDocumentLeadId(""); setDocumentType(""); setDocumentFile(null); if (documentInputRef.current) documentInputRef.current.value = ""; }} style={primaryButtonStyle}>✕ Cancel</button>
              </div>

              <p className="panel-subtitle">
                Upload a PDF, JPG, or PNG document for a
                customer assigned to you. Maximum size: 5 MB.
              </p>

              {uploadError && (
                <p
                  role="alert"
                  style={{
                    color: "#b42318",
                    marginTop: "16px",
                  }}
                >
                  {uploadError}
                </p>
              )}

              {loading ? (
                <p className="panel-subtitle">
                  Loading assigned customers...
                </p>
              ) : error ? (
                <p role="alert" style={{ color: "#b42318" }}>
                  {error}
                </p>
              ) : leads.length === 0 ? (
                <p className="panel-subtitle">
                  No customers assigned yet. Ask your admin
                  to assign a lead before uploading documents.
                </p>
              ) : (
                <form
                  onSubmit={handleUploadDocument}
                  style={{
                    display: "grid",
                    gap: "20px",
                    marginTop: "24px",
                    width: "100%",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                  }}
                >
                  <label style={{ ...fieldStyle, minWidth: 0 }}>
                    <strong>Select Customer *</strong>

                    <select
                      value={documentLeadId}
                      onChange={(event) => {
                        setDocumentLeadId(event.target.value);
                        setUploadError("");
                      }}
                      style={inputStyle}
                      required
                      disabled={uploadingDocument}
                    >
                      <option value="">
                        Choose assigned customer
                      </option>

                      {leads.map((lead) => (
                        <option
                          key={lead._id}
                          value={lead._id}
                        >
                          {lead.name} - {lead.phone}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ ...fieldStyle, minWidth: 0 }}>
                    <strong>Document Type *</strong>

                    <select
                      value={documentType}
                      onChange={(event) => {
                        setDocumentType(event.target.value);
                        setUploadError("");
                      }}
                      style={inputStyle}
                      required
                      disabled={uploadingDocument}
                    >
                      <option value="">
                        Choose document type
                      </option>

                      {documentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ ...fieldStyle, minWidth: 0 }}>
                    <strong>Select File *</strong>

                    <input
                      ref={documentInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleDocumentFileChange}
                      style={inputStyle}
                      required
                      disabled={uploadingDocument}
                    />

                    <span
                      className="panel-subtitle"
                      style={{ fontSize: "12px" }}
                    >
                      PDF, JPG, or PNG only. Maximum 5 MB.
                    </span>
                  </label>

                  {documentFile && (
                    <p className="panel-subtitle" style={{ gridColumn: "1 / -1", overflowWrap: "anywhere" }}>
                      Selected: {documentFile.name} (
                      {(documentFile.size / 1024).toFixed(1)}
                      {" "}KB)
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={uploadingDocument}
                    style={{
                      ...primaryButtonStyle,
                      gridColumn: "1 / -1",
                      width: "100%",
                      background: uploadingDocument
                        ? "#8c7869"
                        : "#382218",
                      cursor: uploadingDocument
                        ? "not-allowed"
                        : "pointer",
                    }}
                  >
                    {uploadingDocument
                      ? "Uploading Document..."
                      : "Upload Document"}
                  </button>
                </form>
              )}
            </section>
            )}

            {/* UPLOADED DOCUMENTS */}
            <section
              className="dashboard-panel"
              style={{ marginTop: "24px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
                <div>
                  <h2>My Customer Documents</h2>
                  <p className="panel-subtitle">Uploaded documents and their current admin verification status.</p>
                </div>
                <button type="button" disabled={uploadingDocument} onClick={() => { setShowDocumentForm((previous) => !previous); setUploadError(""); }} style={primaryButtonStyle}>
                  {showDocumentForm ? "✕ Hide Upload Form" : "+ Upload Document"}
                </button>
              </div>

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

              {documentsLoading ? (
                <p className="panel-subtitle">
                  Loading documents...
                </p>
              ) : documentsError && documents.length === 0 ? (
                <p className="panel-subtitle">
                  Unable to display documents.
                </p>
              ) : documents.length === 0 ? (
                <p className="panel-subtitle">
                  No documents uploaded yet.
                </p>
              ) : (
                <div style={{ marginTop: "18px" }}>
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
                        style={historyCardStyle}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "12px",
                          }}
                        >
                          <strong>
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
                          File: {item.originalName}
                        </p>

                        <p className="panel-subtitle">
                          Uploaded: {formatDate(item.createdAt)}
                        </p>

                        {item.verificationRemarks && (
                          <p
                            style={{
                              marginTop: "10px",
                              overflowWrap: "anywhere",
                            }}
                          >
                            <strong>
                              Admin Remarks:
                            </strong>{" "}
                            {item.verificationRemarks}
                          </p>
                        )}

                        <button
                          type="button"
                          disabled={
                            openingDocumentId === item._id
                          }
                          onClick={() =>
                            handleOpenDocument(item._id)
                          }
                          style={{
                            ...primaryButtonStyle,
                            marginTop: "12px",
                            padding: "10px 16px",
                            background:
                              openingDocumentId === item._id
                                ? "#8c7869"
                                : "#382218",
                          }}
                        >
                          {openingDocumentId === item._id
                            ? "Opening..."
                            : "Download Document"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* STAFF LOAN APPLICATIONS */}
        {activePage === "loanApplications" && (
          <LoanApplicationManagement />
        )}

        
      </main>
    </div>
  );
}

export default StaffDashboard;
