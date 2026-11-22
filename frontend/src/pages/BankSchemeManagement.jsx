
import { useEffect, useRef, useState } from "react";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

const loanTypes = [
  "Personal Loan",
  "Home Loan",
  "Business Loan",
  "Vehicle Loan",
  "Education Loan",
  "Gold Loan",
  "Other",
];

const emptyBank = {
  name: "",
  code: "",
  description: "",
};

const emptyScheme = {
  bank: "",
  schemeName: "",
  loanType: "",
  interestRate: "",
  minLoanAmount: "",
  maxLoanAmount: "",
  minTenureMonths: "",
  maxTenureMonths: "",
  eligibilityCriteria: "",
  description: "",
};

const colors = {
  brown: "#382218",
  cream: "#fffaf5",
  border: "#e4d4c5",
  text: "#281910",
};

const panelStyle = {
  padding: "22px",
  marginTop: "20px",
  background: "#ffffff",
  border: `1px solid ${colors.border}`,
  borderRadius: "14px",
  minWidth: 0,
};

const inputStyle = {
  width: "100%",
  minWidth: 0,
  padding: "11px 12px",
  boxSizing: "border-box",
  border: "1px solid #c6ad99",
  borderRadius: "9px",
  background: colors.cream,
  color: colors.text,
  font: "inherit",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: "16px",
};

