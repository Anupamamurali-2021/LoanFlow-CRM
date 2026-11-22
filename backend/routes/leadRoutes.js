
const express = require("express");
const mongoose = require("mongoose");

const Lead = require("../models/Lead");
const User = require("../models/User");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

const loanTypes = [
  "Personal Loan",
  "Home Loan",
  "Business Loan",
  "Vehicle Loan",
  "Education Loan",
];

const leadStatuses = [
  "New",
  "Contacted",
  "Interested",
  "Not Interested",
  "Follow-up",
  "Converted",
];

const callStatuses = [
  "Contacted",
  "Interested",
  "Not Interested",
  "Follow-up",
];

const allowedEditFields = [
  "name",
  "phone",
  "email",
  "loanType",
  "loanAmount",
  "remarks",
  "status",
  "assignedTo",
  "nextFollowUp",
];

const DAILY_CALL_TARGET = 100;

// Validate customer and loan details
function validateLeadFields(data, isCreating = false) {
  const errors = [];

  if (isCreating || data.name !== undefined) {
    if (
      typeof data.name !== "string" ||
      data.name.trim().length < 2 ||
      data.name.trim().length > 100
    ) {
      errors.push(
        "Customer name must be 2 to 100 characters."
      );
    }
  }

  if (isCreating || data.phone !== undefined) {
    if (
      typeof data.phone !== "string" ||
      !/^[6-9]\d{9}$/.test(data.phone.trim())
    ) {
      errors.push(
        "Enter a valid 10-digit Indian mobile number."
      );
    }
  }

  if (data.email !== undefined && data.email !== "") {
    if (
      typeof data.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        data.email.trim()
      )
    ) {
      errors.push("Enter a valid email address.");
    }
  }

  if (isCreating || data.loanType !== undefined) {
    if (!loanTypes.includes(data.loanType)) {
      errors.push("Select a valid loan type.");
    }
  }

  if (isCreating || data.loanAmount !== undefined) {
    if (
      typeof data.loanAmount !== "number" ||
      !Number.isFinite(data.loanAmount) ||
      !Number.isInteger(data.loanAmount) ||
      data.loanAmount <= 0
    ) {
      errors.push(
        "Loan amount must be a positive whole number."
      );
    }
  }

  if (data.remarks !== undefined) {
    if (
      typeof data.remarks !== "string" ||
      data.remarks.length > 1000
    ) {
      errors.push(
        "Remarks cannot exceed 1000 characters."
      );
    }
  }

  if (
    data.status !== undefined &&
    !leadStatuses.includes(data.status)
  ) {
    errors.push("Select a valid lead status.");
  }

  if (
    data.assignedTo !== undefined &&
    data.assignedTo !== null &&
    data.assignedTo !== "" &&
    !mongoose.isValidObjectId(data.assignedTo)
  ) {
    errors.push("Invalid employee ID.");
  }

  if (
    data.nextFollowUp !== undefined &&
    data.nextFollowUp !== null &&
    data.nextFollowUp !== ""
  ) {
    const date = new Date(data.nextFollowUp);

    if (Number.isNaN(date.getTime())) {
      errors.push("Enter a valid follow-up date.");
    } else if (date.getTime() <= Date.now()) {
      errors.push(
        "Follow-up date must be in the future."
      );
    }
  }

  return errors;
}

// Prepare values before saving
function prepareLeadData(data) {
  const prepared = {};

  for (const field of allowedEditFields) {
    if (data[field] === undefined) continue;

    if (
      ["name", "phone", "email", "remarks"].includes(
        field
      ) &&
      typeof data[field] === "string"
    ) {
      prepared[field] = data[field].trim();
    } else {
      prepared[field] = data[field];
    }
  }

  if (prepared.email === "") {
    prepared.email = undefined;
  }

  if (typeof prepared.email === "string") {
    prepared.email = prepared.email.toLowerCase();
  }

  if (prepared.assignedTo === "") {
    prepared.assignedTo = null;
  }

  if (prepared.nextFollowUp === "") {
    prepared.nextFollowUp = null;
  }

  if (
    prepared.nextFollowUp !== undefined &&
    prepared.nextFollowUp !== null
  ) {
    prepared.nextFollowUp = new Date(
      prepared.nextFollowUp
    );
  }

  return prepared;
}

