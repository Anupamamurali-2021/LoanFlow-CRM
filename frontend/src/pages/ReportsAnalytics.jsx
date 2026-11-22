
import { useCallback, useEffect, useState } from "react";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/reports`;

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const number = (value) =>
  Number(value || 0).toLocaleString("en-IN");

const dateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });
};

const styles = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  card: {
    background: "#fff",
    border: "1px solid #eaded3",
    borderRadius: 14,
    padding: 22,
    minWidth: 0,
  },
  label: {
    color: "#88766b",
    fontSize: 13,
    margin: "0 0 12px",
  },
  value: {
    color: "#302019",
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    overflowWrap: "anywhere",
  },
  section: {
    marginBottom: 24,
  },
  bar: {
    height: 10,
    background: "#eee3d9",
    borderRadius: 20,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    background: "#8b5e3c",
    borderRadius: 20,
    transition: "width 0.3s ease",
  },
  muted: {
    color: "#88766b",
    fontSize: 13,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #eaded3",
    borderRadius: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 680,
    fontSize: 13,
  },
  th: {
    background: "#38251b",
    color: "#fff",
    padding: 14,
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  td: {
    padding: 14,
    borderBottom: "1px solid #eaded3",
    color: "#38251b",
    verticalAlign: "top",
  },
  toast: {
    position: "fixed",
    top: 24,
    right: 24,
    zIndex: 9999,
    maxWidth: "min(420px, calc(100vw - 40px))",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 18px",
    background: "#302019",
    color: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 25px rgba(0,0,0,0.2)",
  },
};

function MetricCard({ label, value, detail }) {
  return (
    <div style={styles.card}>
      <p style={styles.label}>{label}</p>
      <p style={styles.value}>{value}</p>
      {detail && (
        <p style={{ ...styles.muted, marginBottom: 0 }}>
          {detail}
        </p>
      )}
    </div>
  );
}

function ProgressBar({ value, label }) {
  const percentage = Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

  return (
    <div>
      {label && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          <span>{label}</span>
          <strong>{number(value)}%</strong>
        </div>
      )}

      <div
        style={styles.bar}
        role="progressbar"
        aria-label={label || "Progress"}
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            ...styles.fill,
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

function StatusDistribution({ items = [], total = 0 }) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {items.map((item) => {
        const percentage =
          total > 0
            ? (item.count / total) * 100
            : 0;

        return (
          <div key={item.status}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 8,
                fontSize: 13,
              }}
            >
              <span>{item.status}</span>
              <strong>
                {number(item.count)} (
                {percentage.toFixed(1)}%)
              </strong>
            </div>

            <div style={styles.bar}>
              <div
                style={{
                  ...styles.fill,
                  width: `${percentage}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportsAnalytics() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({
      message,
      type,
      id: Date.now(),
    });
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [toast]);

  const loadReports = useCallback(
    async (signal, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const token = sessionStorage.getItem("token");

        if (!token) {
          throw new Error(
            "Session expired. Please log in again."
          );
        }

        const endpoints = [
          "overview",
          "calls",
          "leads",
          "loans",
        ];

        const results = await Promise.all(
          endpoints.map(async (endpoint) => {
            const response = await fetch(
              `${API}/${endpoint}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                signal,
              }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
              throw new Error(
                data.message ||
                  `Unable to load ${endpoint} report.`
              );
            }

            return data;
          })
        );

        if (signal?.aborted) return;

        setReports({
          overview: results[0],
          calls: results[1],
          leads: results[2],
          loans: results[3],
        });

        if (isRefresh) {
          showToast("Reports refreshed successfully!");
        }
      } catch (error) {
        if (error.name === "AbortError" || signal?.aborted) {
          return;
        }

        showToast(
          error.message || "Unable to load reports.",
          "error"
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    const controller = new AbortController();

    loadReports(controller.signal);

    return () => controller.abort();
  }, [loadReports]);

  const refresh = () => {
    if (!loading && !refreshing) {
      loadReports(undefined, true);
    }
  };

  const overview = reports?.overview?.overview;
  const calls = reports?.calls;
  const leads = reports?.leads;
  const loans = reports?.loans;

  return (
    <div>
      <div style={styles.toolbar}>
        <div>
          <h2
            style={{
              margin: "0 0 8px",
              color: "#302019",
              fontSize: 24,
            }}
          >
            Reports & Analytics
          </h2>

          <p style={{ ...styles.muted, margin: 0 }}>
            Live business performance and employee insights
            {reports?.overview?.date
              ? ` · ${reports.overview.date} (IST)`
              : ""}
          </p>
        </div>

        <button
          type="button"
          className="lead-action-button"
          onClick={refresh}
          disabled={loading || refreshing}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh Reports"}
        </button>
      </div>

      {loading && !reports ? (
        <section className="dashboard-panel">
          <p role="status">Loading reports and analytics...</p>
        </section>
      ) : !reports ? (
        <section className="dashboard-panel">
          <h2>Reports unavailable</h2>
          <p className="panel-subtitle">
            Unable to load reporting data. Please try again.
          </p>

          <button
            type="button"
            className="lead-action-button"
            onClick={refresh}
          >
            Retry
          </button>
        </section>
      ) : (
        <>
          {/* OVERVIEW */}

          <section aria-label="Business overview">
            <h2 style={{ color: "#302019" }}>
              Business Overview
            </h2>

            <div style={styles.grid}>
              <MetricCard
                label="Total Leads"
                value={number(overview?.totalLeads)}
              />

              <MetricCard
                label="Active Employees"
                value={number(overview?.activeEmployees)}
                detail={`${number(
                  overview?.totalEmployees
                )} total staff`}
              />

              <MetricCard
                label="Calls Today"
                value={number(overview?.callsToday)}
              />

              <MetricCard
                label="Loan Applications"
                value={number(
                  overview?.totalLoanApplications
                )}
              />
            </div>
          </section>

          {/* CALL PERFORMANCE */}

          <section
            className="dashboard-panel"
            style={styles.section}
          >
            <h2>Daily Call Performance</h2>

            <p className="panel-subtitle">
              Today's team performance against the daily call
              target
            </p>

            <div style={styles.grid}>
              <MetricCard
                label="Completed Calls"
                value={number(calls?.summary?.callsToday)}
              />

              <MetricCard
                label="Team Daily Target"
                value={number(
                  calls?.summary?.teamDailyTarget
                )}
              />

              <MetricCard
                label="Remaining Calls"
                value={number(
                  calls?.summary?.remainingCalls
                )}
              />

              <MetricCard
                label="Target Achievement"
                value={`${number(
                  calls?.summary?.achievementPercentage
                )}%`}
              />
            </div>

            <ProgressBar
              value={
                calls?.summary?.achievementPercentage || 0
              }
              label="Team target progress"
            />
          </section>

          {/* EMPLOYEE PERFORMANCE */}

          <section
            className="dashboard-panel"
            style={styles.section}
          >
            <h2>Employee-wise Call Performance</h2>

            <p className="panel-subtitle">
              Individual calls, targets, and call outcomes
            </p>

            {!calls?.employeePerformance?.length ? (
              <p style={styles.muted}>
                No employee performance data available.
              </p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {[
                        "Employee",
                        "Status",
                        "Calls",
                        "Target",
                        "Progress",
                        "Interested",
                        "Follow-ups",
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          style={styles.th}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {calls.employeePerformance.map(
                      (employee) => (
                        <tr key={employee.employeeId}>
                          <td style={styles.td}>
                            <strong>{employee.name}</strong>

                            <div style={styles.muted}>
                              {employee.email}
                            </div>
                          </td>

                          <td style={styles.td}>
                            {employee.isActive
                              ? "Active"
                              : "Inactive"}
                          </td>

                          <td style={styles.td}>
                            {number(employee.callsToday)}
                          </td>

                          <td style={styles.td}>
                            {number(employee.dailyTarget)}
                          </td>

                          <td
                            style={{
                              ...styles.td,
                              minWidth: 130,
                            }}
                          >
                            <ProgressBar
                              value={
                                employee.achievementPercentage
                              }
                              label={`${employee.name} progress`}
                            />

                            <span style={styles.muted}>
                              {number(
                                employee.achievementPercentage
                              )}
                              %
                            </span>
                          </td>

                          <td style={styles.td}>
                            {number(employee.interested)}
                          </td>

                          <td style={styles.td}>
                            {number(employee.followUps)}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* LEAD ANALYTICS */}

          <section
            className="dashboard-panel"
            style={styles.section}
          >
            <h2>Lead Analytics</h2>

            <p className="panel-subtitle">
              Current customer lead status and conversion
              performance
            </p>

            <div style={styles.grid}>
              <MetricCard
                label="Total Leads"
                value={number(leads?.summary?.totalLeads)}
              />

              <MetricCard
                label="Interested Leads"
                value={number(
                  leads?.summary?.interestedLeads
                )}
              />

              <MetricCard
                label="Converted Leads"
                value={number(
                  leads?.summary?.convertedLeads
                )}
              />

              <MetricCard
                label="Conversion Rate"
                value={`${number(
                  leads?.summary?.conversionRate
                )}%`}
              />
            </div>

            <h3 style={{ color: "#302019" }}>
              Lead Status Distribution
            </h3>

            <StatusDistribution
              items={leads?.statusDistribution}
              total={leads?.summary?.totalLeads}
            />
          </section>

          {/* LOAN ANALYTICS */}

          <section
            className="dashboard-panel"
            style={styles.section}
          >
            <h2>Loan Application Analytics</h2>

            <p className="panel-subtitle">
              Current loan application pipeline and amounts
            </p>

            <div style={styles.grid}>
              <MetricCard
                label="Total Applications"
                value={number(
                  loans?.summary?.totalApplications
                )}
              />

              <MetricCard
                label="Currently Approved"
                value={number(
                  loans?.summary?.approvedApplications
                )}
              />

              <MetricCard
                label="Currently Rejected"
                value={number(
                  loans?.summary?.rejectedApplications
                )}
              />

              <MetricCard
                label="Closed Applications"
                value={number(
                  loans?.summary?.closedApplications
                )}
              />

              <MetricCard
                label="Total Requested"
                value={money(
                  loans?.summary?.totalRequestedAmount
                )}
              />

              <MetricCard
                label="Total Approved Amount"
                value={money(
                  loans?.summary?.totalApprovedAmount
                )}
              />
            </div>

            <h3 style={{ color: "#302019" }}>
              Application Status Distribution
            </h3>

            <StatusDistribution
              items={loans?.statusDistribution}
              total={loans?.summary?.totalApplications}
            />

            <p
              style={{
                ...styles.muted,
                marginTop: 20,
                lineHeight: 1.6,
              }}
            >
              Status counts represent the current application
              state. Closed applications are tracked
              separately from currently approved applications.
              Approved amounts are recorded approval values,
              not confirmed disbursements.
            </p>
          </section>

          {/* RECENT CALLS */}

          <section
            className="dashboard-panel"
            style={styles.section}
          >
            <h2>Recent Team Calls</h2>

            <p className="panel-subtitle">
              Latest recorded employee call activity
            </p>

            {!calls?.recentCalls?.length ? (
              <p style={styles.muted}>
                No call activity has been recorded yet.
              </p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {[
                        "Customer",
                        "Employee",
                        "Outcome",
                        "Call Date",
                        "Remarks",
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          style={styles.th}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {calls.recentCalls.map(
                      (call, index) => (
                        <tr
                          key={`${call.leadId}-${call.calledAt}-${index}`}
                        >
                          <td style={styles.td}>
                            {call.customerName}
                          </td>

                          <td style={styles.td}>
                            {call.employeeName}
                          </td>

                          <td style={styles.td}>
                            {call.status}
                          </td>

                          <td style={styles.td}>
                            {dateTime(call.calledAt)}
                          </td>

                          <td
                            style={{
                              ...styles.td,
                              maxWidth: 300,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {call.remarks || "—"}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* PROFESSIONAL TOAST */}

      {toast && (
        <div
          role={toast.type === "error" ? "alert" : "status"}
          style={{
            ...styles.toast,
            borderLeft: `4px solid ${
              toast.type === "error"
                ? "#e57373"
                : "#66c28a"
            }`,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: 22,
              color:
                toast.type === "error"
                  ? "#e57373"
                  : "#66c28a",
            }}
          >
            {toast.type === "error" ? "!" : "✓"}
          </span>

          <strong
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              flex: 1,
            }}
          >
            {toast.message}
          </strong>

          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Close notification"
            style={{
              border: "none",
              background: "transparent",
              color: "#fff",
              fontSize: 22,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default ReportsAnalytics;
