
import { useEffect, useRef, useState } from "react";

const API = "http://localhost:5000/api";

const emptyForm = {
  lead: "",
  bank: "",
  loanScheme: "",
  requestedAmount: "",
  tenureMonths: "",
  remarks: "",
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  boxSizing: "border-box",
  border: "1px solid #c6ad99",
  borderRadius: "9px",
  background: "#fffaf5",
  color: "#281910",
  font: "inherit",
};

const buttonStyle = {
  padding: "11px 16px",
  border: "none",
  borderRadius: "9px",
  background: "#382218",
  color: "#fffaf5",
  fontWeight: 700,
  cursor: "pointer",
};

const panelStyle = {
  marginTop: "20px",
  padding: "24px",
  background: "#fffaf5",
  border: "1px solid #e4d4c5",
  borderRadius: "14px",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: "16px",
};

function getId(value) {
  if (!value) return "";
  return typeof value === "string"
    ? value
    : value._id || "";
}

function money(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN");
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: "7px" }}>
      <strong style={{ color: "#382218" }}>
        {label}
      </strong>
      {children}
    </label>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Draft: ["#f0e6dc", "#67412b"],
    Submitted: ["#e4efff", "#2356a0"],
    "Under Review": ["#fff0cd", "#8b5b00"],
    Approved: ["#e4f6ea", "#17633a"],
    Rejected: ["#ffe6e2", "#a1261c"],
    Closed: ["#e9e9e9", "#454545"],
  };

  const [background, color] =
    styles[status] || styles.Draft;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 11px",
        borderRadius: "20px",
        background,
        color,
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

