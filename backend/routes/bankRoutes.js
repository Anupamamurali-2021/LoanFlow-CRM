
const express = require("express");
const mongoose = require("mongoose");

const Bank = require("../models/Bank");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

const validateBankData = (body) => {
  const { name, code, description = "" } = body;

  if (typeof name !== "string") {
    return "Bank name is required.";
  }

  const cleanName = name.trim();

  if (cleanName.length < 2 || cleanName.length > 150) {
    return "Bank name must contain 2 to 150 characters.";
  }

  if (typeof code !== "string") {
    return "Bank code is required.";
  }

  const cleanCode = code.trim().toUpperCase();

  if (
    cleanCode.length < 2 ||
    cleanCode.length > 20 ||
    !/^[A-Z0-9_-]+$/.test(cleanCode)
  ) {
    return "Bank code must contain 2 to 20 letters, numbers, hyphens or underscores.";
  }

  if (
    typeof description !== "string" ||
    description.trim().length > 1000
  ) {
    return "Description must not exceed 1000 characters.";
  }

  return null;
};

const handleBankError = (error, res) => {
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A bank with this code already exists.",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Bank API error:", error.message);

  return res.status(500).json({
    success: false,
    message: "Unable to complete bank operation.",
  });
};

// GET /api/banks
// Admin and staff can view active banks.
// Admin can view all banks.
router.get(
  "/",
  authorize("admin", "staff"),
  async (req, res) => {
    try {
      const filter =
        req.user.role === "admin"
          ? {}
          : { isActive: true };

      const banks = await Bank.find(filter).sort({
        name: 1,
      });

      return res.json({
        success: true,
        count: banks.length,
        banks,
      });
    } catch (error) {
      return handleBankError(error, res);
    }
  }
);

// POST /api/banks
// Admin only
router.post(
  "/",
  authorize("admin"),
  async (req, res) => {
    try {
      const validationError = validateBankData(req.body);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError,
        });
      }

      const bank = await Bank.create({
        name: req.body.name.trim(),
        code: req.body.code.trim().toUpperCase(),
        description:
          typeof req.body.description === "string"
            ? req.body.description.trim()
            : "",
      });

      return res.status(201).json({
        success: true,
        message: "Bank added successfully.",
        bank,
      });
    } catch (error) {
      return handleBankError(error, res);
    }
  }
);

// PUT /api/banks/:id
// Admin only
router.put(
  "/:id",
  authorize("admin"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bank ID.",
        });
      }

      const validationError = validateBankData(req.body);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError,
        });
      }

      const bank = await Bank.findByIdAndUpdate(
        req.params.id,
        {
          name: req.body.name.trim(),
          code: req.body.code.trim().toUpperCase(),
          description:
            typeof req.body.description === "string"
              ? req.body.description.trim()
              : "",
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!bank) {
        return res.status(404).json({
          success: false,
          message: "Bank not found.",
        });
      }

      return res.json({
        success: true,
        message: "Bank updated successfully.",
        bank,
      });
    } catch (error) {
      return handleBankError(error, res);
    }
  }
);

// PATCH /api/banks/:id/status
// Admin only
router.patch(
  "/:id/status",
  authorize("admin"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bank ID.",
        });
      }

      if (typeof req.body.isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be true or false.",
        });
      }

      const bank = await Bank.findByIdAndUpdate(
        req.params.id,
        {
          isActive: req.body.isActive,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!bank) {
        return res.status(404).json({
          success: false,
          message: "Bank not found.",
        });
      }

      return res.json({
        success: true,
        message: bank.isActive
          ? "Bank activated successfully."
          : "Bank deactivated successfully.",
        bank,
      });
    } catch (error) {
      return handleBankError(error, res);
    }
  }
);

module.exports = router;
