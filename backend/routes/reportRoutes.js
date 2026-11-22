
const express = require("express");
const mongoose = require("mongoose");

const Lead = require("../models/Lead");
const User = require("../models/User");
const LoanApplication = require("../models/LoanApplication");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

const DAILY_CALL_TARGET = 100;

const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Interested",
  "Not Interested",
  "Follow-up",
  "Converted",
];

const LOAN_STATUSES = [
  "Draft",
  "Submitted",
  "Under Review",
  "Approved",
  "Rejected",
  "Closed",
];

// All reporting endpoints are admin-only.
router.use(protect, authorize("admin"));

// Calculate the current day in Indian Standard Time.
function getTodayISTRange() {
  const IST_OFFSET_MS = 330 * 60 * 1000;

  const now = new Date();
  const istNow = new Date(
    now.getTime() + IST_OFFSET_MS
  );

  const startOfDayUTC = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate()
  );

  const start = new Date(
    startOfDayUTC - IST_OFFSET_MS
  );

  const end = new Date(
    start.getTime() + 24 * 60 * 60 * 1000
  );

  return {
    start,
    end,
    date: istNow.toISOString().slice(0, 10),
  };
}

function handleReportError(res, error, reportName) {
  console.error(
    `${reportName} error:`,
    error.message
  );

  return res.status(500).json({
    success: false,
    message: "Unable to load report data.",
  });
}

// --------------------------------------------------
// GET /api/reports/overview
// ADMIN ONLY
// --------------------------------------------------

router.get("/overview", async (req, res) => {
  try {
    const { start, end, date } =
      getTodayISTRange();

    const [
      totalLeads,
      totalEmployees,
      activeEmployees,
      totalLoanApplications,
      callsResult,
    ] = await Promise.all([
      Lead.countDocuments(),

      User.countDocuments({
        role: "staff",
      }),

      User.countDocuments({
        role: "staff",
        isActive: true,
      }),

      LoanApplication.countDocuments(),

      Lead.aggregate([
        {
          $unwind: "$callHistory",
        },
        {
          $match: {
            "callHistory.calledAt": {
              $gte: start,
              $lt: end,
            },
          },
        },
        {
          $count: "total",
        },
      ]),
    ]);

    const callsToday =
      callsResult[0]?.total || 0;

    const teamDailyTarget =
      activeEmployees * DAILY_CALL_TARGET;

    const targetAchievementPercentage =
      teamDailyTarget > 0
        ? Number(
            (
              (callsToday / teamDailyTarget) *
              100
            ).toFixed(2)
          )
        : 0;

    return res.json({
      success: true,
      date,
      timezone: "Asia/Kolkata",
      overview: {
        totalLeads,
        totalEmployees,
        activeEmployees,
        totalLoanApplications,
        callsToday,
        dailyTargetPerEmployee:
          DAILY_CALL_TARGET,
        teamDailyTarget,
        targetAchievementPercentage,
      },
    });
  } catch (error) {
    return handleReportError(
      res,
      error,
      "Overview report"
    );
  }
});

// --------------------------------------------------
// GET /api/reports/calls
// ADMIN ONLY
// --------------------------------------------------