// Handle database errors
function handleError(res, error, action) {
  console.error(`${action} error:`, error.message);

  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid lead information.",
    });
  }

  return res.status(500).json({
    success: false,
    message: `Server error while ${action.toLowerCase()}.`,
  });
}

// Check that the employee is active staff
async function validateEmployee(employeeId) {
  if (!employeeId) return true;

  const employee = await User.findById(employeeId);

  return Boolean(
    employee &&
    employee.role === "staff" &&
    employee.isActive === true
  );
}

// Get employee ID from verified authentication
function getEmployeeId(req) {
  const employeeId = req.user?._id || req.user?.id;

  if (
    !employeeId ||
    !mongoose.isValidObjectId(employeeId)
  ) {
    return null;
  }

  return employeeId;
}

// Calculate start and end of today in IST.
// IST is UTC + 5 hours 30 minutes.
function getTodayISTRange() {
  const IST_OFFSET_MS = 330 * 60 * 1000;

  const now = new Date();

  const istNow = new Date(
    now.getTime() + IST_OFFSET_MS
  );

  const startOfISTDayAsUTC = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate()
  );

  const start = new Date(
    startOfISTDayAsUTC - IST_OFFSET_MS
  );

  const end = new Date(
    start.getTime() + 24 * 60 * 60 * 1000
  );

  const date = istNow.toISOString().slice(0, 10);

  return { start, end, date };
}

// --------------------------------------------------
// BULK UPLOAD LEADS - ADMIN ONLY
// POST /api/leads/bulk-upload
// --------------------------------------------------

router.post(
  "/bulk-upload",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const { leads } = req.body || {};

      if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please provide a non-empty array of leads.",
        });
      }

      if (leads.length > 500) {
        return res.status(400).json({
          success: false,
          message: "You can upload a maximum of 500 leads at a time.",
        });
      }

      const results = {
        total: leads.length,
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: [],
      };

      const validLeads = [];
      const seenPhones = new Set();

      // Check duplicate numbers against existing leads.
      const phones = leads
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            typeof item.phone === "string"
        )
        .map((item) => item.phone.trim())
        .filter((phone) => /^[6-9]\d{9}$/.test(phone));

      const existingLeads = await Lead.find({
        phone: { $in: phones },
      })
        .select("phone")
        .lean();

      const existingPhones = new Set(
        existingLeads.map((item) => item.phone)
      );

      // Load active staff for assignment validation.
      const employees = await User.find({
        role: "staff",
        isActive: true,
      })
        .select("_id")
        .lean();

      const activeEmployeeIds = new Set(
        employees.map((employee) =>
          String(employee._id)
        )
      );

      for (let index = 0; index < leads.length; index++) {
        const rowNumber = index + 2;
        const raw = leads[index];

        if (
          !raw ||
          typeof raw !== "object" ||
          Array.isArray(raw)
        ) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            message: "Invalid lead record.",
          });
          continue;
        }

        const leadData = {
          name:
            typeof raw.name === "string"
              ? raw.name.trim()
              : raw.name,
          phone:
            typeof raw.phone === "string"
              ? raw.phone.trim()
              : raw.phone,
          email:
            typeof raw.email === "string"
              ? raw.email.trim()
              : raw.email,
          loanType:
            typeof raw.loanType === "string"
              ? raw.loanType.trim()
              : raw.loanType,
          loanAmount:
            raw.loanAmount === "" ||
              raw.loanAmount === null ||
              raw.loanAmount === undefined
              ? NaN
              : Number(raw.loanAmount),
          remarks:
            typeof raw.remarks === "string"
              ? raw.remarks.trim()
              : raw.remarks ?? "",
          status:
            typeof raw.status === "string" &&
              raw.status.trim()
              ? raw.status.trim()
              : "New",
          assignedTo:
            typeof raw.assignedTo === "string"
              ? raw.assignedTo.trim()
              : raw.assignedTo ?? null,
        };

        const errors = validateLeadFields(
          leadData,
          true
        );

        if (errors.length > 0) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            message: errors.join(" "),
          });
          continue;
        }

        const phone = leadData.phone;

        if (
          seenPhones.has(phone) ||
          existingPhones.has(phone)
        ) {
          results.skipped++;
          results.errors.push({
            row: rowNumber,
            message: "Duplicate phone number.",
          });
          continue;
        }

        if (
          leadData.assignedTo &&
          !activeEmployeeIds.has(
            String(leadData.assignedTo)
          )
        ) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            message:
              "Assigned employee must be an active staff member.",
          });
          continue;
        }

        seenPhones.add(phone);

        validLeads.push({
          row: rowNumber,
          data: prepareLeadData(leadData),
        });
      }

      // Save valid leads independently so one failed
      // record does not prevent other imports.
      for (const item of validLeads) {
        try {
          await Lead.create(item.data);
          results.imported++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: item.row,
            message:
              error.name === "ValidationError"
                ? "Lead validation failed."
                : "Could not save this lead.",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message:
          `${results.imported} lead(s) imported, ` +
          `${results.skipped} skipped, ` +
          `${results.failed} failed.`,
        ...results,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Bulk uploading leads"
      );
    }
  }
);

