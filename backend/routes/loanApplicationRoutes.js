
const express = require("express");
const mongoose = require("mongoose");

const LoanApplication = require("../models/LoanApplication");
const Lead = require("../models/Lead");
const Bank = require("../models/Bank");
const LoanScheme = require("../models/LoanScheme");
const User = require("../models/User");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

const APPLICATION_STATUSES = [
  "Draft",
  "Submitted",
  "Under Review",
  "Approved",
  "Rejected",
  "Closed",
];

const populateApplication = (query) =>
  query
    .populate(
      "lead",
      "name phone email loanType loanAmount status assignedTo"
    )
    .populate("bank", "name code isActive")
    .populate(
      "loanScheme",
      "schemeName loanType interestRate minLoanAmount maxLoanAmount minTenureMonths maxTenureMonths"
    )
    .populate("assignedTo", "name email role")
    .populate("reviewedBy", "name email")
    .populate("statusHistory.changedBy", "name email");

function isValidId(value) {
  return mongoose.isValidObjectId(value);
}

function fail(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function handleError(res, error) {
  console.error("Loan application error:", error);

  if (error.name === "ValidationError") {
    const message = Object.values(error.errors)
      .map((item) => item.message)
      .join(", ");

    return fail(res, 400, message);
  }

  if (error.name === "CastError") {
    return fail(res, 400, "Invalid application data.");
  }

  if (error.code === 11000) {
    return fail(res, 409, "Duplicate application data.");
  }

  return fail(res, 500, "Server error. Please try again.");
}

function cleanRemarks(value, maxLength = 2000) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    return null;
  }

  const remarks = value.trim();

  if (remarks.length > maxLength) {
    return null;
  }

  return remarks;
}

function isPositiveInteger(value) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

async function validateLoanDetails({
  leadId,
  bankId,
  schemeId,
  assignedToId,
  requestedAmount,
  tenureMonths,
}) {
  if (
    !isValidId(leadId) ||
    !isValidId(bankId) ||
    !isValidId(schemeId) ||
    !isValidId(assignedToId)
  ) {
    return {
      error: "Invalid lead, bank, scheme, or employee ID.",
    };
  }

  if (!isPositiveInteger(requestedAmount)) {
    return {
      error: "Requested amount must be a positive whole number.",
    };
  }

  if (!isPositiveInteger(tenureMonths)) {
    return {
      error: "Tenure must be a positive whole number of months.",
    };
  }

  const [lead, bank, scheme, employee] = await Promise.all([
    Lead.findById(leadId),
    Bank.findById(bankId),
    LoanScheme.findById(schemeId),
    User.findById(assignedToId),
  ]);

  if (!lead) {
    return { error: "Customer lead not found." };
  }

  if (!bank || !bank.isActive) {
    return {
      error: "Select an active bank.",
    };
  }

  if (!scheme || !scheme.isActive) {
    return {
      error: "Select an active loan scheme.",
    };
  }

  if (String(scheme.bank) !== String(bank._id)) {
    return {
      error: "The selected scheme does not belong to this bank.",
    };
  }

  if (scheme.loanType !== lead.loanType) {
    return {
      error: "The scheme loan type must match the customer's lead.",
    };
  }

  if (
    requestedAmount < scheme.minLoanAmount ||
    requestedAmount > scheme.maxLoanAmount
  ) {
    return {
      error: "Requested amount is outside the scheme's allowed range.",
    };
  }

  if (
    tenureMonths < scheme.minTenureMonths ||
    tenureMonths > scheme.maxTenureMonths
  ) {
    return {
      error: "Tenure is outside the scheme's allowed range.",
    };
  }

  if (
    !employee ||
    employee.role !== "staff" ||
    !employee.isActive
  ) {
    return {
      error: "Select an active staff employee.",
    };
  }

  if (String(lead.assignedTo) !== String(employee._id)) {
    return {
      error:
        "The application employee must match the lead's assigned employee.",
    };
  }

  return { lead, bank, scheme, employee };
}

