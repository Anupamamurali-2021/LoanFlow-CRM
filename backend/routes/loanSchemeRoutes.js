
const express = require("express");
const mongoose = require("mongoose");

const LoanScheme = require("../models/LoanScheme");
const Bank = require("../models/Bank");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

const loanTypes = [
  "Personal Loan",
  "Home Loan",
  "Business Loan",
  "Vehicle Loan",
  "Education Loan",
  "Gold Loan",
  "Other",
];

const allowedFields = [
  "bank",
  "schemeName",
  "loanType",
  "interestRate",
  "minLoanAmount",
  "maxLoanAmount",
  "minTenureMonths",
  "maxTenureMonths",
  "eligibilityCriteria",
  "description",
];

function validateScheme(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      error: "Invalid loan scheme data.",
    };
  }

  const unknownFields = Object.keys(body).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    return {
      error: `Unknown field: ${unknownFields[0]}`,
    };
  }

  if (!mongoose.isValidObjectId(body.bank)) {
    return {
      error: "Please select a valid bank.",
    };
  }

  if (
    typeof body.schemeName !== "string" ||
    body.schemeName.trim().length < 2 ||
    body.schemeName.trim().length > 150
  ) {
    return {
      error: "Scheme name must contain 2 to 150 characters.",
    };
  }

  if (!loanTypes.includes(body.loanType)) {
    return {
      error: "Please select a valid loan type.",
    };
  }

  const numberFields = [
    "interestRate",
    "minLoanAmount",
    "maxLoanAmount",
    "minTenureMonths",
    "maxTenureMonths",
  ];

  const values = {};

  for (const field of numberFields) {
    const value = body[field];

    if (
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      return {
        error: `${field} must be a valid number.`,
      };
    }

    values[field] = value;
  }

  if (
    values.interestRate < 0 ||
    values.interestRate > 100
  ) {
    return {
      error: "Interest rate must be between 0 and 100%.",
    };
  }

  if (
    values.minLoanAmount <= 0 ||
    values.maxLoanAmount <= 0 ||
    values.maxLoanAmount < values.minLoanAmount
  ) {
    return {
      error: "Please enter a valid loan amount range.",
    };
  }

  if (
    !Number.isInteger(values.minLoanAmount) ||
    !Number.isInteger(values.maxLoanAmount)
  ) {
    return {
      error: "Loan amounts must be whole numbers.",
    };
  }

  if (
    !Number.isInteger(values.minTenureMonths) ||
    !Number.isInteger(values.maxTenureMonths) ||
    values.minTenureMonths < 1 ||
    values.maxTenureMonths < values.minTenureMonths
  ) {
    return {
      error: "Please enter a valid tenure range in months.",
    };
  }

  const eligibilityCriteria =
    body.eligibilityCriteria === undefined
      ? ""
      : body.eligibilityCriteria;

  const description =
    body.description === undefined
      ? ""
      : body.description;

  if (
    typeof eligibilityCriteria !== "string" ||
    eligibilityCriteria.trim().length > 2000
  ) {
    return {
      error: "Eligibility criteria cannot exceed 2000 characters.",
    };
  }

  if (
    typeof description !== "string" ||
    description.trim().length > 2000
  ) {
    return {
      error: "Description cannot exceed 2000 characters.",
    };
  }

  return {
    data: {
      bank: body.bank,
      schemeName: body.schemeName.trim(),
      loanType: body.loanType,
      ...values,
      eligibilityCriteria: eligibilityCriteria.trim(),
      description: description.trim(),
    },
  };
}

function handleSchemeError(error, res) {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid loan scheme data.",
    });
  }

  console.error("Loan scheme API error:", error.message);

  return res.status(500).json({
    success: false,
    message: "Unable to complete loan scheme operation.",
  });
}

// GET /api/loan-schemes
// Admin sees all schemes.
// Staff sees active schemes belonging to active banks.
router.get(
  "/",
  authorize("admin", "staff"),
  async (req, res) => {
    try {
      const filter =
        req.user.role === "admin"
          ? {}
          : { isActive: true };

      let schemes = await LoanScheme.find(filter)
        .populate("bank", "name code isActive")
        .sort({ createdAt: -1 });

      if (req.user.role === "staff") {
        schemes = schemes.filter(
          (scheme) => scheme.bank?.isActive === true
        );
      }

      return res.json({
        success: true,
        count: schemes.length,
        schemes,
      });
    } catch (error) {
      return handleSchemeError(error, res);
    }
  }
);

// POST /api/loan-schemes
// Admin only
router.post(
  "/",
  authorize("admin"),
  async (req, res) => {
    try {
      const result = validateScheme(req.body);

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      const bank = await Bank.findById(result.data.bank);

      if (!bank) {
        return res.status(404).json({
          success: false,
          message: "Selected bank does not exist.",
        });
      }

      if (!bank.isActive) {
        return res.status(400).json({
          success: false,
          message: "Cannot add a scheme to an inactive bank.",
        });
      }

      const scheme = await LoanScheme.create(result.data);

      await scheme.populate("bank", "name code isActive");

      return res.status(201).json({
        success: true,
        message: "Loan scheme added successfully.",
        scheme,
      });
    } catch (error) {
      return handleSchemeError(error, res);
    }
  }
);

// PUT /api/loan-schemes/:id
// Admin only
router.put(
  "/:id",
  authorize("admin"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid loan scheme ID.",
        });
      }

      const result = validateScheme(req.body);

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      const bank = await Bank.findById(result.data.bank);

      if (!bank) {
        return res.status(404).json({
          success: false,
          message: "Selected bank does not exist.",
        });
      }

      if (!bank.isActive) {
        return res.status(400).json({
          success: false,
          message: "Cannot assign a scheme to an inactive bank.",
        });
      }

      const scheme = await LoanScheme.findByIdAndUpdate(
        req.params.id,
        result.data,
        {
          new: true,
          runValidators: true,
        }
      ).populate("bank", "name code isActive");

      if (!scheme) {
        return res.status(404).json({
          success: false,
          message: "Loan scheme not found.",
        });
      }

      return res.json({
        success: true,
        message: "Loan scheme updated successfully.",
        scheme,
      });
    } catch (error) {
      return handleSchemeError(error, res);
    }
  }
);

// PATCH /api/loan-schemes/:id/status
// Admin only
router.patch(
  "/:id/status",
  authorize("admin"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid loan scheme ID.",
        });
      }

      if (typeof req.body.isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be true or false.",
        });
      }

      const scheme = await LoanScheme.findById(req.params.id);

      if (!scheme) {
        return res.status(404).json({
          success: false,
          message: "Loan scheme not found.",
        });
      }

      if (req.body.isActive) {
        const bank = await Bank.findById(scheme.bank);

        if (!bank || !bank.isActive) {
          return res.status(400).json({
            success: false,
            message:
              "Cannot activate a scheme when its bank is inactive.",
          });
        }
      }

      scheme.isActive = req.body.isActive;
      await scheme.save();

      await scheme.populate("bank", "name code isActive");

      return res.json({
        success: true,
        message: scheme.isActive
          ? "Loan scheme activated successfully."
          : "Loan scheme deactivated successfully.",
        scheme,
      });
    } catch (error) {
      return handleSchemeError(error, res);
    }
  }
);

module.exports = router;