// --------------------------------------------------
// CREATE LEAD - ADMIN ONLY
// POST /api/leads
// --------------------------------------------------

router.post(
  "/",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const errors = validateLeadFields(
        req.body,
        true
      );

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: errors[0],
          errors,
        });
      }

      const leadData = prepareLeadData(req.body);

      if (
        leadData.assignedTo &&
        !(await validateEmployee(
          leadData.assignedTo
        ))
      ) {
        return res.status(400).json({
          success: false,
          message: "Select an active staff employee.",
        });
      }

      const lead = await Lead.create(leadData);

      return res.status(201).json({
        success: true,
        message: "Lead created successfully.",
        lead,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Creating lead"
      );
    }
  }
);

// --------------------------------------------------
// VIEW ALL LEADS - ADMIN ONLY
// GET /api/leads
// --------------------------------------------------

router.get(
  "/",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const leads = await Lead.find()
        .populate("assignedTo", "name email")
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        count: leads.length,
        leads,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Fetching leads"
      );
    }
  }
);

// --------------------------------------------------
// VIEW MY ASSIGNED LEADS - STAFF ONLY
// GET /api/leads/my-leads
// --------------------------------------------------

router.get(
  "/my-leads",
  protect,
  authorize("staff"),
  async (req, res) => {
    try {
      const employeeId = getEmployeeId(req);

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: "Invalid authentication details.",
        });
      }

      const leads = await Lead.find({
        assignedTo: employeeId,
      })
        .select(
          "name phone email loanType loanAmount " +
          "status remarks nextFollowUp " +
          "lastCalledAt callCount createdAt updatedAt"
        )
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        count: leads.length,
        leads,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Fetching assigned leads"
      );
    }
  }
);

// --------------------------------------------------
// MY CALL STATISTICS - STAFF ONLY
// GET /api/leads/my-call-stats
// --------------------------------------------------

