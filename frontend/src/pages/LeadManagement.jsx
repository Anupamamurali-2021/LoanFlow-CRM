import { useState, useEffect, useCallback } from "react";
const API = "http://localhost:5000/api";
const loanTypes = [
  "Personal Loan",
  "Home Loan",
  "Business Loan",
  "Vehicle Loan",
  "Education Loan",
];
const statuses = [
  "New",
  "Contacted",
  "Interested",
  "Not Interested",
  "Follow-up",
  "Converted",
];
const emptyForm = {
  name: "",
  phone: "",
  email: "",
  loanType: "",
  loanAmount: "",
  remarks: "",
};

// Parse CSV including quoted commas, escaped quotes and multiline fields.
function parseLeadCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else if (quoted) quoted = false;
      else if (field === "") quoted = true;
      else throw new Error("Invalid quotation mark in CSV.");
    } else if (char === "," && !quoted) {
      row.push(field); field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = []; field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("CSV has an unclosed quoted value.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

const bulkColumns = ["name", "phone", "email", "loanType", "loanAmount", "remarks", "status", "assignedTo"];

function downloadLeadTemplate() {
  const sample = [
    bulkColumns.join(","),
    '"Sample Customer","9876543210","sample@example.com","Personal Loan","250000","Interested in a loan","New",""',
  ].join("\r\n");
  const blob = new Blob(["\uFEFF", sample], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "loanflow-bulk-leads-template.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function LeadManagement() {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkInputKey, setBulkInputKey] = useState(0);
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [error, setError] = useState("");
  const [leadsError, setLeadsError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [followUpId, setFollowUpId] = useState(null);
  const [followUpDate, setFollowUpDate] = useState("");
  // Get the logged-in admin token
  const getToken = () => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      throw new Error("Session expired. Please log in again.");
    }
    return token;
  };
  // Reusable API function
  const apiRequest = useCallback(async (path, options = {}) => {
    const token = getToken();
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Request failed.");
    }
    return data;
  }, []);
  // Show a toast for 3 seconds
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setMessage("");
    }, 3000);
    return () => clearTimeout(timer);
  }, [message]);
  // Load leads from MongoDB
  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    setLeadsError("");
    try {
      const data = await apiRequest("/leads");
      if (!Array.isArray(data.leads)) {
        throw new Error("Invalid leads data received.");
      }
      setLeads(data.leads);
    } catch (err) {
      setLeadsError(err.message);
    } finally {
      setLeadsLoading(false);
    }
  }, [apiRequest]);
  // Load active staff members
  const fetchEmployees = useCallback(async () => {
    try {
      const data = await apiRequest("/admin/employees");
      setEmployees(
        Array.isArray(data.employees) ? data.employees : []
      );
    } catch (err) {
      console.error("Employee loading error:", err.message);
      setLeadsError(
        (previous) =>
          previous ||
          `Employee list unavailable: ${err.message}`
      );
    }
  }, [apiRequest]);
  useEffect(() => {
    fetchLeads();
    fetchEmployees();
  }, [fetchLeads, fetchEmployees]);
  // Update Add/Edit form
  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setError("");
  };
  // Validate customer details
  const validateForm = () => {
    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const amount = Number(form.loanAmount);
    if (name.length < 2 || name.length > 100) {
      return "Customer name must be 2 to 100 characters.";
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return "Enter a valid 10-digit Indian mobile number.";
    }
    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return "Enter a valid email address.";
    }
    if (!loanTypes.includes(form.loanType)) {
      return "Please select a valid loan type.";
    }
    if (
      !form.loanAmount ||
      !Number.isFinite(amount) ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return "Enter a positive whole-number loan amount.";
    }
    if (form.remarks.length > 1000) {
      return "Remarks cannot exceed 1000 characters.";
    }
    return "";
  };
  // Add or edit a lead
  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        loanType: form.loanType,
        loanAmount: Number(form.loanAmount),
        remarks: form.remarks.trim(),
      };
      const isEditing = Boolean(editingId);
      await apiRequest(
        isEditing ? `/leads/${editingId}` : "/leads",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      setMessage(
        isEditing
          ? "Lead updated successfully!"
          : "Lead added successfully!"
      );
      await fetchLeads();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  // Fill form with existing lead details
  const startEditing = (lead) => {
  setEditingId(lead._id);
  setShowForm(true);
    setForm({
      name: lead.name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      loanType: lead.loanType || "",
      loanAmount: String(lead.loanAmount ?? ""),
      remarks: lead.remarks || "",
    });
    setError("");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };
  const cancelEditing = () => {
  setEditingId(null);
  setForm(emptyForm);
  setError("");
  setShowForm(false);
};
  // Reusable update for status and assignment
  const updateLead = async (id, path, payload, successText) => {
    setBusyId(id);
    setLeadsError("");
    try {
      await apiRequest(`/leads/${id}/${path}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setMessage(successText);
      await fetchLeads();
      return true;
    } catch (err) {
      setLeadsError(err.message);
      return false;
    } finally {
      setBusyId(null);
    }
  };
  // Update lead status
  const changeStatus = async (lead, status) => {
    await updateLead(
      lead._id,
      "status",
      { status },
      "Lead status updated successfully!"
    );
  };
  // Assign or unassign an employee
  const assignEmployee = async (lead, employeeId) => {
    await updateLead(
      lead._id,
      "assign",
      { assignedTo: employeeId || null },
      "Employee assignment updated!"
    );
  };
  // Schedule follow-up
  const saveFollowUp = async (leadId) => {
    if (!followUpDate) {
      setLeadsError("Please select a follow-up date and time.");
      return;
    }
    const date = new Date(followUpDate);
    if (
      Number.isNaN(date.getTime()) ||
      date.getTime() <= Date.now()
    ) {
      setLeadsError("Follow-up must be a future date and time.");
      return;
    }
    const saved = await updateLead(
      leadId,
      "follow-up",
      { nextFollowUp: date.toISOString() },
      "Follow-up scheduled successfully!"
    );
    if (saved) {
      setFollowUpId(null);
      setFollowUpDate("");
    }
  };
  // Remove an existing follow-up
  const clearFollowUp = async (leadId) => {
    const saved = await updateLead(
      leadId,
      "follow-up",
      { nextFollowUp: null },
      "Follow-up cleared successfully!"
    );
    if (saved) {
      setFollowUpId(null);
      setFollowUpDate("");
    }
  };
  const selectBulkFile = async (event) => {
    const file = event.target.files?.[0];
    setBulkFile(null);
    setBulkPreview([]);
    setBulkResult(null);
    setBulkError("");
    if (!file) return;
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error("Select a .csv file.");
      if (file.size > 2 * 1024 * 1024) throw new Error("CSV must be 2 MB or smaller.");
      const rows = parseLeadCSV(await file.text());
      if (rows.length < 2) throw new Error("CSV must include a header and at least one lead.");
      const headers = rows[0].map((value) => value.trim());
      if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate column headers.");
      const required = ["name", "phone", "loanType", "loanAmount"];
      const missing = required.filter((name) => !headers.includes(name));
      if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);
      const unknown = headers.filter((name) => !bulkColumns.includes(name));
      if (unknown.length) throw new Error(`Unsupported columns: ${unknown.join(", ")}. Use the sample template.`);
      if (rows.length - 1 > 500) throw new Error("Maximum 500 leads per upload.");
      const parsed = rows.slice(1).map((cells, index) => {
        if (cells.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of columns.`);
        const record = {};
        headers.forEach((header, i) => { record[header] = cells[i].trim(); });
        return record;
      });
      setBulkFile(file);
      setBulkPreview(parsed);
    } catch (error) {
      setBulkError(error.message);
      event.target.value = "";
    }
  };

  // Reset both React state and the native file input when closing/reopening.
  const resetBulkUpload = () => {
    setBulkFile(null);
    setBulkPreview([]);
    setBulkResult(null);
    setBulkError("");
    setBulkInputKey((previous) => previous + 1);
  };

  const uploadBulkLeads = async () => {
    if (!bulkPreview.length || bulkUploading) return;
    setBulkUploading(true);
    setBulkError("");
    setBulkResult(null);
    try {
      const result = await apiRequest("/leads/bulk-upload", {
        method: "POST",
        body: JSON.stringify({ leads: bulkPreview }),
      });
      setMessage(result.message || "Bulk upload completed.");
      await fetchLeads();
      if (Number(result.failed ?? 0) === 0 && Number(result.skipped ?? 0) === 0 && Number(result.imported ?? 0) > 0) {
        resetBulkUpload();
        setShowBulkForm(false);
      } else {
        // Keep partial-import errors visible for review.
        setBulkResult(result);
      }
    } catch (error) {
      setBulkError(error.message);
    } finally {
      setBulkUploading(false);
    }
  };

  // Instant search and filters
  const filteredLeads = leads.filter((lead) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      String(lead.name || "").toLowerCase().includes(term) ||
      String(lead.phone || "").includes(term);
    const matchesStatus =
      !statusFilter || lead.status === statusFilter;
    const matchesType =
      !typeFilter || lead.loanType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });
  // Export currently filtered leads to CSV
  const exportCSV = () => {
    if (filteredLeads.length === 0) {
      setLeadsError("No leads available to export.");
      return;
    }
    const columns = [
      "Customer",
      "Phone",
      "Email",
      "Loan Type",
      "Amount",
      "Status",
      "Assigned Employee",
      "Follow-up",
      "Remarks",
    ];
    const rows = filteredLeads.map((lead) => [
      lead.name,
      lead.phone,
      lead.email || "",
      lead.loanType,
      lead.loanAmount,
      lead.status,
      lead.assignedTo?.name || "Unassigned",
      lead.nextFollowUp
        ? new Date(lead.nextFollowUp).toLocaleString("en-IN")
        : "",
      lead.remarks || "",
    ]);
    const escapeCSV = (value) => {
      const text = String(value ?? "");
      // Protect spreadsheet users from formula injection
      const safeText = /^\s*[=+\-@]/.test(text)
        ? `'${text}`
        : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const csv = [columns, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "loanflow-leads.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="dashboard-panel">
  <div
    className="lead-section-header"
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "12px",
      marginBottom: "20px",
    }}
  >
    <div>
      <h2>Lead Management</h2>
      <p className="panel-subtitle">
        Manage customer leads and follow-ups.
      </p>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
    <button
      type="button"
      className="lead-action-button"
      disabled={bulkUploading}
      onClick={() => {
        resetBulkUpload();
        if (!showBulkForm) cancelEditing();
        setShowBulkForm(!showBulkForm);
      }}
    >
      {showBulkForm ? "✕ Hide Bulk Upload" : "+ Bulk Upload Leads"}
    </button>
    <button
      type="button"
      className="lead-action-button"
      disabled={loading || bulkUploading}
      onClick={() => {
        if (showBulkForm) {
          resetBulkUpload();
          setShowBulkForm(false);
        }
        if (showForm) {
          cancelEditing();
        } else {
          setEditingId(null);
          setForm(emptyForm);
          setError("");
          setShowForm(true);
        }
      }}
    >
      {showForm ? "✕ Cancel" : "+ Add Lead"}
    </button>
    </div>
  </div>
  {showBulkForm && (
    <div style={{ padding: "22px", marginBottom: "22px", border: "1px solid #e4d4c5", borderRadius: "12px", background: "#fffaf5" }}>
      <h2 style={{ marginTop: 0 }}>Bulk Upload Customer Leads</h2>
      <p className="panel-subtitle">Import up to 500 leads from a CSV file. Required columns: name, phone, loanType, loanAmount. Optional: email, remarks, status, assignedTo (active employee ID). Existing phone numbers will be skipped.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", margin: "18px 0" }}>
        <button type="button" className="lead-secondary-button" onClick={downloadLeadTemplate} disabled={bulkUploading}>Download Sample CSV</button>
        <label style={{ display: "grid", gap: "7px", flex: "1 1 250px", minWidth: 0 }}>
          <strong>Choose CSV file</strong>
          <input key={bulkInputKey} type="file" accept=".csv,text/csv" onChange={selectBulkFile} disabled={bulkUploading} style={{ width: "100%", maxWidth: "100%" }} />
        </label>
      </div>
      {bulkFile && <p><strong>Selected:</strong> {bulkFile.name} — {bulkPreview.length} lead(s)</p>}
      {bulkPreview.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: "16px" }}>
          <p><strong>Preview (first 5 rows)</strong></p>
          <table className="leads-table" style={{ width: "100%" }}>
            <thead><tr><th>Name</th><th>Phone</th><th>Loan Type</th><th>Amount</th></tr></thead>
            <tbody>{bulkPreview.slice(0, 5).map((lead, index) => (
              <tr key={index}><td>{lead.name}</td><td>{lead.phone}</td><td>{lead.loanType}</td><td>{lead.loanAmount}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {bulkError && <p role="alert" style={{ color: "#a1261c" }}>{bulkError}</p>}
      <button type="button" className="lead-action-button" style={{ width: "100%", padding: "13px" }} disabled={!bulkPreview.length || bulkUploading} onClick={uploadBulkLeads}>
        {bulkUploading ? "Importing Leads..." : `Import ${bulkPreview.length} Lead(s)`}
      </button>
      {bulkResult && (
        <div role="status" style={{ marginTop: "18px", padding: "16px", borderRadius: "10px", background: "#f3e8dd" }}>
          <h3 style={{ marginTop: 0 }}>Import Results</h3>
          <p><strong>Total:</strong> {bulkResult.total ?? bulkPreview.length} | <strong>Imported:</strong> {bulkResult.imported ?? 0} | <strong>Skipped:</strong> {bulkResult.skipped ?? 0} | <strong>Failed:</strong> {bulkResult.failed ?? 0}</p>
          {Array.isArray(bulkResult.errors) && bulkResult.errors.length > 0 && (
            <div style={{ maxHeight: "220px", overflowY: "auto" }}>
              <strong>Row details</strong>
              <ul>{bulkResult.errors.map((item, index) => <li key={index}>Row {item.row}: {item.message}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  )}
  {showForm && (
    <div
      id="lead-form-section"
      style={{
        padding: "20px",
        marginBottom: "22px",
        border: "1px solid #e4d4c5",
        borderRadius: "12px",
        background: "#fffaf5",
        scrollMarginTop: "24px",
      }}
    >
      {/* ADD / EDIT LEAD FORM */}
      <div style={{ textAlign: "center" }}>
        <h2>{editingId ? "Edit Customer Lead" : "Add New Lead"}</h2>
        <p className="panel-subtitle">
          {editingId
            ? "Update the selected customer's details."
            : "Enter customer details to create a new loan lead."}
        </p>
      </div>
      <form
        className="lead-form lead-form-compact"
        onSubmit={handleSubmit}
      >
        <div className="lead-form-field">
          <label htmlFor="lead-name">Customer Name</label>
          <input
            id="lead-name"
            name="name"
            value={form.name}
            onChange={handleChange}
            minLength={2}
            maxLength={100}
            required
            placeholder="Enter customer name"
          />
        </div>
        <div className="lead-form-field">
          <label htmlFor="lead-phone">Mobile Number</label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            maxLength={10}
            pattern="[6-9][0-9]{9}"
            required
            placeholder="10-digit mobile number"
          />
        </div>
        <div className="lead-form-field">
          <label htmlFor="lead-email">Email (Optional)</label>
          <input
            id="lead-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="customer@example.com"
          />
        </div>
        <div className="lead-form-field">
          <label htmlFor="lead-type">Loan Type</label>
          <select
            id="lead-type"
            name="loanType"
            value={form.loanType}
            onChange={handleChange}
            required
          >
            <option value="">Select loan type</option>
            {loanTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="lead-form-field">
          <label htmlFor="lead-amount">Loan Amount (₹)</label>
          <input
            id="lead-amount"
            name="loanAmount"
            type="number"
            min="1"
            step="1"
            value={form.loanAmount}
            onChange={handleChange}
            required
            placeholder="Enter loan amount"
          />
        </div>
        <div className="lead-form-field">
          <label htmlFor="lead-remarks">
            Remarks (Optional)
          </label>
          <textarea
            id="lead-remarks"
            name="remarks"
            value={form.remarks}
            onChange={handleChange}
            maxLength={1000}
            rows={3}
            placeholder="Additional customer details"
          />
        </div>
        {error && (
          <p role="alert" style={{ color: "#c0392b" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          className="login-button"
          disabled={loading}
        >
          {loading
            ? "Saving..."
            : editingId
              ? "Save Changes"
              : "Add Lead"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={cancelEditing}
            disabled={loading}
            className="lead-secondary-button"
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  )}
      {/* SUCCESS TOAST */}
      {message && (
        <div className="lead-toast" role="status">
          <span>✓</span>
          <strong>{message}</strong>
          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}
      {/* SAVED LEADS */}
      <div className="saved-leads">
        <div className="lead-section-header">
          <div>
            <h2>Saved Customer Leads</h2>
          </div>
          <button
            type="button"
            onClick={exportCSV}
            className="lead-action-button"
            disabled={leadsLoading || leads.length === 0}
          >
            Export CSV
          </button>
        </div>
        {/* SEARCH AND FILTERS */}
        <div className="lead-toolbar">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or mobile..."
            aria-label="Search customer leads"
            maxLength={100}
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
            aria-label="Filter by loan type"
          >
            <option value="">All Loan Types</option>
            {loanTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        {leadsError && (
          <p role="alert" style={{ color: "#c0392b" }}>
            {leadsError}
          </p>
        )}
        {leadsLoading ? (
          <p>Loading leads...</p>
        ) : leads.length === 0 ? (
          <p>No leads added yet.</p>
        ) : filteredLeads.length === 0 ? (
          <p>No customers match your search or filters.</p>
        ) : (
          <>
            <p className="lead-result-count">
              Showing {filteredLeads.length} of {leads.length} leads
            </p>
            <div className="leads-table-wrapper">
              <table className="leads-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Mobile</th>
                    <th>Loan Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Follow-up</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead._id}>
                      <td>{lead.name}</td>
                      <td>{lead.phone}</td>
                      <td>{lead.loanType}</td>
                      <td>
                        ₹{Number(lead.loanAmount).toLocaleString("en-IN")}
                      </td>
                      {/* STATUS */}
                      <td>
                        <select
                          className="lead-table-select"
                          value={lead.status}
                          disabled={busyId === lead._id}
                          onChange={(event) =>
                            changeStatus(lead, event.target.value)
                          }
                          aria-label={`Status for ${lead.name}`}
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      {/* EMPLOYEE ASSIGNMENT */}
                      <td>
                        <select
                          className="lead-table-select"
                          value={lead.assignedTo?._id || ""}
                          disabled={busyId === lead._id}
                          onChange={(event) =>
                            assignEmployee(
                              lead,
                              event.target.value
                            )
                          }
                          aria-label={`Assign ${lead.name}`}
                        >
                          <option value="">Unassigned</option>
                          {lead.assignedTo?._id &&
                            !employees.some(
                              (employee) =>
                                employee._id ===
                                lead.assignedTo._id
                            ) && (
                              <option
                                value={lead.assignedTo._id}
                              >
                                {lead.assignedTo.name} (Current)
                              </option>
                            )}
                          {employees.map((employee) => (
                            <option
                              key={employee._id}
                              value={employee._id}
                            >
                              {employee.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      {/* FOLLOW-UP */}
                      <td>
                        {lead.nextFollowUp ? (
                          <div className="lead-followup-info">
                            <span>
                              {new Date(
                                lead.nextFollowUp
                              ).toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </span>
                          </div>
                        ) : (
                          <span>Not scheduled</span>
                        )}
                        {followUpId === lead._id ? (
                          <div className="lead-followup-editor">
                            <input
                              type="datetime-local"
                              value={followUpDate}
                              onChange={(event) =>
                                setFollowUpDate(event.target.value)
                              }
                              aria-label="Follow-up date and time"
                            />
                            <button
                              type="button"
                              className="lead-action-button"
                              disabled={busyId === lead._id}
                              onClick={() =>
                                saveFollowUp(lead._id)
                              }
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="lead-secondary-button"
                              onClick={() => {
                                setFollowUpId(null);
                                setFollowUpDate("");
                              }}
                            >
                              Cancel
                            </button>
                            {lead.nextFollowUp && (
                              <button
                                type="button"
                                className="lead-secondary-button"
                                disabled={busyId === lead._id}
                                onClick={() =>
                                  clearFollowUp(lead._id)
                                }
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="lead-link-button"
                            onClick={() => {
                              setFollowUpId(lead._id);
                              setFollowUpDate("");
                            }}
                          >
                            {lead.nextFollowUp
                              ? "Reschedule"
                              : "Schedule"}
                          </button>
                        )}
                      </td>
                      {/* EDIT ACTION */}
                      <td>
                        <button
                          type="button"
                          className="lead-action-button"
                          onClick={() => startEditing(lead)}
                          disabled={busyId === lead._id}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
export default LeadManagement;
