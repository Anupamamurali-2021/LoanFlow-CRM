
const mongoose = require("mongoose");

// Each call is saved as a separate history record
const callHistorySchema = new mongoose.Schema(
  {
    calledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Employee is required"],
    },

    calledAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    status: {
      type: String,
      required: [true, "Call status is required"],
      enum: [
        "Contacted",
        "Interested",
        "Not Interested",
        "Follow-up",
      ],
    },

    remarks: {
      type: String,
      required: [true, "Call remarks are required"],
      trim: true,
      minlength: [
        2,
        "Call remarks must contain at least 2 characters",
      ],
      maxlength: [
        1000,
        "Call remarks cannot exceed 1000 characters",
      ],
    },

    nextFollowUp: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  }
);

const leadSchema = new mongoose.Schema(
  {
    // Customer Details
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [
        /^[6-9]\d{9}$/,
        "Enter a valid 10-digit mobile number",
      ],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Enter a valid email address",
      ],
      default: undefined,
    },

    // Loan Details
    loanType: {
      type: String,
      required: [true, "Loan type is required"],
      enum: [
        "Personal Loan",
        "Home Loan",
        "Business Loan",
        "Vehicle Loan",
        "Education Loan",
      ],
    },

    loanAmount: {
      type: Number,
      required: [true, "Loan amount is required"],
      min: [1, "Loan amount must be greater than zero"],
      validate: {
        validator: Number.isInteger,
        message: "Loan amount must be a whole number",
      },
    },

    // Lead Status
    status: {
      type: String,
      enum: [
        "New",
        "Contacted",
        "Interested",
        "Not Interested",
        "Follow-up",
        "Converted",
      ],
      default: "New",
    },

    // Employee Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Follow-up Scheduling
    nextFollowUp: {
      type: Date,
      default: null,
    },

    // Last Call Date
    lastCalledAt: {
      type: Date,
      default: null,
    },

    // Total Calls Made to This Lead
    callCount: {
      type: Number,
      default: 0,
      min: [0, "Call count cannot be negative"],
    },

    // Individual Call Records
    callHistory: {
      type: [callHistorySchema],
      default: [],
    },

    // Latest Customer Remarks
    remarks: {
      type: String,
      trim: true,
      maxlength: [
        1000,
        "Remarks cannot exceed 1000 characters",
      ],
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common CRM queries
leadSchema.index({ status: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ nextFollowUp: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({
  "callHistory.calledBy": 1,
  "callHistory.calledAt": -1,
});

module.exports = mongoose.model("Lead", leadSchema);
