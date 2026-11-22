
import { useCallback, useEffect, useState } from "react";

const CALL_REPORT_API =
  "http://localhost:5000/api/reports/calls";

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN");

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const styles = {
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "24px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },

  card: {
    background: "#ffffff",
    border: "1px solid #eaded3",
    borderRadius: "14px",
    padding: "22px",
    minWidth: 0,
  },

  cardLabel: {
    color: "#88766b",
    fontSize: "13px",
    margin: "0 0 12px",
  },

  cardValue: {
    color: "#302019",
    fontSize: "28px",
    fontWeight: 700,
    margin: 0,
  },

  section: {
    marginBottom: "24px",
  },

  muted: {
    color: "#88766b",
    fontSize: "13px",
    lineHeight: 1.6,
  },

  progressTrack: {
    height: "10px",
    background: "#eee3d9",
    borderRadius: "20px",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    background: "#8b5e3c",
    borderRadius: "20px",
    transition: "width 0.3s ease",
  },

  tableWrapper: {
    overflowX: "auto",
    border: "1px solid #eaded3",
    borderRadius: "12px",
    marginTop: "20px",
  },

  table: {
    width: "100%",
    minWidth: "850px",
    borderCollapse: "collapse",
    fontSize: "13px",
  },

  tableHeader: {
    background: "#38251b",
    color: "#ffffff",
    padding: "14px",
    textAlign: "left",
    whiteSpace: "nowrap",
  },

  tableCell: {
    padding: "14px",
    borderBottom: "1px solid #eaded3",
    color: "#38251b",
    verticalAlign: "top",
  },

  toast: {
    position: "fixed",
    top: "24px",
    right: "24px",
    zIndex: 9999,
    maxWidth: "min(420px, calc(100vw - 40px))",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 18px",
    background: "#302019",
    color: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 8px 25px rgba(0,0,0,0.2)",
  },
};

