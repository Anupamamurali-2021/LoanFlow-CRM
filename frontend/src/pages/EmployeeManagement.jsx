
import { useCallback, useEffect, useState } from "react";

const API_URL = "http://localhost:5000/api/employees";

const initialForm = {
  name: "",
  email: "",
  password: "",
};

function EmployeeManagement() {
  const [form, setForm] = useState({ ...initialForm });
  const [employees, setEmployees] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const [employeesError, setEmployeesError] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const apiRequest = useCallback(async (path = "", options = {}) => {
    const token = sessionStorage.getItem("token");

    if (!token) {
      throw new Error("Session expired. Please log in again.");
    }

    const response = await fetch(`${API_URL}${path}`, {
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

  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    setEmployeesError("");

    try {
      const data = await apiRequest();

      if (!Array.isArray(data.employees)) {
        throw new Error("Invalid employee data received.");
      }

      setEmployees(data.employees);
    } catch (err) {
      setEmployeesError(
        err.message || "Unable to load employees."
      );
    } finally {
      setEmployeesLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm({ ...initialForm });
    setShowForm(false);
  };

  const toggleForm = () => {
    if (loading) return;

    if (showForm) {
      resetForm();
    } else {
      setForm({ ...initialForm });
      setShowForm(true);
    }
  };

  const validateForm = () => {
    const name = form.name.trim();
    const email = form.email.trim();

    if (name.length < 2 || name.length > 100) {
      return "Employee name must be 2 to 100 characters.";
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return "Enter a valid email address.";
    }

    if (
      form.password.length < 8 ||
      form.password.length > 72
    ) {
      return "Password must be 8 to 72 characters.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    setLoading(true);

    try {
      await apiRequest("", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });

      resetForm();
      showToast("Employee created successfully!");

      await fetchEmployees();
    } catch (err) {
      showToast(
        err.message || "Unable to create employee.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const updateEmployeeStatus = async (employee) => {
    const nextStatus = !employee.isActive;

    const confirmed = window.confirm(
      nextStatus
        ? `Activate ${employee.name}'s account?`
        : `Deactivate ${employee.name}'s account? They will not be able to log in.`
    );

    if (!confirmed) return;

    setUpdatingId(employee._id);

    try {
      await apiRequest(`/${employee._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: nextStatus,
        }),
      });

      showToast(
        nextStatus
          ? "Employee activated successfully!"
          : "Employee deactivated successfully!"
      );

      await fetchEmployees();
    } catch (err) {
      showToast(
        err.message || "Unable to update employee status.",
        "error"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const activeCount = employees.filter(
    (employee) => employee.isActive
  ).length;

  return (
    <section className="dashboard-panel">
      {/* PAGE HEADER */}
      <div className="employee-page-header">
        <div>
          <h2>Employee Management</h2>
          <p className="panel-subtitle">
            Create staff accounts and manage employee access.
          </p>
        </div>
      </div>

      {/* EMPLOYEE SUMMARY */}
      <div className="employee-summary">
        <div className="employee-summary-card">
          <span>Total Employees</span>
          <strong>
            {employeesLoading ? "—" : employees.length}
          </strong>
        </div>

        <div className="employee-summary-card">
          <span>Active Employees</span>
          <strong>
            {employeesLoading ? "—" : activeCount}
          </strong>
        </div>

        <div className="employee-summary-card">
          <span>Inactive Employees</span>
          <strong>
            {employeesLoading
              ? "—"
              : employees.length - activeCount}
          </strong>
        </div>
      </div>

      {/* EMPLOYEE DIRECTORY */}
      <div className="employee-list-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 6px" }}>
              Employee Directory
            </h3>
            <p
              className="panel-subtitle"
              style={{ margin: 0 }}
            >
              View and manage staff accounts.
            </p>
          </div>

          <button
            type="button"
            onClick={toggleForm}
            disabled={loading}
            style={{
              padding: "11px 18px",
              background: "#382218",
              color: "#ffffff",
              border: "none",
              borderRadius: "9px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {showForm ? "✕ Cancel" : "+ Add Employee"}
          </button>
        </div>

        {/* EXPANDABLE ADD EMPLOYEE FORM */}
        {showForm && (
          <div
            className="employee-form-section"
            style={{
              marginBottom: "22px",
              padding: "20px",
              border: "1px solid #e4d4c5",
              borderRadius: "12px",
              background: "#fffaf5",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              Add New Employee
            </h3>

            <p className="panel-subtitle">
              New employees will receive staff-level access.
            </p>

            <form
              className="lead-form employee-form employee-form-compact"
              onSubmit={handleSubmit}
            >
              <div className="employee-form-field">
                <label htmlFor="employee-name">
                  Employee Name
                </label>
                <input
                  id="employee-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  required
                  placeholder="Enter employee name"
                />
              </div>

              <div className="employee-form-field">
                <label htmlFor="employee-email">
                  Email Address
                </label>
                <input
                  id="employee-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  maxLength={254}
                  autoComplete="off"
                  required
                  placeholder="employee@example.com"
                />
              </div>

              <div className="employee-form-field">
                <label htmlFor="employee-password">
                  Temporary Password
                </label>
                <input
                  id="employee-password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  required
                  placeholder="Minimum 8 characters"
                />
              </div>

              <p className="employee-password-note">
                Use a unique password for each employee.
                Share login details securely.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  gridColumn: "1 / -1",
                  width: "100%",
                }}
              >
                <button
                  type="submit"
                  className="login-button"
                  disabled={loading}
                  style={{
                    width: "100%",
                    gridColumn: "1 / -1",
                  }}
                >
                  {loading
                    ? "Creating Employee..."
                    : "Create Employee"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={loading}
                  style={{
                    padding: "10px 18px",
                    background: "#ead9c9",
                    color: "#382218",
                    border: "none",
                    borderRadius: "9px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STAFF ACCOUNTS TABLE */}
        {employeesError && (
          <p role="alert" style={{ color: "#c0392b" }}>
            {employeesError}
          </p>
        )}

        {employeesLoading ? (
          <p>Loading employees...</p>
        ) : employeesError ? null : employees.length === 0 ? (
          <p>No employees created yet.</p>
        ) : (
          <div className="leads-table-wrapper">
            <table className="leads-table employee-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {employees.map((employee) => (
                  <tr key={employee._id}>
                    <td>{employee.name}</td>
                    <td>{employee.email}</td>
                    <td>Staff</td>
                    <td>
                      <span
                        className={
                          employee.isActive
                            ? "employee-status active"
                            : "employee-status inactive"
                        }
                      >
                        {employee.isActive
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={
                          employee.isActive
                            ? "lead-secondary-button"
                            : "lead-action-button"
                        }
                        disabled={
                          updatingId === employee._id
                        }
                        onClick={() =>
                          updateEmployeeStatus(employee)
                        }
                      >
                        {updatingId === employee._id
                          ? "Updating..."
                          : employee.isActive
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PROFESSIONAL TOAST */}
      {toast && (
        <div
          role={toast.type === "error" ? "alert" : "status"}
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
            padding: "16px 18px",
            background:
              toast.type === "error"
                ? "#fff0ed"
                : "#eaf7ef",
            color:
              toast.type === "error"
                ? "#8f241c"
                : "#17633a",
            border: `1px solid ${toast.type === "error"
              ? "#e7a49b"
              : "#a1d8b5"
              }`,
            borderLeft: `5px solid ${toast.type === "error"
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
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "20px" }}>
              {toast.type === "error" ? "✕" : "✓"}
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
    </section>
  );
}

export default EmployeeManagement;
