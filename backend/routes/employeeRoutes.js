
const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// All employee routes require admin access
router.use(protect, authorize("admin"));

// --------------------------------------------------
// GET ALL EMPLOYEES
// GET /api/employees
// --------------------------------------------------

router.get("/", async (req, res) => {
  try {
    const employees = await User.find({
      role: "staff",
    })
      .select("name email role isActive createdAt")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: employees.length,
      employees,
    });
  } catch (error) {
    console.error("Fetch employees error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch employees.",
    });
  }
});

// --------------------------------------------------
// CREATE EMPLOYEE
// POST /api/employees
// --------------------------------------------------

router.post("/", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    // Validate employee name
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Employee name must be 2 to 100 characters.",
      });
    }

    // Validate email
    if (
      typeof email !== "string" ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid employee email address.",
      });
    }

    // Validate password
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8 to 72 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Prevent duplicate accounts
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 12);

    // Always create staff accounts, never admins
    const employee = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "staff",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Employee created successfully.",
      employee: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        isActive: employee.isActive,
        createdAt: employee.createdAt,
      },
    });
  } catch (error) {
    console.error("Create employee error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid employee details.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create employee.",
    });
  }
});

// --------------------------------------------------
// ACTIVATE OR DEACTIVATE EMPLOYEE
// PATCH /api/employees/:id/status
// --------------------------------------------------

router.patch("/:id/status", async (req, res) => {
  try {
    const mongoose = require("mongoose");

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID.",
      });
    }

    const { isActive } = req.body || {};

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Employee status must be true or false.",
      });
    }

    const employee = await User.findOne({
      _id: req.params.id,
      role: "staff",
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    employee.isActive = isActive;
    await employee.save();

    return res.json({
      success: true,
      message: isActive
        ? "Employee activated successfully."
        : "Employee deactivated successfully.",
      employee: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        isActive: employee.isActive,
      },
    });
  } catch (error) {
    console.error("Update employee status error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update employee status.",
    });
  }
});

module.exports = router;