router.get(
  "/my-call-stats",
  protect,
  authorize("staff"),
  async (req, res) => {
    try {
      const employeeId = getEmployeeId(req);

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: "Invalid authentication details.",
        });
      }

      const { start, end, date } =
        getTodayISTRange();

      const employeeObjectId =
        new mongoose.Types.ObjectId(employeeId);

      // Count today's calls made by this employee.
      // Include calls on leads reassigned later.
      const todayResult = await Lead.aggregate([
        {
          $match: {
            "callHistory.calledBy": employeeObjectId,
          },
        },
        {
          $unwind: "$callHistory",
        },
        {
          $match: {
            "callHistory.calledBy": employeeObjectId,
            "callHistory.calledAt": {
              $gte: start,
              $lt: end,
            },
          },
        },
        {
          $count: "total",
        },
      ]);

      const callsToday = todayResult[0]?.total || 0;

      // Fetch the 20 most recent call records.
      const recentCalls = await Lead.aggregate([
        {
          $match: {
            "callHistory.calledBy": employeeObjectId,
          },
        },
        {
          $unwind: "$callHistory",
        },
        {
          $match: {
            "callHistory.calledBy": employeeObjectId,
          },
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
          $project: {
            _id: 0,
            leadId: "$_id",
            customerName: "$name",
            customerPhone: "$phone",
            callId: "$callHistory._id",
            status: "$callHistory.status",
            remarks: "$callHistory.remarks",
            calledAt: "$callHistory.calledAt",
            nextFollowUp:
              "$callHistory.nextFollowUp",
          },
        },
      ]);

      return res.json({
        success: true,
        date,
        timezone: "Asia/Kolkata",
        dailyTarget: DAILY_CALL_TARGET,
        callsToday,
        remainingCalls: Math.max(
          0,
          DAILY_CALL_TARGET - callsToday
        ),
        targetAchieved:
          callsToday >= DAILY_CALL_TARGET,
        recentCalls,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Fetching call statistics"
      );
    }
  }
);

// --------------------------------------------------
// RECORD CUSTOMER CALL - STAFF ONLY
// POST /api/leads/:id/calls
// --------------------------------------------------

router.post(
  "/:id/calls",
  protect,
  authorize("staff"),
  async (req, res) => {
    try {
      const employeeId = getEmployeeId(req);

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: "Invalid authentication details.",
        });
      }

      if (
        !mongoose.isValidObjectId(req.params.id)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid lead ID.",
        });
      }

      const body = req.body;

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide valid call details.",
        });
      }

      const allowedFields = [
        "status",
        "remarks",
        "nextFollowUp",
      ];

      const fields = Object.keys(body);

      if (
        fields.length === 0 ||
        fields.some(
          (field) => !allowedFields.includes(field)
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid call details.",
        });
      }

      const {
        status,
        remarks,
        nextFollowUp,
      } = body;

      if (!callStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Select a valid call status.",
        });
      }

      if (
        typeof remarks !== "string" ||
        remarks.trim().length < 2 ||
        remarks.trim().length > 1000
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Call remarks must be 2 to 1000 characters.",
        });
      }

      let followUpDate = null;

      if (
        nextFollowUp !== undefined &&
        nextFollowUp !== null &&
        nextFollowUp !== ""
      ) {
        if (
          typeof nextFollowUp !== "string" ||
          nextFollowUp.trim() === ""
        ) {
          return res.status(400).json({
            success: false,
            message: "Enter a valid follow-up date.",
          });
        }

        followUpDate = new Date(nextFollowUp);

        if (
          Number.isNaN(followUpDate.getTime()) ||
          followUpDate.getTime() <= Date.now()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Follow-up date must be in the future.",
          });
        }
      }

      if (
        status === "Follow-up" &&
        !followUpDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Schedule a future date for a follow-up call.",
        });
      }

      const calledAt = new Date();

      const callRecord = {
        calledBy: employeeId,
        calledAt,
        status,
        remarks: remarks.trim(),
        nextFollowUp: followUpDate,
      };

      // Only the currently assigned employee
      // can record a call against this lead.
      const lead = await Lead.findOneAndUpdate(
        {
          _id: req.params.id,
          assignedTo: employeeId,
        },
        {
          $push: {
            callHistory: callRecord,
          },
          $inc: {
            callCount: 1,
          },
          $set: {
            status,
            remarks: remarks.trim(),
            lastCalledAt: calledAt,
            nextFollowUp: followUpDate,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message:
            "Lead not found or not assigned to you.",
        });
      }

      return res.status(201).json({
        success: true,
        message: "Call recorded successfully.",
        lead,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Recording customer call"
      );
    }
  }
);

// --------------------------------------------------
// VIEW ONE LEAD - ADMIN ONLY
// GET /api/leads/:id
// --------------------------------------------------