// GET /api/loan-applications
// Admin sees all applications.
// Staff sees only their assigned applications.
router.get("/", async (req, res) => {
  try {
    const filter =
      req.user.role === "admin"
        ? {}
        : { assignedTo: req.user._id };

    const applications = await populateApplication(
      LoanApplication.find(filter).sort({ createdAt: -1 })
    );

    return res.json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/loan-applications/:id
// Admin can view any application.
// Staff can view only their assigned applications.
router.get("/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 400, "Invalid application ID.");
    }

    const application = await populateApplication(
      LoanApplication.findById(req.params.id)
    );

    if (!application) {
      return fail(res, 404, "Loan application not found.");
    }

    if (
      req.user.role !== "admin" &&
      String(application.assignedTo?._id) !==
        String(req.user._id)
    ) {
      return fail(res, 403, "Access denied.");
    }

    return res.json({
      success: true,
      application,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// POST /api/loan-applications
// ONLY STAFF can create a draft application.
router.post("/", authorize("staff"), async (req, res) => {
  try {
    const {
      lead,
      bank,
      loanScheme,
      requestedAmount,
      tenureMonths,
      remarks,
    } = req.body;

    const cleanedRemarks = cleanRemarks(remarks);

    if (cleanedRemarks === null) {
      return fail(res, 400, "Invalid application remarks.");
    }

    // Always use the logged-in employee.
    // Never trust an assignedTo value from the request body.
    const employeeId = String(req.user._id);

    const validation = await validateLoanDetails({
      leadId: lead,
      bankId: bank,
      schemeId: loanScheme,
      assignedToId: employeeId,
      requestedAmount,
      tenureMonths,
    });

    if (validation.error) {
      return fail(res, 400, validation.error);
    }

    if (
      String(validation.lead.assignedTo) !== employeeId
    ) {
      return fail(
        res,
        403,
        "You can create applications only for your assigned leads."
      );
    }

    const application = await LoanApplication.create({
      lead,
      bank,
      loanScheme,
      assignedTo: employeeId,
      requestedAmount,
      tenureMonths,
      remarks: cleanedRemarks,
      status: "Draft",
      statusHistory: [
        {
          status: "Draft",
          changedBy: req.user._id,
          remarks: "Application created.",
        },
      ],
    });

    const populated = await populateApplication(
      LoanApplication.findById(application._id)
    );

    return res.status(201).json({
      success: true,
      message: "Loan application created successfully.",
      application: populated,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// PUT /api/loan-applications/:id
// ONLY STAFF can edit their own Draft applications.
router.put("/:id", authorize("staff"), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 400, "Invalid application ID.");
    }

    const application = await LoanApplication.findById(
      req.params.id
    );

    if (!application) {
      return fail(res, 404, "Loan application not found.");
    }

    if (
      String(application.assignedTo) !==
      String(req.user._id)
    ) {
      return fail(res, 403, "Access denied.");
    }

    if (application.status !== "Draft") {
      return fail(
        res,
        400,
        "Only draft applications can be edited."
      );
    }

    const lead =
      req.body.lead ?? String(application.lead);

    const bank =
      req.body.bank ?? String(application.bank);

    const loanScheme =
      req.body.loanScheme ??
      String(application.loanScheme);

    // The employee cannot reassign the application.
    const assignedTo = String(req.user._id);

    const requestedAmount =
      req.body.requestedAmount ??
      application.requestedAmount;

    const tenureMonths =
      req.body.tenureMonths ??
      application.tenureMonths;

    const remarks =
      req.body.remarks ?? application.remarks;

    const cleanedRemarks = cleanRemarks(remarks);

    if (cleanedRemarks === null) {
      return fail(res, 400, "Invalid application remarks.");
    }

    const validation = await validateLoanDetails({
      leadId: lead,
      bankId: bank,
      schemeId: loanScheme,
      assignedToId: assignedTo,
      requestedAmount,
      tenureMonths,
    });

    if (validation.error) {
      return fail(res, 400, validation.error);
    }

    if (
      String(validation.lead.assignedTo) !==
      String(req.user._id)
    ) {
      return fail(
        res,
        403,
        "You can edit applications only for your assigned leads."
      );
    }

    application.lead = lead;
    application.bank = bank;
    application.loanScheme = loanScheme;
    application.assignedTo = assignedTo;
    application.requestedAmount = requestedAmount;
    application.tenureMonths = tenureMonths;
    application.remarks = cleanedRemarks;

    await application.save();

    const populated = await populateApplication(
      LoanApplication.findById(application._id)
    );

    return res.json({
      success: true,
      message: "Loan application updated successfully.",
      application: populated,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// PATCH /api/loan-applications/:id/submit
// ONLY STAFF can submit their own Draft applications.
router.patch(
  "/:id/submit",
  authorize("staff"),
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return fail(res, 400, "Invalid application ID.");
      }

      const application = await LoanApplication.findById(
        req.params.id
      );

      if (!application) {
        return fail(res, 404, "Loan application not found.");
      }

      if (
        String(application.assignedTo) !==
        String(req.user._id)
      ) {
        return fail(res, 403, "Access denied.");
      }

      if (application.status !== "Draft") {
        return fail(
          res,
          400,
          "Only draft applications can be submitted."
        );
      }

      const validation = await validateLoanDetails({
        leadId: String(application.lead),
        bankId: String(application.bank),
        schemeId: String(application.loanScheme),
        assignedToId: String(application.assignedTo),
        requestedAmount: application.requestedAmount,
        tenureMonths: application.tenureMonths,
      });

      if (validation.error) {
        return fail(res, 400, validation.error);
      }

      if (
        String(validation.lead.assignedTo) !==
        String(req.user._id)
      ) {
        return fail(
          res,
          403,
          "You can submit applications only for your assigned leads."
        );
      }

      application.status = "Submitted";
      application.submittedAt = new Date();

      application.statusHistory.push({
        status: "Submitted",
        changedBy: req.user._id,
        remarks: "Application submitted for admin review.",
      });

      await application.save();

      const populated = await populateApplication(
        LoanApplication.findById(application._id)
      );

      return res.json({
        success: true,
        message: "Loan application submitted successfully.",
        application: populated,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
);

// PATCH /api/loan-applications/:id/review
// ONLY ADMIN can start reviewing a submitted application.
router.patch(
  "/:id/review",
  authorize("admin"),
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return fail(res, 400, "Invalid application ID.");
      }

      const application = await LoanApplication.findById(
        req.params.id
      );

      if (!application) {
        return fail(res, 404, "Loan application not found.");
      }

      if (application.status !== "Submitted") {
        return fail(
          res,
          400,
          "Only submitted applications can enter review."
        );
      }

      application.status = "Under Review";

      application.statusHistory.push({
        status: "Under Review",
        changedBy: req.user._id,
        remarks: "Admin review started.",
      });

      await application.save();

      const populated = await populateApplication(
        LoanApplication.findById(application._id)
      );

      return res.json({
        success: true,
        message: "Application moved to Under Review.",
        application: populated,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
);

// PATCH /api/loan-applications/:id/decision
// ONLY ADMIN can approve or reject an application.
router.patch(
  "/:id/decision",
  authorize("admin"),
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return fail(res, 400, "Invalid application ID.");
      }

      const application = await LoanApplication.findById(
        req.params.id
      );

      if (!application) {
        return fail(res, 404, "Loan application not found.");
      }

      if (application.status !== "Under Review") {
        return fail(
          res,
          400,
          "Only applications Under Review can receive a decision."
        );
      }

      const {
        decision,
        approvedAmount,
        decisionRemarks,
      } = req.body;

      if (
        !["Approved", "Rejected"].includes(decision)
      ) {
        return fail(
          res,
          400,
          "Decision must be Approved or Rejected."
        );
      }

      const remarks = cleanRemarks(
        decisionRemarks,
        1000
      );

      if (remarks === null) {
        return fail(
          res,
          400,
          "Decision remarks cannot exceed 1000 characters."
        );
      }

      if (
        decision === "Rejected" &&
        remarks.length < 2
      ) {
        return fail(
          res,
          400,
          "Please provide a rejection reason."
        );
      }

      if (decision === "Approved") {
        if (!isPositiveInteger(approvedAmount)) {
          return fail(
            res,
            400,
            "Approved amount must be a positive whole number."
          );
        }

        if (
          approvedAmount >
          application.requestedAmount
        ) {
          return fail(
            res,
            400,
            "Approved amount cannot exceed the requested amount."
          );
        }

        application.approvedAmount =
          approvedAmount;
      } else {
        application.approvedAmount = null;
      }

      application.status = decision;
      application.reviewedBy = req.user._id;
      application.reviewedAt = new Date();
      application.decisionRemarks = remarks;

      application.statusHistory.push({
        status: decision,
        changedBy: req.user._id,
        remarks:
          remarks ||
          `Application ${decision.toLowerCase()}.`,
      });

      await application.save();

      const populated = await populateApplication(
        LoanApplication.findById(application._id)
      );

      return res.json({
        success: true,
        message:
          decision === "Approved"
            ? "Loan application approved successfully."
            : "Loan application rejected successfully.",
        application: populated,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
);

// PATCH /api/loan-applications/:id/close
// ONLY ADMIN can close an approved application.
router.patch(
  "/:id/close",
  authorize("admin"),
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return fail(res, 400, "Invalid application ID.");
      }

      const application = await LoanApplication.findById(
        req.params.id
      );

      if (!application) {
        return fail(res, 404, "Loan application not found.");
      }

      if (application.status !== "Approved") {
        return fail(
          res,
          400,
          "Only approved applications can be closed."
        );
      }

      const remarks = cleanRemarks(
        req.body.remarks,
        1000
      );

      if (remarks === null) {
        return fail(
          res,
          400,
          "Closure remarks cannot exceed 1000 characters."
        );
      }

      application.status = "Closed";
      application.closedAt = new Date();

      application.statusHistory.push({
        status: "Closed",
        changedBy: req.user._id,
        remarks:
          remarks ||
          "Approved loan application closed.",
      });

      await application.save();

      const populated = await populateApplication(
        LoanApplication.findById(application._id)
      );

      return res.json({
        success: true,
        message: "Loan application closed successfully.",
        application: populated,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
);

module.exports = router;