router.get("/calls", async (req, res) => {
  try {
    const { start, end, date } =
      getTodayISTRange();

    const [employees, callStatistics, recentCalls] =
      await Promise.all([
        User.find({
          role: "staff",
        })
          .select("name email isActive")
          .sort({ name: 1 })
          .lean(),

        Lead.aggregate([
          {
            $unwind: "$callHistory",
          },
          {
            $match: {
              "callHistory.calledAt": {
                $gte: start,
                $lt: end,
              },
            },
          },
          {
            $group: {
              _id: "$callHistory.calledBy",
              callsToday: {
                $sum: 1,
              },
              contacted: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$callHistory.status",
                        "Contacted",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              interested: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$callHistory.status",
                        "Interested",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              notInterested: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$callHistory.status",
                        "Not Interested",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              followUps: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$callHistory.status",
                        "Follow-up",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),

        Lead.aggregate([
          {
            $unwind: "$callHistory",
          },
          {
            $sort: {
              "callHistory.calledAt": -1,
            },
          },
          {
            $limit: 20,
          },
          {
            $lookup: {
              from: User.collection.name,
              localField:
                "callHistory.calledBy",
              foreignField: "_id",
              as: "employee",
            },
          },
          {
            $project: {
              _id: 0,
              leadId: "$_id",
              customerName: "$name",
              employeeName: {
                $ifNull: [
                  {
                    $arrayElemAt: [
                      "$employee.name",
                      0,
                    ],
                  },
                  "Unknown employee",
                ],
              },
              status:
                "$callHistory.status",
              remarks:
                "$callHistory.remarks",
              calledAt:
                "$callHistory.calledAt",
              nextFollowUp:
                "$callHistory.nextFollowUp",
            },
          },
        ]),
      ]);

    const statisticsMap = new Map(
      callStatistics.map((item) => [
        String(item._id),
        item,
      ])
    );

    const employeePerformance =
      employees.map((employee) => {
        const stats =
          statisticsMap.get(
            String(employee._id)
          ) || {};

        const callsToday =
          stats.callsToday || 0;

        return {
          employeeId: employee._id,
          name: employee.name,
          email: employee.email,
          isActive: employee.isActive,
          callsToday,
          dailyTarget: DAILY_CALL_TARGET,
          remainingCalls: Math.max(
            0,
            DAILY_CALL_TARGET - callsToday
          ),
          achievementPercentage: Number(
            (
              (callsToday /
                DAILY_CALL_TARGET) *
              100
            ).toFixed(2)
          ),
          targetAchieved:
            callsToday >= DAILY_CALL_TARGET,
          contacted: stats.contacted || 0,
          interested: stats.interested || 0,
          notInterested:
            stats.notInterested || 0,
          followUps: stats.followUps || 0,
        };
      });

    const activeEmployees =
      employees.filter(
        (employee) => employee.isActive
      ).length;

    const callsToday =
      callStatistics.reduce(
        (total, item) =>
          total + item.callsToday,
        0
      );

    const teamDailyTarget =
      activeEmployees * DAILY_CALL_TARGET;

    return res.json({
      success: true,
      date,
      timezone: "Asia/Kolkata",
      summary: {
        callsToday,
        activeEmployees,
        dailyTargetPerEmployee:
          DAILY_CALL_TARGET,
        teamDailyTarget,
        remainingCalls: Math.max(
          0,
          teamDailyTarget - callsToday
        ),
        achievementPercentage:
          teamDailyTarget > 0
            ? Number(
                (
                  (callsToday /
                    teamDailyTarget) *
                  100
                ).toFixed(2)
              )
            : 0,
      },
      employeePerformance,
      recentCalls,
    });
  } catch (error) {
    return handleReportError(
      res,
      error,
      "Call tracking report"
    );
  }
});

// --------------------------------------------------
// GET /api/reports/leads
// ADMIN ONLY
// --------------------------------------------------

router.get("/leads", async (req, res) => {
  try {
    const statusResults =
      await Lead.aggregate([
        {
          $group: {
            _id: "$status",
            count: {
              $sum: 1,
            },
          },
        },
      ]);

    const statusMap = new Map(
      statusResults.map((item) => [
        item._id,
        item.count,
      ])
    );

    const statusDistribution =
      LEAD_STATUSES.map((status) => ({
        status,
        count: statusMap.get(status) || 0,
      }));

    const totalLeads =
      statusDistribution.reduce(
        (total, item) =>
          total + item.count,
        0
      );

    const convertedLeads =
      statusMap.get("Converted") || 0;

    const interestedLeads =
      statusMap.get("Interested") || 0;

    const conversionRate =
      totalLeads > 0
        ? Number(
            (
              (convertedLeads /
                totalLeads) *
              100
            ).toFixed(2)
          )
        : 0;

    return res.json({
      success: true,
      summary: {
        totalLeads,
        convertedLeads,
        interestedLeads,
        conversionRate,
      },
      statusDistribution,
    });
  } catch (error) {
    return handleReportError(
      res,
      error,
      "Lead analytics report"
    );
  }
});

// --------------------------------------------------
// GET /api/reports/loans
// ADMIN ONLY
// --------------------------------------------------

router.get("/loans", async (req, res) => {
  try {
    const [statusResults, amountResults] =
      await Promise.all([
        LoanApplication.aggregate([
          {
            $group: {
              _id: "$status",
              count: {
                $sum: 1,
              },
            },
          },
        ]),

        LoanApplication.aggregate([
          {
            $group: {
              _id: null,
              totalRequestedAmount: {
                $sum: "$requestedAmount",
              },
              totalApprovedAmount: {
                $sum: {
                  $ifNull: [
                    "$approvedAmount",
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

    const statusMap = new Map(
      statusResults.map((item) => [
        item._id,
        item.count,
      ])
    );

    const statusDistribution =
      LOAN_STATUSES.map((status) => ({
        status,
        count: statusMap.get(status) || 0,
      }));

    const totalApplications =
      statusDistribution.reduce(
        (total, item) =>
          total + item.count,
        0
      );

    const approvedApplications =
      statusMap.get("Approved") || 0;

    const rejectedApplications =
      statusMap.get("Rejected") || 0;

    const closedApplications =
      statusMap.get("Closed") || 0;

    const submittedApplications =
      statusMap.get("Submitted") || 0;

    const underReviewApplications =
      statusMap.get("Under Review") || 0;

    const decidedApplications =
      approvedApplications +
      rejectedApplications;

    const approvalRate =
      decidedApplications > 0
        ? Number(
            (
              (approvedApplications /
                decidedApplications) *
              100
            ).toFixed(2)
          )
        : 0;

    return res.json({
      success: true,
      summary: {
        totalApplications,
        approvedApplications,
        rejectedApplications,
        closedApplications,
        submittedApplications,
        underReviewApplications,
        approvalRate,
        totalRequestedAmount:
          amountResults[0]
            ?.totalRequestedAmount || 0,
        totalApprovedAmount:
          amountResults[0]
            ?.totalApprovedAmount || 0,
      },
      statusDistribution,
    });
  } catch (error) {
    return handleReportError(
      res,
      error,
      "Loan analytics report"
    );
  }
});

// --------------------------------------------------
// GET /api/reports/recent-activity
// ADMIN ONLY — latest recorded CRM activity
// --------------------------------------------------

router.get("/recent-activity", async (req, res) => {
  try {
    const [
      recentLeads,
      recentCalls,
      recentApplications,
    ] = await Promise.all([
      Lead.find()
        .select("name createdAt")
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),

      Lead.aggregate([
        {
          $unwind: "$callHistory",
        },
        {
          $sort: {
            "callHistory.calledAt": -1,
          },
        },
        {
          $limit: 15,
        },
        {
          $lookup: {
            from: User.collection.name,
            localField: "callHistory.calledBy",
            foreignField: "_id",
            as: "employee",
          },
        },
        {
          $project: {
            _id: 0,
            customerName: "$name",
            status: "$callHistory.status",
            occurredAt: "$callHistory.calledAt",
            employeeName: {
              $ifNull: [
                {
                  $arrayElemAt: [
                    "$employee.name",
                    0,
                  ],
                },
                "Staff member",
              ],
            },
          },
        },
      ]),

      LoanApplication.find()
        .select("status createdAt updatedAt")
        .sort({ updatedAt: -1 })
        .limit(15)
        .lean(),
    ]);

    const activities = [
      // New customer leads
      ...recentLeads.map((lead) => ({
        id: `lead-${lead._id}`,
        name: lead.name,
        action: "Customer lead created",
        type: "lead",
        occurredAt: lead.createdAt,
      })),

      // Employee customer calls
      ...recentCalls.map((call, index) => ({
        id: `call-${index}-${new Date(
          call.occurredAt
        ).getTime()}`,
        name: call.employeeName,
        action: `Called ${call.customerName} — ${call.status}`,
        type: "call",
        occurredAt: call.occurredAt,
      })),

      // Loan application status
      ...recentApplications.map((application) => ({
        id: `application-${application._id}`,
        name: "Loan application",
        action: `Current status: ${application.status}`,
        type: "application",
        occurredAt:
          application.updatedAt ||
          application.createdAt,
      })),
    ]
      .filter(
        (activity) =>
          activity.occurredAt &&
          !Number.isNaN(
            new Date(activity.occurredAt).getTime()
          )
      )
      .sort(
        (a, b) =>
          new Date(b.occurredAt) -
          new Date(a.occurredAt)
      )
      .slice(0, 12);

    return res.json({
      success: true,
      activities,
    });
  } catch (error) {
    return handleReportError(
      res,
      error,
      "Recent activity report"
    );
  }
});

module.exports = router;