function StatCard({ title, value, subtitle }) {
  return (
    <div style={styles.card}>
      <p style={styles.cardLabel}>{title}</p>

      <h3 style={styles.cardValue}>
        {formatNumber(value)}
      </h3>

      {subtitle && (
        <p style={{ ...styles.muted, marginBottom: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function ProgressBar({ percentage, label }) {
  const progress = Math.max(
    0,
    Math.min(100, Number(percentage) || 0)
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "8px",
          fontSize: "13px",
        }}
      >
        <span>{label}</span>

        <strong>{formatNumber(percentage)}%</strong>
      </div>

      <div
        style={styles.progressTrack}
        role="progressbar"
        aria-label={label}
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            ...styles.progressFill,
            width: `${progress}%`,
          }}
        />
      </div>
    </div>
  );
}

function CallTracking() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({
      id: Date.now(),
      message,
      type,
    });
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => clearTimeout(timeout);
  }, [toast]);

  const fetchCallReport = useCallback(
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
            "Your session has expired. Please log in again."
          );
        }

        const response = await fetch(CALL_REPORT_API, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        });

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          !data.summary ||
          !Array.isArray(data.employeePerformance) ||
          !Array.isArray(data.recentCalls)
        ) {
          throw new Error(
            data.message || "Unable to load call tracking."
          );
        }

        if (signal?.aborted) return;

        setReport(data);

        if (isRefresh) {
          showToast("Call tracking refreshed successfully!");
        }
      } catch (error) {
        if (
          error.name === "AbortError" ||
          signal?.aborted
        ) {
          return;
        }

        showToast(
          error.message || "Unable to load call tracking.",
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

    fetchCallReport(controller.signal);

    return () => controller.abort();
  }, [fetchCallReport]);

  const refresh = () => {
    if (!loading && !refreshing) {
      fetchCallReport(undefined, true);
    }
  };

  const summary = report?.summary;

  const employees = report?.employeePerformance || [];

  const recentCalls = report?.recentCalls || [];

  const callOutcomes = employees.reduce(
    (totals, employee) => ({
      contacted:
        totals.contacted + (employee.contacted || 0),
      interested:
        totals.interested + (employee.interested || 0),
      notInterested:
        totals.notInterested +
        (employee.notInterested || 0),
      followUps:
        totals.followUps + (employee.followUps || 0),
    }),
    {
      contacted: 0,
      interested: 0,
      notInterested: 0,
      followUps: 0,
    }
  );

  return (
    <div>
      {/* HEADER */}

      <div style={styles.toolbar}>
        

        <button
          type="button"
          className="lead-action-button"
          onClick={refresh}
          disabled={loading || refreshing}
        >
          {refreshing
            ? "Refreshing..."
            : "↻ Refresh Calls"}
        </button>
      </div>

      {/* LOADING / ERROR */}

      {loading && !report ? (
        <section className="dashboard-panel">
          <p role="status">
            Loading daily call tracking...
          </p>
        </section>
      ) : !report ? (
        <section className="dashboard-panel">
          <h2>Call Tracking Unavailable</h2>

          <p className="panel-subtitle">
            Unable to load call tracking data.
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
          {/* DAILY CALL SUMMARY */}

          <section aria-label="Daily call summary">
            <h2 style={{ color: "#302019" }}>
              Today's Call Summary
            </h2>

            <div style={styles.statsGrid}>
              <StatCard
                title="Completed Calls"
                value={summary.callsToday}
              />

              <StatCard
                title="Team Daily Target"
                value={summary.teamDailyTarget}
              />

              <StatCard
                title="Remaining Calls"
                value={summary.remainingCalls}
              />

              <StatCard
                title="Active Employees"
                value={summary.activeEmployees}
              />
            </div>
          </section>

          {/* TEAM PROGRESS */}

          <section
            className="dashboard-panel"
            style={styles.section}
          >
            <h2>Team Call Target Progress</h2>

            <p className="panel-subtitle">
              Daily target achievement across active staff
            </p>

            <div
              style={{
                marginTop: "24px",
                marginBottom: "18px",
              }}
            >
              <strong
                style={{
                  fontSize: "28px",
                  color: "#302019",
                }}
              >
                {formatNumber(summary.callsToday)}
              </strong>

              <span style={styles.muted}>
                {" "}
                / {formatNumber(summary.teamDailyTarget)} calls
              </span>
            </div>

            <ProgressBar
              percentage={summary.achievementPercentage}
              label="Team target achievement"
            />
          </section>

          {/* CALL OUTCOMES */}

          <section
            className="dashboard-panel"
            style={styles.section}
          >
            <h2>Today's Call Outcomes</h2>

            <p className="panel-subtitle">
              Breakdown of calls recorded by employees today
            </p>

            <div
              style={{
                ...styles.statsGrid,
                marginTop: "20px",
                marginBottom: 0,
              }}
            >
              <StatCard
                title="Contacted"
                value={callOutcomes.contacted}
              />

              <StatCard
                title="Interested"
                value={callOutcomes.interested}
              />

              <StatCard
                title="Not Interested"
                value={callOutcomes.notInterested}
              />

              <StatCard
                title="Follow-ups"
                value={callOutcomes.followUps}
              />
            </div>
          </section>

          {/* EMPLOYEE PERFORMANCE */}

          <section
            className="dashboard-panel"
            style={styles.section}
          >
            <h2>Employee Call Performance</h2>

            <p className="panel-subtitle">
              Individual daily calls, outcomes, and targets
            </p>

            {employees.length === 0 ? (
              <p style={styles.muted}>
                No employee performance records available.
              </p>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {[
                        "Employee",
                        "Status",
                        "Calls Today",
                        "Daily Target",
                        "Progress",
                        "Contacted",
                        "Interested",
                        "Not Interested",
                        "Follow-ups",
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          style={styles.tableHeader}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {employees.map((employee) => (
                      <tr key={employee.employeeId}>
                        <td style={styles.tableCell}>
                          <strong>{employee.name}</strong>

                          <div style={styles.muted}>
                            {employee.email}
                          </div>
                        </td>

                        <td style={styles.tableCell}>
                          {employee.isActive
                            ? "Active"
                            : "Inactive"}
                        </td>

                        <td style={styles.tableCell}>
                          {formatNumber(
                            employee.callsToday
                          )}
                        </td>

                        <td style={styles.tableCell}>
                          {formatNumber(
                            employee.dailyTarget
                          )}
                        </td>

                        <td
                          style={{
                            ...styles.tableCell,
                            minWidth: "150px",
                          }}
                        >
                          <ProgressBar
                            percentage={
                              employee.achievementPercentage
                            }
                            label={`${employee.name} progress`}
                          />
                        </td>

                        <td style={styles.tableCell}>
                          {formatNumber(
                            employee.contacted
                          )}
                        </td>

                        <td style={styles.tableCell}>
                          {formatNumber(
                            employee.interested
                          )}
                        </td>

                        <td style={styles.tableCell}>
                          {formatNumber(
                            employee.notInterested
                          )}
                        </td>

                        <td style={styles.tableCell}>
                          {formatNumber(
                            employee.followUps
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* RECENT CALL HISTORY */}

          <section
            className="dashboard-panel"
            style={styles.section}
          >
            <h2>Recent Call History</h2>

            <p className="panel-subtitle">
              Latest recorded calls across your team
            </p>

            {recentCalls.length === 0 ? (
              <p style={styles.muted}>
                No call records available yet.
              </p>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {[
                        "Customer",
                        "Employee",
                        "Call Outcome",
                        "Called At",
                        "Next Follow-up",
                        "Remarks",
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          style={styles.tableHeader}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {recentCalls.map((call, index) => (
                      <tr
                        key={`${call.leadId}-${call.calledAt}-${index}`}
                      >
                        <td style={styles.tableCell}>
                          {call.customerName}
                        </td>

                        <td style={styles.tableCell}>
                          {call.employeeName}
                        </td>

                        <td style={styles.tableCell}>
                          {call.status}
                        </td>

                        <td style={styles.tableCell}>
                          {formatDate(call.calledAt)}
                        </td>

                        <td style={styles.tableCell}>
                          {formatDate(call.nextFollowUp)}
                        </td>

                        <td
                          style={{
                            ...styles.tableCell,
                            maxWidth: "300px",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {call.remarks || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* PROFESSIONAL TOAST NOTIFICATIONS */}

      {toast && (
        <div
          role={
            toast.type === "error"
              ? "alert"
              : "status"
          }
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
              fontSize: "22px",
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
              fontSize: "13px",
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
              color: "#ffffff",
              fontSize: "22px",
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

export default CallTracking;