router.get(
  "/:id",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(req.params.id)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid lead ID.",
        });
      }

      const lead = await Lead.findById(
        req.params.id
      ).populate(
        "assignedTo",
        "name email"
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead not found.",
        });
      }

      return res.json({
        success: true,
        lead,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Fetching lead"
      );
    }
  }
);

// --------------------------------------------------
// EDIT LEAD - ADMIN ONLY
// PUT /api/leads/:id
// --------------------------------------------------

router.put(
  "/:id",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(req.params.id)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid lead ID.",
        });
      }

      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide valid lead details.",
        });
      }

      const fields = Object.keys(req.body);

      if (
        fields.length === 0 ||
        fields.some(
          (field) =>
            !allowedEditFields.includes(field)
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid or unsupported update fields.",
        });
      }

      const errors = validateLeadFields(
        req.body
      );

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: errors[0],
          errors,
        });
      }

      const leadData = prepareLeadData(
        req.body
      );

      if (
        leadData.assignedTo &&
        !(await validateEmployee(
          leadData.assignedTo
        ))
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Select an active staff employee.",
        });
      }

      const lead = await Lead.findById(
        req.params.id
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead not found.",
        });
      }

      lead.set(leadData);

      await lead.save();

      await lead.populate(
        "assignedTo",
        "name email"
      );

      return res.json({
        success: true,
        message: "Lead updated successfully.",
        lead,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Updating lead"
      );
    }
  }
);

// --------------------------------------------------
// UPDATE LEAD STATUS - ADMIN ONLY
// PATCH /api/leads/:id/status
// --------------------------------------------------

router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(req.params.id)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid lead ID.",
        });
      }

      const { status } = req.body || {};

      if (!leadStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Select a valid lead status.",
        });
      }

      const lead = await Lead.findById(
        req.params.id
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead not found.",
        });
      }

      lead.status = status;

      await lead.save();

      return res.json({
        success: true,
        message:
          "Lead status updated successfully.",
        lead,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Updating lead status"
      );
    }
  }
);

// --------------------------------------------------
// ASSIGN LEAD TO EMPLOYEE - ADMIN ONLY
// PATCH /api/leads/:id/assign
// --------------------------------------------------

router.patch(
  "/:id/assign",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(req.params.id)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid lead ID.",
        });
      }

      const { assignedTo } = req.body || {};

      if (
        assignedTo !== null &&
        assignedTo !== "" &&
        !mongoose.isValidObjectId(assignedTo)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID.",
        });
      }

      if (
        assignedTo &&
        !(await validateEmployee(assignedTo))
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Select an active staff employee.",
        });
      }

      const lead = await Lead.findById(
        req.params.id
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead not found.",
        });
      }

      lead.assignedTo = assignedTo || null;

      await lead.save();

      await lead.populate(
        "assignedTo",
        "name email"
      );

      return res.json({
        success: true,
        message:
          "Lead assignment updated successfully.",
        lead,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Assigning lead"
      );
    }
  }
);

// --------------------------------------------------
// SCHEDULE FOLLOW-UP - ADMIN ONLY
// PATCH /api/leads/:id/follow-up
// --------------------------------------------------

router.patch(
  "/:id/follow-up",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(req.params.id)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid lead ID.",
        });
      }

      const { nextFollowUp } =
        req.body || {};

      if (nextFollowUp === undefined) {
        return res.status(400).json({
          success: false,
          message:
            "Provide a follow-up date or null.",
        });
      }

      const errors = validateLeadFields({
        nextFollowUp,
      });

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: errors[0],
        });
      }

      const lead = await Lead.findById(
        req.params.id
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead not found.",
        });
      }

      lead.nextFollowUp = nextFollowUp
        ? new Date(nextFollowUp)
        : null;

      await lead.save();

      return res.json({
        success: true,
        message: nextFollowUp
          ? "Follow-up scheduled successfully."
          : "Follow-up cleared successfully.",
        lead,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Scheduling follow-up"
      );
    }
  }
);

module.exports = router;