export default function LoanApplicationManagement() {
  const [user] = useState(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("user") || "{}"
      );
    } catch {
      return {};
    }
  });

  const isAdmin = user.role === "admin";
  const isStaff = user.role === "staff";

  const [applications, setApplications] = useState([]);
  const [leads, setLeads] = useState([]);
  const [banks, setBanks] = useState([]);
  const [schemes, setSchemes] = useState([]);

  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState("");

  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({
      message:
        message ||
        (type === "error"
          ? "Something went wrong."
          : "Operation completed successfully."),
      type,
      id: Date.now(),
    });
  }

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast]);

  async function request(path, options = {}) {
    const token = sessionStorage.getItem("token");

    if (!token) {
      throw new Error(
        "Session expired. Please log in again."
      );
    }

    let response;

    try {
      response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body
            ? { "Content-Type": "application/json" }
            : {}),
        },
      });
    } catch {
      throw new Error(
        "Cannot connect to the backend server."
      );
    }

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid server response.");
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Request failed."
      );
    }

    return data;
  }

  async function loadData() {
    setLoading(true);

    try {
      const applicationData = await request(
        "/loan-applications"
      );

      if (!Array.isArray(applicationData.applications)) {
        throw new Error(
          "Invalid application data received."
        );
      }

      setApplications(applicationData.applications);

      // Only staff needs data for creating applications.
      if (isStaff) {
        const [leadData, bankData, schemeData] =
          await Promise.all([
            request("/leads/my-leads"),
            request("/banks"),
            request("/loan-schemes"),
          ]);

        if (
          !Array.isArray(leadData.leads) ||
          !Array.isArray(bankData.banks) ||
          !Array.isArray(schemeData.schemes)
        ) {
          throw new Error(
            "Invalid form data received from the backend."
          );
        }

        setLeads(leadData.leads);
        setBanks(bankData.banks);
        setSchemes(schemeData.schemes);
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateForm(field, value) {
    setForm((previous) => {
      const updated = {
        ...previous,
        [field]: value,
      };

      if (field === "lead") {
        const lead = leads.find(
          (item) => item._id === value
        );

        updated.requestedAmount = lead
          ? String(lead.loanAmount || "")
          : "";

        updated.bank = "";
        updated.loanScheme = "";
        updated.tenureMonths = "";
      }

      if (field === "bank") {
        updated.loanScheme = "";
        updated.tenureMonths = "";
      }

      if (field === "loanScheme") {
        const scheme = schemes.find(
          (item) => item._id === value
        );

        updated.tenureMonths = scheme
          ? String(scheme.minTenureMonths)
          : "";
      }

      return updated;
    });
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId("");
    setShowForm(false);
  }

  function openCreateForm() {
    if (!isStaff || isBusy) return;
    if (showForm) {
      resetForm();
      return;
    }
    setForm({ ...emptyForm });
    setEditingId("");
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  const selectedLead = leads.find(
    (lead) => lead._id === form.lead
  );

  const selectedScheme = schemes.find(
    (scheme) => scheme._id === form.loanScheme
  );

  const availableSchemes = schemes.filter(
    (scheme) =>
      (scheme.isActive ||
        (editingId &&
          scheme._id === form.loanScheme)) &&
      getId(scheme.bank) === form.bank &&
      (!selectedLead ||
        scheme.loanType === selectedLead.loanType)
  );

  const isBusy = saving || Boolean(busyId);

  async function saveApplication(event) {
    event.preventDefault();

    // Extra frontend protection.
    if (!isStaff) {
      showToast(
        "Only employees can create loan applications.",
        "error"
      );
      return;
    }

    setToast(null);

    if (
      !form.lead ||
      !form.bank ||
      !form.loanScheme
    ) {
      showToast(
        "Select a customer, bank, and loan scheme.",
        "error"
      );
      return;
    }

    const amount = Number(form.requestedAmount);
    const tenure = Number(form.tenureMonths);

    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      showToast(
        "Requested amount must be a positive whole number.",
        "error"
      );
      return;
    }

    if (
      !Number.isSafeInteger(tenure) ||
      tenure <= 0
    ) {
      showToast(
        "Tenure must be a positive whole number.",
        "error"
      );
      return;
    }

    if (
      !selectedScheme ||
      amount < selectedScheme.minLoanAmount ||
      amount > selectedScheme.maxLoanAmount
    ) {
      showToast(
        "Amount is outside the selected scheme limits.",
        "error"
      );
      return;
    }

    if (
      tenure < selectedScheme.minTenureMonths ||
      tenure > selectedScheme.maxTenureMonths
    ) {
      showToast(
        "Tenure is outside the selected scheme limits.",
        "error"
      );
      return;
    }

    if (form.remarks.trim().length > 2000) {
      showToast(
        "Remarks cannot exceed 2000 characters.",
        "error"
      );
      return;
    }

    const payload = {
      lead: form.lead,
      bank: form.bank,
      loanScheme: form.loanScheme,
      requestedAmount: amount,
      tenureMonths: tenure,
      remarks: form.remarks.trim(),
    };

    setSaving(true);

    try {
      const editing = Boolean(editingId);

      const result = await request(
        editing
          ? `/loan-applications/${editingId}`
          : "/loan-applications",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      setApplications((previous) =>
        editing
          ? previous.map((item) =>
              item._id === result.application._id
                ? result.application
                : item
            )
          : [result.application, ...previous]
      );

      resetForm();

      showToast(
        result.message ||
          "Application saved successfully."
      );
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function editApplication(application) {
    if (!isStaff || application.status !== "Draft") {
      return;
    }

    setEditingId(application._id);
    setShowForm(true);

    setForm({
      lead: getId(application.lead),
      bank: getId(application.bank),
      loanScheme: getId(application.loanScheme),
      requestedAmount: String(
        application.requestedAmount
      ),
      tenureMonths: String(application.tenureMonths),
      remarks: application.remarks || "",
    });

    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function performAction(
    application,
    action,
    body = {}
  ) {
    if (isBusy) return;

    const staffActions = ["submit"];
    const adminActions = ["review", "decision", "close"];

    if (
      (staffActions.includes(action) && !isStaff) ||
      (adminActions.includes(action) && !isAdmin)
    ) {
      showToast(
        "You do not have permission for this action.",
        "error"
      );
      return;
    }

    setBusyId(application._id);
    setToast(null);

    try {
      const result = await request(
        `/loan-applications/${application._id}/${action}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        }
      );

      setApplications((previous) =>
        previous.map((item) =>
          item._id === result.application._id
            ? result.application
            : item
        )
      );

      if (editingId === application._id) {
        resetForm();
      }

      showToast(
        result.message ||
          "Application updated successfully."
      );
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusyId("");
    }
  }

  function decideApplication(application, decision) {
    if (!isAdmin) return;

    let approvedAmount;

    if (decision === "Approved") {
      const entered = window.prompt(
        "Enter approved loan amount (₹):",
        String(application.requestedAmount)
      );

      if (entered === null) return;

      if (!/^[1-9]\d*$/.test(entered.trim())) {
        showToast(
          "Enter a valid positive whole-number amount.",
          "error"
        );
        return;
      }

      approvedAmount = Number(entered.trim());

      if (
        !Number.isSafeInteger(approvedAmount) ||
        approvedAmount > application.requestedAmount
      ) {
        showToast(
          "Approved amount cannot exceed the requested amount.",
          "error"
        );
        return;
      }
    }

    const enteredRemarks = window.prompt(
      decision === "Rejected"
        ? "Enter rejection reason (required):"
        : "Enter approval remarks (optional):",
      ""
    );

    if (enteredRemarks === null) return;

    const remarks = enteredRemarks.trim();

    if (remarks.length > 1000) {
      showToast(
        "Decision remarks cannot exceed 1000 characters.",
        "error"
      );
      return;
    }

    if (
      decision === "Rejected" &&
      remarks.length < 2
    ) {
      showToast(
        "Rejection reason must contain at least 2 characters.",
        "error"
      );
      return;
    }

    performAction(application, "decision", {
      decision,
      ...(decision === "Approved"
        ? { approvedAmount }
        : {}),
      decisionRemarks: remarks,
    });
  }

  function closeApplication(application) {
    if (!isAdmin) return;

    const entered = window.prompt(
      "Enter closure remarks (optional):",
      ""
    );

    if (entered === null) return;

    const remarks = entered.trim();

    if (remarks.length > 1000) {
      showToast(
        "Closure remarks cannot exceed 1000 characters.",
        "error"
      );
      return;
    }

    performAction(application, "close", {
      remarks,
    });
  }

  const filteredApplications = applications.filter(
    (application) => {
      const text = [
        application.lead?.name,
        application.lead?.phone,
        application.bank?.name,
        application.loanScheme?.schemeName,
        application.assignedTo?.name,
        application.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        text.includes(search.trim().toLowerCase()) &&
        (!statusFilter ||
          application.status === statusFilter)
      );
    }
  );

  
const stats = [
  ["Total Applications", applications.length],
  [
    "Pending Review",
    applications.filter((item) =>
      ["Submitted", "Under Review"].includes(item.status)
    ).length,
  ],
  [
    "Approved",
    applications.filter(
      (item) => item.status === "Approved"
    ).length,
  ],
  [
    "Rejected",
    applications.filter(
      (item) => item.status === "Rejected"
    ).length,
  ],
  [
    "Closed",
    applications.filter(
      (item) => item.status === "Closed"
    ).length,
  ],
];


  return (
    <div style={{ color: "#281910" }}>
      {/* FLOATING SUCCESS / ERROR TOAST */}
      {toast && (
        <div
          role={
            toast.type === "error"
              ? "alert"
              : "status"
          }
          aria-live={
            toast.type === "error"
              ? "assertive"
              : "polite"
          }
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 9999,
            width: "min(380px, calc(100vw - 48px))",
            boxSizing: "border-box",
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
            padding: "16px 18px",
            borderRadius: "12px",
            background:
              toast.type === "error"
                ? "#fff0ed"
                : "#eaf7ef",
            color:
              toast.type === "error"
                ? "#8f241c"
                : "#17633a",
            border: `1px solid ${
              toast.type === "error"
                ? "#e7a49b"
                : "#a1d8b5"
            }`,
            borderLeft: `5px solid ${
              toast.type === "error"
                ? "#b42318"
                : "#287a4b"
            }`,
            boxShadow:
              "0 12px 35px rgba(28,17,10,0.18)",
          }}
        >
          <span style={{ fontSize: "21px" }}>
            {toast.type === "error" ? "✕" : "✓"}
          </span>

          <div style={{ flex: 1 }}>
            <strong>
              {toast.type === "error"
                ? "Error"
                : "Success"}
            </strong>
            <p
              style={{
                margin: "5px 0 0",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              {toast.message}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close notification"
            onClick={() => setToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "20px",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <section className="stats-grid loan-application-stats">
        {stats.map(([title, value]) => (
          <div className="stat-card" key={title}>
            <p>{title}</p>
            <h2>{loading ? "—" : value}</h2>
            
          </div>
        ))}
      </section>

      {/* ADMIN INFORMATION */}
      {isAdmin && (
        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>
            Loan Application Review
          </h2>
          <p style={{ marginBottom: 0 }}>
            Review submitted applications,
            record approval or rejection decisions,
            and close approved applications below.
          </p>
        </section>
      )}

      {/* APPLICATION DIRECTORY */}
      <section style={panelStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              {isAdmin
                ? "Loan Application Directory"
                : "My Loan Applications"}
            </h2>
            {isStaff && (
              <p style={{ margin: "8px 0 0", color: "#765d4b" }}>
                Create drafts, submit applications, and track their progress.
              </p>
            )}
          </div>
          {isStaff && (
            <button
              type="button"
              style={buttonStyle}
              disabled={isBusy || loading}
              onClick={openCreateForm}
            >
              {showForm ? "✕ Cancel" : "+ Create Loan Application"}
            </button>
          )}
        </div>

      {/* STAFF-ONLY CREATE / EDIT FORM */}
      {isStaff && showForm && (
        <section ref={formRef} style={{ ...panelStyle, marginTop: "0", marginBottom: "22px", scrollMarginTop: "24px" }}>
          <h2 style={{ marginTop: 0 }}>
            {editingId
              ? "Edit Draft Application"
              : "Create Loan Application"}
          </h2>

          <p>
            Select one of your assigned customers and
            an eligible bank loan scheme.
          </p>

          <form onSubmit={saveApplication}>
            <div style={gridStyle}>
              <Field label="Customer Lead *">
                <select
                  style={inputStyle}
                  required
                  disabled={isBusy || loading}
                  value={form.lead}
                  onChange={(event) =>
                    updateForm("lead", event.target.value)
                  }
                >
                  <option value="">
                    Select customer
                  </option>

                  {leads.map((lead) => (
                    <option
                      key={lead._id}
                      value={lead._id}
                    >
                      {lead.name} — {lead.loanType}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Bank *">
                <select
                  style={inputStyle}
                  required
                  disabled={isBusy || loading}
                  value={form.bank}
                  onChange={(event) =>
                    updateForm("bank", event.target.value)
                  }
                >
                  <option value="">
                    Select bank
                  </option>

                  {banks
                    .filter(
                      (bank) =>
                        bank.isActive ||
                        (editingId &&
                          bank._id === form.bank)
                    )
                    .map((bank) => (
                      <option
                        key={bank._id}
                        value={bank._id}
                      >
                        {bank.name}
                        {!bank.isActive
                          ? " (Inactive)"
                          : ""}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label="Loan Scheme *">
                <select
                  style={inputStyle}
                  required
                  disabled={
                    isBusy || loading || !form.bank
                  }
                  value={form.loanScheme}
                  onChange={(event) =>
                    updateForm(
                      "loanScheme",
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select eligible scheme
                  </option>

                  {availableSchemes.map((scheme) => (
                    <option
                      key={scheme._id}
                      value={scheme._id}
                    >
                      {scheme.schemeName} —{" "}
                      {scheme.interestRate}%
                      {!scheme.isActive
                        ? " (Inactive)"
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Requested Amount (₹) *">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  style={inputStyle}
                  disabled={isBusy || loading}
                  value={form.requestedAmount}
                  onChange={(event) =>
                    updateForm(
                      "requestedAmount",
                      event.target.value
                    )
                  }
                />
              </Field>

              <Field label="Tenure (Months) *">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  style={inputStyle}
                  disabled={isBusy || loading}
                  value={form.tenureMonths}
                  onChange={(event) =>
                    updateForm(
                      "tenureMonths",
                      event.target.value
                    )
                  }
                />
              </Field>
            </div>

            {selectedScheme && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px",
                  background: "#f3e8dd",
                  borderRadius: "10px",
                  lineHeight: 1.7,
                }}
              >
                <strong>
                  Selected Scheme Limits
                </strong>

                <div>
                  Amount:{" "}
                  {money(selectedScheme.minLoanAmount)}
                  {" – "}
                  {money(selectedScheme.maxLoanAmount)}
                </div>

                <div>
                  Tenure:{" "}
                  {selectedScheme.minTenureMonths}
                  {" – "}
                  {selectedScheme.maxTenureMonths}
                  {" months"}
                </div>

                <div>
                  Interest:{" "}
                  {selectedScheme.interestRate}%
                </div>
              </div>
            )}

            <div style={{ marginTop: "16px" }}>
              <Field label="Application Remarks">
                <textarea
                  rows={3}
                  maxLength={2000}
                  style={inputStyle}
                  disabled={isBusy || loading}
                  value={form.remarks}
                  onChange={(event) =>
                    updateForm(
                      "remarks",
                      event.target.value
                    )
                  }
                  placeholder="Enter application notes"
                />
              </Field>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                marginTop: "18px",
                width: "100%",
              }}
            >
              <button
                type="submit"
                style={{ ...buttonStyle, flex: "1 1 240px" }}
                disabled={isBusy || loading}
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Draft"
                  : "Create Draft"}
              </button>

              {showForm && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={resetForm}
                  style={{
                    ...buttonStyle,
                    background: "#ead9c9",
                    color: "#382218",
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      )}

        <div style={gridStyle}>
          <Field label="Search Applications">
            <input
              style={inputStyle}
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Customer, bank, employee..."
            />
          </Field>

          <Field label="Filter by Status">
            <select
              style={inputStyle}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="">All Statuses</option>

              {[
                "Draft",
                "Submitted",
                "Under Review",
                "Approved",
                "Rejected",
                "Closed",
              ].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {loading ? (
          <p style={{ marginTop: "22px" }}>
            Loading applications...
          </p>
        ) : filteredApplications.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px",
              marginTop: "20px",
              background: "#f4e9de",
              borderRadius: "12px",
            }}
          >
            <h3>No applications found</h3>
            
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "16px",
              marginTop: "20px",
            }}
          >
            {filteredApplications.map((application) => {
              const busy =
                busyId === application._id;

              return (
                <article
                  key={application._id}
                  style={{
                    border: "1px solid #e4d4c5",
                    borderRadius: "12px",
                    padding: "20px",
                    background: "#fffdf9",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: "0 0 7px",
                          color: "#21140f",
                        }}
                      >
                        {application.lead?.name ||
                          "Customer unavailable"}
                      </h3>

                      <small>
                        Created:{" "}
                        {formatDate(
                          application.createdAt
                        )}
                      </small>
                    </div>

                    <StatusBadge
                      status={application.status}
                    />
                  </div>

                  <div
                    style={{
                      ...gridStyle,
                      marginTop: "18px",
                      fontSize: "14px",
                      lineHeight: 1.6,
                    }}
                  >
                    <div>
                      <strong>Bank</strong>
                      <div>
                        {application.bank?.name || "—"}
                      </div>
                    </div>

                    <div>
                      <strong>Loan Scheme</strong>
                      <div>
                        {application.loanScheme
                          ?.schemeName || "—"}
                      </div>
                    </div>

                    <div>
                      <strong>Requested Amount</strong>
                      <div>
                        {money(
                          application.requestedAmount
                        )}
                      </div>
                    </div>

                    <div>
                      <strong>Tenure</strong>
                      <div>
                        {application.tenureMonths} months
                      </div>
                    </div>

                    <div>
                      <strong>Assigned Employee</strong>
                      <div>
                        {application.assignedTo?.name ||
                          "—"}
                      </div>
                    </div>

                    <div>
                      <strong>Approved Amount</strong>
                      <div>
                        {money(
                          application.approvedAmount
                        )}
                      </div>
                    </div>
                  </div>

                  {application.decisionRemarks && (
                    <p
                      style={{
                        marginTop: "16px",
                        padding: "12px",
                        background: "#f3e8dd",
                        borderRadius: "8px",
                      }}
                    >
                      <strong>
                        Admin Decision:
                      </strong>{" "}
                      {application.decisionRemarks}
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "9px",
                      marginTop: "18px",
                    }}
                  >
                    {/* STAFF-ONLY ACTIONS */}
                    {isStaff &&
                      application.status === "Draft" && (
                        <>
                          <button
                            type="button"
                            style={buttonStyle}
                            disabled={isBusy}
                            onClick={() =>
                              editApplication(application)
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            style={{
                              ...buttonStyle,
                              background: "#287a4b",
                            }}
                            onClick={() =>
                              performAction(
                                application,
                                "submit"
                              )
                            }
                          >
                            {busy
                              ? "Processing..."
                              : "Submit for Review"}
                          </button>
                        </>
                      )}

                    {/* ADMIN-ONLY REVIEW */}
                    {isAdmin &&
                      application.status ===
                        "Submitted" && (
                        <button
                          type="button"
                          style={buttonStyle}
                          disabled={isBusy}
                          onClick={() =>
                            performAction(
                              application,
                              "review"
                            )
                          }
                        >
                          {busy
                            ? "Processing..."
                            : "Start Review"}
                        </button>
                      )}

                    {/* ADMIN-ONLY DECISION */}
                    {isAdmin &&
                      application.status ===
                        "Under Review" && (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            style={{
                              ...buttonStyle,
                              background: "#287a4b",
                            }}
                            onClick={() =>
                              decideApplication(
                                application,
                                "Approved"
                              )
                            }
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            style={{
                              ...buttonStyle,
                              background: "#a1261c",
                            }}
                            onClick={() =>
                              decideApplication(
                                application,
                                "Rejected"
                              )
                            }
                          >
                            Reject
                          </button>
                        </>
                      )}

                    {/* ADMIN-ONLY CLOSURE */}
                    {isAdmin &&
                      application.status ===
                        "Approved" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          style={buttonStyle}
                          onClick={() =>
                            closeApplication(application)
                          }
                        >
                          Close Application
                        </button>
                      )}

                    {/* HISTORY FOR BOTH ROLES */}
                    <button
                      type="button"
                      disabled={isBusy}
                      style={{
                        ...buttonStyle,
                        background: "#ead9c9",
                        color: "#382218",
                      }}
                      onClick={() =>
                        setExpandedId(
                          expandedId === application._id
                            ? ""
                            : application._id
                        )
                      }
                    >
                      {expandedId === application._id
                        ? "Hide History"
                        : "View History"}
                    </button>
                  </div>

                  {expandedId === application._id && (
                    <div
                      style={{
                        marginTop: "18px",
                        padding: "16px",
                        background: "#f5ece3",
                        borderRadius: "10px",
                      }}
                    >
                      <h4 style={{ marginTop: 0 }}>
                        Application History
                      </h4>

                      {application.remarks && (
                        <p>
                          <strong>
                            Application Notes:
                          </strong>{" "}
                          {application.remarks}
                        </p>
                      )}

                      {!application.statusHistory
                        ?.length ? (
                        <p>No history recorded.</p>
                      ) : (
                        <div
                          style={{
                            display: "grid",
                            gap: "12px",
                          }}
                        >
                          {application.statusHistory.map(
                            (entry, index) => (
                              <div
                                key={entry._id || index}
                                style={{
                                  paddingBottom: "10px",
                                  borderBottom:
                                    "1px solid #dfcdbd",
                                }}
                              >
                                <StatusBadge
                                  status={entry.status}
                                />

                                <p
                                  style={{
                                    margin: "8px 0 4px",
                                  }}
                                >
                                  {entry.remarks ||
                                    "Status updated"}
                                </p>

                                <small>
                                  {entry.changedBy?.name ||
                                    "User unavailable"}
                                  {" · "}
                                  {formatDate(
                                    entry.changedAt
                                  )}
                                </small>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