const buttonStyle = {
  padding: "10px 16px",
  border: "none",
  borderRadius: "9px",
  background: colors.brown,
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

function Field({ label, children }) {
  return (
    <label
      style={{
        display: "grid",
        gap: "7px",
        minWidth: 0,
      }}
    >
      <strong
        style={{
          color: colors.brown,
          fontSize: "14px",
        }}
      >
        {label}
      </strong>
      {children}
    </label>
  );
}

function getId(value) {
  if (!value) return "";
  return typeof value === "string" ? value : value._id || "";
}

function formatMoney(value) {
  if (value == null) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function StatusBadge({ active }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 11px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 700,
        background: active ? "#e4f6ea" : "#ffe6e2",
        color: active ? "#17633a" : "#a1261c",
        whiteSpace: "nowrap",
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function BankSchemeManagement() {
  const [activeTab, setActiveTab] = useState("banks");

  const [banks, setBanks] = useState([]);
  const [schemes, setSchemes] = useState([]);

  const [bankForm, setBankForm] = useState({ ...emptyBank });
  const [schemeForm, setSchemeForm] = useState({
    ...emptyScheme,
  });

  const [showBankForm, setShowBankForm] = useState(false);
  const [showSchemeForm, setShowSchemeForm] = useState(false);

  const [editingBankId, setEditingBankId] = useState("");
  const [editingSchemeId, setEditingSchemeId] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingBank, setSavingBank] = useState(false);
  const [savingScheme, setSavingScheme] = useState(false);
  const [busyId, setBusyId] = useState("");

  const [bankSearch, setBankSearch] = useState("");
  const [schemeSearch, setSchemeSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("");
  const [schemeFilter, setSchemeFilter] = useState("");

  const [toast, setToast] = useState(null);

  const formRef = useRef(null);

  function showToast(message, type = "success") {
    setToast({
      message,
      type,
      id: Date.now(),
    });
  }

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function request(path, options = {}) {
    const token = sessionStorage.getItem("token");

    if (!token) {
      throw new Error(
        "Session expired. Please log in again."
      );
    }

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
      },
    });

    const data = await response.json();

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
      const [bankData, schemeData] = await Promise.all([
        request("/banks"),
        request("/loan-schemes"),
      ]);

      if (
        !Array.isArray(bankData.banks) ||
        !Array.isArray(schemeData.schemes)
      ) {
        throw new Error(
          "Invalid data received from server."
        );
      }

      setBanks(bankData.banks);
      setSchemes(schemeData.schemes);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetBankForm() {
    setBankForm({ ...emptyBank });
    setEditingBankId("");
    setShowBankForm(false);
  }

  function resetSchemeForm() {
    setSchemeForm({ ...emptyScheme });
    setEditingSchemeId("");
    setShowSchemeForm(false);
  }

  function switchTab(tab) {
    if (savingBank || savingScheme) return;

    setActiveTab(tab);
    resetBankForm();
    resetSchemeForm();
  }

  function openAddBank() {
    if (showBankForm) {
      resetBankForm();
      return;
    }

    setBankForm({ ...emptyBank });
    setEditingBankId("");
    setShowBankForm(true);
  }

  function openAddScheme() {
    if (showSchemeForm) {
      resetSchemeForm();
      return;
    }

    setSchemeForm({ ...emptyScheme });
    setEditingSchemeId("");
    setShowSchemeForm(true);
  }

  function scrollToForm() {
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function editBank(bank) {
    setActiveTab("banks");

    setBankForm({
      name: bank.name,
      code: bank.code,
      description: bank.description || "",
    });

    setEditingBankId(bank._id);
    setShowBankForm(true);

    scrollToForm();
  }

  function editScheme(scheme) {
    setActiveTab("schemes");

    setSchemeForm({
      bank: getId(scheme.bank),
      schemeName: scheme.schemeName,
      loanType: scheme.loanType,
      interestRate: String(scheme.interestRate),
      minLoanAmount: String(scheme.minLoanAmount),
      maxLoanAmount: String(scheme.maxLoanAmount),
      minTenureMonths: String(scheme.minTenureMonths),
      maxTenureMonths: String(scheme.maxTenureMonths),
      eligibilityCriteria:
        scheme.eligibilityCriteria || "",
      description: scheme.description || "",
    });

    setEditingSchemeId(scheme._id);
    setShowSchemeForm(true);

    scrollToForm();
  }

  async function saveBank(event) {
    event.preventDefault();

    const name = bankForm.name.trim();
    const code = bankForm.code.trim().toUpperCase();

    if (name.length < 2 || name.length > 150) {
      showToast(
        "Bank name must contain 2 to 150 characters.",
        "error"
      );
      return;
    }

    if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
      showToast(
        "Enter a valid bank code (2–20 characters).",
        "error"
      );
      return;
    }

    if (bankForm.description.trim().length > 1000) {
      showToast(
        "Bank description cannot exceed 1000 characters.",
        "error"
      );
      return;
    }

    setSavingBank(true);

    try {
      const editing = Boolean(editingBankId);

      const result = await request(
        editing
          ? `/banks/${editingBankId}`
          : "/banks",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            name,
            code,
            description: bankForm.description.trim(),
          }),
        }
      );

      setBanks((previous) =>
        editing
          ? previous.map((item) =>
              item._id === result.bank._id
                ? result.bank
                : item
            )
          : [...previous, result.bank].sort((a, b) =>
              a.name.localeCompare(b.name)
            )
      );

      resetBankForm();

      showToast(
        result.message || "Bank saved successfully."
      );
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSavingBank(false);
    }
  }

  async function saveScheme(event) {
    event.preventDefault();

    const numericFields = [
      "interestRate",
      "minLoanAmount",
      "maxLoanAmount",
      "minTenureMonths",
      "maxTenureMonths",
    ];

    const values = {};

    for (const field of numericFields) {
      if (String(schemeForm[field]).trim() === "") {
        showToast(
          `Please enter ${field}.`,
          "error"
        );
        return;
      }

      values[field] = Number(schemeForm[field]);

      if (!Number.isFinite(values[field])) {
        showToast(
          `${field} must be a valid number.`,
          "error"
        );
        return;
      }
    }

    if (!schemeForm.bank || !schemeForm.loanType) {
      showToast(
        "Select a bank and loan type.",
        "error"
      );
      return;
    }

    if (
      schemeForm.schemeName.trim().length < 2 ||
      schemeForm.schemeName.trim().length > 150
    ) {
      showToast(
        "Scheme name must contain 2 to 150 characters.",
        "error"
      );
      return;
    }

    const selectedBank = banks.find(
      (bank) => bank._id === schemeForm.bank
    );

    if (!selectedBank?.isActive) {
      showToast(
        "Select an active bank.",
        "error"
      );
      return;
    }

    if (
      values.interestRate < 0 ||
      values.interestRate > 100
    ) {
      showToast(
        "Interest rate must be between 0 and 100%.",
        "error"
      );
      return;
    }

    if (
      !Number.isSafeInteger(values.minLoanAmount) ||
      !Number.isSafeInteger(values.maxLoanAmount) ||
      values.minLoanAmount < 1 ||
      values.maxLoanAmount < values.minLoanAmount
    ) {
      showToast(
        "Enter a valid whole-number loan amount range.",
        "error"
      );
      return;
    }

    if (
      !Number.isSafeInteger(values.minTenureMonths) ||
      !Number.isSafeInteger(values.maxTenureMonths) ||
      values.minTenureMonths < 1 ||
      values.maxTenureMonths <
        values.minTenureMonths
    ) {
      showToast(
        "Enter a valid whole-number tenure range.",
        "error"
      );
      return;
    }

    if (
      schemeForm.eligibilityCriteria.trim().length >
        2000 ||
      schemeForm.description.trim().length > 2000
    ) {
      showToast(
        "Scheme text fields cannot exceed 2000 characters.",
        "error"
      );
      return;
    }

    setSavingScheme(true);

    try {
      const editing = Boolean(editingSchemeId);

      const result = await request(
        editing
          ? `/loan-schemes/${editingSchemeId}`
          : "/loan-schemes",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            bank: schemeForm.bank,
            schemeName: schemeForm.schemeName.trim(),
            loanType: schemeForm.loanType,
            ...values,
            eligibilityCriteria:
              schemeForm.eligibilityCriteria.trim(),
            description:
              schemeForm.description.trim(),
          }),
        }
      );

      setSchemes((previous) =>
        editing
          ? previous.map((item) =>
              item._id === result.scheme._id
                ? result.scheme
                : item
            )
          : [result.scheme, ...previous]
      );

      resetSchemeForm();

      showToast(
        result.message ||
          "Loan scheme saved successfully."
      );
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSavingScheme(false);
    }
  }

  async function toggleBank(bank) {
    setBusyId(`bank-${bank._id}`);

    try {
      const result = await request(
        `/banks/${bank._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive: !bank.isActive,
          }),
        }
      );

      setBanks((previous) =>
        previous.map((item) =>
          item._id === result.bank._id
            ? result.bank
            : item
        )
      );

      showToast(result.message);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusyId("");
    }
  }

  async function toggleScheme(scheme) {
    setBusyId(`scheme-${scheme._id}`);

    try {
      const result = await request(
        `/loan-schemes/${scheme._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive: !scheme.isActive,
          }),
        }
      );

      setSchemes((previous) =>
        previous.map((item) =>
          item._id === result.scheme._id
            ? result.scheme
            : item
        )
      );

      showToast(result.message);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusyId("");
    }
  }

  const filteredBanks = banks.filter((bank) => {
    const text = [
      bank.name,
      bank.code,
      bank.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      text.includes(
        bankSearch.trim().toLowerCase()
      ) &&
      (!bankFilter ||
        (bank.isActive ? "active" : "inactive") ===
          bankFilter)
    );
  });

  const filteredSchemes = schemes.filter(
    (scheme) => {
      const text = [
        scheme.schemeName,
        scheme.loanType,
        scheme.bank?.name,
        scheme.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        text.includes(
          schemeSearch.trim().toLowerCase()
        ) &&
        (!schemeFilter ||
          (scheme.isActive
            ? "active"
            : "inactive") === schemeFilter)
      );
    }
  );

  const tabStyle = (selected) => ({
    ...buttonStyle,
    flex: "1 1 180px",
    padding: "14px 18px",
    background: selected
      ? colors.brown
      : "#f2e9e1",
    color: selected
      ? "#ffffff"
      : colors.brown,
    border: selected
      ? "1px solid #382218"
      : `1px solid ${colors.border}`,
    boxShadow: selected
      ? "0 3px 10px rgba(56,34,24,0.12)"
      : "none",
  });

  return (
    <div
      style={{
        color: colors.text,
        minWidth: 0,
      }}
    >
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
            width:
              "min(380px, calc(100vw - 48px))",
            boxSizing: "border-box",
            padding: "16px 18px",
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
            borderRadius: "12px",
            boxShadow:
              "0 12px 35px rgba(28,17,10,0.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "20px" }}>
              {toast.type === "error"
                ? "✕"
                : "✓"}
            </span>

            <div style={{ flex: 1 }}>
              <strong>
                {toast.type === "error"
                  ? "Error"
                  : "Success"}
              </strong>
              <p style={{ margin: "6px 0 0" }}>
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Close notification"
              style={{
                border: "none",
                background: "transparent",
                color: "inherit",
                fontSize: "20px",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* MAIN TABS */}
      <div
        role="tablist"
        aria-label="Bank and loan scheme management"
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          padding: "8px",
          background: "#ffffff",
          border: `1px solid ${colors.border}`,
          borderRadius: "14px",
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "banks"}
          onClick={() => switchTab("banks")}
          disabled={savingBank || savingScheme}
          style={tabStyle(activeTab === "banks")}
        >
          Banks
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "schemes"}
          onClick={() => switchTab("schemes")}
          disabled={savingBank || savingScheme}
          style={tabStyle(activeTab === "schemes")}
        >
          Loan Schemes
        </button>
      </div>

      {/* BANKS TAB */}
      {activeTab === "banks" && (
        <>
          <section style={panelStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <h2 style={{ margin: "0 0 6px" }}>
                  Bank Directory
                </h2>
                <p style={{ margin: 0 }}>
                  Manage partner banks and their
                  availability.
                </p>
              </div>

              <button
                type="button"
                onClick={openAddBank}
                disabled={savingBank}
                style={buttonStyle}
              >
                {showBankForm
                  ? "✕ Cancel"
                  : "+ Add Bank"}
              </button>
            </div>

            {/* BANK FORM */}
            {showBankForm && (
              <div
                ref={formRef}
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  background: colors.cream,
                  scrollMarginTop: "24px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  {editingBankId
                    ? "Edit Bank"
                    : "Add New Bank"}
                </h3>

                <form onSubmit={saveBank}>
                  <div style={gridStyle}>
                    <Field label="Bank Name *">
                      <input
                        required
                        minLength={2}
                        maxLength={150}
                        style={inputStyle}
                        value={bankForm.name}
                        onChange={(event) =>
                          setBankForm((previous) => ({
                            ...previous,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Enter bank name"
                      />
                    </Field>

                    <Field label="Bank Code *">
                      <input
                        required
                        minLength={2}
                        maxLength={20}
                        style={inputStyle}
                        value={bankForm.code}
                        onChange={(event) =>
                          setBankForm((previous) => ({
                            ...previous,
                            code:
                              event.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="Example: HDFC"
                      />
                    </Field>
                  </div>

                  <div style={{ marginTop: "16px" }}>
                    <Field label="Description">
                      <textarea
                        rows={2}
                        maxLength={1000}
                        style={inputStyle}
                        value={bankForm.description}
                        onChange={(event) =>
                          setBankForm((previous) => ({
                            ...previous,
                            description:
                              event.target.value,
                          }))
                        }
                        placeholder="Optional bank description"
                      />
                    </Field>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "18px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="submit"
                      style={buttonStyle}
                      disabled={savingBank}
                    >
                      {savingBank
                        ? "Saving..."
                        : editingBankId
                        ? "Update Bank"
                        : "Save Bank"}
                    </button>

                    <button
                      type="button"
                      onClick={resetBankForm}
                      disabled={savingBank}
                      style={{
                        ...buttonStyle,
                        background: "#ead9c9",
                        color: colors.brown,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* BANK FILTERS */}
            <div
              style={{
                ...gridStyle,
                marginTop: "22px",
              }}
            >
              <Field label="Search Banks">
                <input
                  style={inputStyle}
                  value={bankSearch}
                  onChange={(event) =>
                    setBankSearch(event.target.value)
                  }
                  placeholder="Search name or code..."
                />
              </Field>

              <Field label="Filter by Status">
                <select
                  style={inputStyle}
                  value={bankFilter}
                  onChange={(event) =>
                    setBankFilter(event.target.value)
                  }
                >
                  <option value="">All Banks</option>
                  <option value="active">Active</option>
                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </Field>
            </div>

            <p
              style={{
                marginTop: "16px",
                fontSize: "13px",
                color: "#755d4b",
              }}
            >
              Showing {filteredBanks.length} of{" "}
              {banks.length} banks
            </p>

            {/* BANK DIRECTORY */}
            {loading ? (
              <p>Loading banks...</p>
            ) : filteredBanks.length === 0 ? (
              <p>No banks found.</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  marginTop: "18px",
                }}
              >
                {filteredBanks.map((bank) => (
                  <article
                    key={bank._id}
                    style={{
                      padding: "16px",
                      border: `1px solid ${colors.border}`,
                      borderRadius: "10px",
                      background: colors.cream,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 0,
                          overflowWrap: "anywhere",
                        }}
                      >
                        <strong>{bank.name}</strong>

                        <p style={{ margin: "5px 0" }}>
                          Code: {bank.code}
                        </p>

                        {bank.description && (
                          <p>{bank.description}</p>
                        )}
                      </div>

                      <StatusBadge
                        active={bank.isActive}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "12px",
                      }}
                    >
                      <button
                        type="button"
                        style={buttonStyle}
                        onClick={() =>
                          editBank(bank)
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={
                          busyId ===
                          `bank-${bank._id}`
                        }
                        onClick={() =>
                          toggleBank(bank)
                        }
                        style={{
                          ...buttonStyle,
                          background: bank.isActive
                            ? "#a1261c"
                            : "#287a4b",
                        }}
                      >
                        {busyId ===
                        `bank-${bank._id}`
                          ? "Updating..."
                          : bank.isActive
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* LOAN SCHEMES TAB */}
      {activeTab === "schemes" && (
        <>
          <section style={panelStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <h2 style={{ margin: "0 0 6px" }}>
                  Loan Scheme Directory
                </h2>

                <p style={{ margin: 0 }}>
                  Manage loan schemes under partner
                  banks.
                </p>
              </div>

              <button
                type="button"
                onClick={openAddScheme}
                disabled={savingScheme}
                style={buttonStyle}
              >
                {showSchemeForm
                  ? "✕ Cancel"
                  : "+ Add Scheme"}
              </button>
            </div>

            {/* SCHEME FORM */}
            {showSchemeForm && (
              <div
                ref={formRef}
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  background: colors.cream,
                  scrollMarginTop: "24px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  {editingSchemeId
                    ? "Edit Loan Scheme"
                    : "Add New Loan Scheme"}
                </h3>

                <form onSubmit={saveScheme}>
                  <div style={gridStyle}>
                    <Field label="Bank *">
                      <select
                        required
                        style={inputStyle}
                        value={schemeForm.bank}
                        onChange={(event) =>
                          setSchemeForm(
                            (previous) => ({
                              ...previous,
                              bank:
                                event.target.value,
                            })
                          )
                        }
                      >
                        <option value="">
                          Select bank
                        </option>

                        {banks
                          .filter(
                            (bank) =>
                              bank.isActive
                          )
                          .map((bank) => (
                            <option
                              key={bank._id}
                              value={bank._id}
                            >
                              {bank.name}
                            </option>
                          ))}
                      </select>
                    </Field>

                    <Field label="Scheme Name *">
                      <input
                        required
                        minLength={2}
                        maxLength={150}
                        style={inputStyle}
                        value={
                          schemeForm.schemeName
                        }
                        onChange={(event) =>
                          setSchemeForm(
                            (previous) => ({
                              ...previous,
                              schemeName:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="Enter scheme name"
                      />
                    </Field>

                    <Field label="Loan Type *">
                      <select
                        required
                        style={inputStyle}
                        value={schemeForm.loanType}
                        onChange={(event) =>
                          setSchemeForm(
                            (previous) => ({
                              ...previous,
                              loanType:
                                event.target.value,
                            })
                          )
                        }
                      >
                        <option value="">
                          Select loan type
                        </option>

                        {loanTypes.map((type) => (
                          <option
                            key={type}
                            value={type}
                          >
                            {type}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Interest Rate (%) *">
                      <input
                        required
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        style={inputStyle}
                        value={
                          schemeForm.interestRate
                        }
                        onChange={(event) =>
                          setSchemeForm(
                            (previous) => ({
                              ...previous,
                              interestRate:
                                event.target.value,
                            })
                          )
                        }
                      />
                    </Field>

                    {[
                      [
                        "minLoanAmount",
                        "Minimum Loan Amount (₹)",
                      ],
                      [
                        "maxLoanAmount",
                        "Maximum Loan Amount (₹)",
                      ],
                      [
                        "minTenureMonths",
                        "Minimum Tenure (Months)",
                      ],
                      [
                        "maxTenureMonths",
                        "Maximum Tenure (Months)",
                      ],
                    ].map(([field, label]) => (
                      <Field
                        key={field}
                        label={`${label} *`}
                      >
                        <input
                          required
                          type="number"
                          min="1"
                          step="1"
                          style={inputStyle}
                          value={
                            schemeForm[field]
                          }
                          onChange={(event) =>
                            setSchemeForm(
                              (previous) => ({
                                ...previous,
                                [field]:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </Field>
                    ))}
                  </div>

                  <div
                    style={{
                      ...gridStyle,
                      marginTop: "16px",
                    }}
                  >
                    <Field label="Eligibility Criteria">
                      <textarea
                        rows={3}
                        maxLength={2000}
                        style={inputStyle}
                        value={
                          schemeForm.eligibilityCriteria
                        }
                        onChange={(event) =>
                          setSchemeForm(
                            (previous) => ({
                              ...previous,
                              eligibilityCriteria:
                                event.target.value,
                            })
                          )
                        }
                      />
                    </Field>

                    <Field label="Description">
                      <textarea
                        rows={3}
                        maxLength={2000}
                        style={inputStyle}
                        value={
                          schemeForm.description
                        }
                        onChange={(event) =>
                          setSchemeForm(
                            (previous) => ({
                              ...previous,
                              description:
                                event.target.value,
                            })
                          )
                        }
                      />
                    </Field>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "18px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="submit"
                      style={buttonStyle}
                      disabled={savingScheme}
                    >
                      {savingScheme
                        ? "Saving..."
                        : editingSchemeId
                        ? "Update Scheme"
                        : "Save Scheme"}
                    </button>

                    <button
                      type="button"
                      onClick={resetSchemeForm}
                      disabled={savingScheme}
                      style={{
                        ...buttonStyle,
                        background: "#ead9c9",
                        color: colors.brown,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SCHEME FILTERS */}
            <div
              style={{
                ...gridStyle,
                marginTop: "22px",
              }}
            >
              <Field label="Search Schemes">
                <input
                  style={inputStyle}
                  value={schemeSearch}
                  onChange={(event) =>
                    setSchemeSearch(
                      event.target.value
                    )
                  }
                  placeholder="Scheme, bank, loan type..."
                />
              </Field>

              <Field label="Filter by Status">
                <select
                  style={inputStyle}
                  value={schemeFilter}
                  onChange={(event) =>
                    setSchemeFilter(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    All Schemes
                  </option>
                  <option value="active">
                    Active
                  </option>
                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </Field>
            </div>

            <p
              style={{
                marginTop: "16px",
                fontSize: "13px",
                color: "#755d4b",
              }}
            >
              Showing {filteredSchemes.length} of{" "}
              {schemes.length} schemes
            </p>

            {/* SCHEME DIRECTORY */}
            {loading ? (
              <p>Loading loan schemes...</p>
            ) : filteredSchemes.length === 0 ? (
              <p>No loan schemes found.</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  marginTop: "18px",
                }}
              >
                {filteredSchemes.map((scheme) => (
                  <article
                    key={scheme._id}
                    style={{
                      padding: "16px",
                      border: `1px solid ${colors.border}`,
                      borderRadius: "10px",
                      background: colors.cream,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 0,
                          overflowWrap: "anywhere",
                        }}
                      >
                        <h3
                          style={{
                            margin: "0 0 8px",
                          }}
                        >
                          {scheme.schemeName}
                        </h3>

                        <p>
                          Bank:{" "}
                          {scheme.bank?.name ||
                            "Unavailable"}
                        </p>

                        <p>
                          Loan Type:{" "}
                          {scheme.loanType}
                        </p>

                        <p>
                          Interest Rate:{" "}
                          {scheme.interestRate}%
                        </p>

                        <p>
                          Loan Amount:{" "}
                          {formatMoney(
                            scheme.minLoanAmount
                          )}
                          {" – "}
                          {formatMoney(
                            scheme.maxLoanAmount
                          )}
                        </p>

                        <p>
                          Tenure:{" "}
                          {scheme.minTenureMonths}–
                          {scheme.maxTenureMonths}{" "}
                          months
                        </p>

                        {scheme.eligibilityCriteria && (
                          <p>
                            Eligibility:{" "}
                            {
                              scheme.eligibilityCriteria
                            }
                          </p>
                        )}

                        {scheme.description && (
                          <p>
                            Description:{" "}
                            {scheme.description}
                          </p>
                        )}
                      </div>

                      <StatusBadge
                        active={scheme.isActive}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "12px",
                      }}
                    >
                      <button
                        type="button"
                        style={buttonStyle}
                        onClick={() =>
                          editScheme(scheme)
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={
                          busyId ===
                          `scheme-${scheme._id}`
                        }
                        onClick={() =>
                          toggleScheme(scheme)
                        }
                        style={{
                          ...buttonStyle,
                          background: scheme.isActive
                            ? "#a1261c"
                            : "#287a4b",
                        }}
                      >
                        {busyId ===
                        `scheme-${scheme._id}`
                          ? "Updating..."
                          : scheme.isActive
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
