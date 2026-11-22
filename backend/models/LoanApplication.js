
const mongoose = require("mongoose");

// History of application status changes
const applicationHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: [
        "Draft",
        "Submitted",
        "Under Review",
        "Approved",
        "Rejected",
        "Closed",
      ],
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: [
        1000,
        "History remarks cannot exceed 1000 characters",
      ],
      default: "",
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const loanApplicationSchema = new mongoose.Schema(
  {
    // Customer lead linked to this application
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: [true, "Customer lead is required"],
      index: true,
    },

    // Selected bank
    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      required: [true, "Bank is required"],
    },

    // Selected loan scheme
    loanScheme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LoanScheme",
      required: [true, "Loan scheme is required"],
    },

    // Employee responsible for the application
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Assigned employee is required"],
    },

    // Loan amount requested by customer
    requestedAmount: {
      type: Number,
      required: [true, "Requested loan amount is required"],
      min: [1, "Requested amount must be greater than zero"],
      validate: {
        validator: Number.isInteger,
        message: "Requested amount must be a whole number",
      },
    },

    // Selected repayment period
    tenureMonths: {
      type: Number,
      required: [true, "Loan tenure is required"],
      min: [1, "Tenure must be at least one month"],
      validate: {
        validator: Number.isInteger,
        message: "Tenure must be a whole number",
      },
    },

    // Application processing status
    status: {
      type: String,
      enum: [
        "Draft",
        "Submitted",
        "Under Review",
        "Approved",
        "Rejected",
        "Closed",
      ],
      default: "Draft",
    },

    // Employee application notes
    remarks: {
      type: String,
      trim: true,
      maxlength: [
        2000,
        "Remarks cannot exceed 2000 characters",
      ],
      default: "",
    },

    // Date application was submitted
    submittedAt: {
      type: Date,
      default: null,
    },

    // Admin who made the approval/rejection decision
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    // Reason for rejection or admin review notes
    decisionRemarks: {
      type: String,
      trim: true,
      maxlength: [
        1000,
        "Decision remarks cannot exceed 1000 characters",
      ],
      default: "",
    },

    // Amount approved by admin
    approvedAmount: {
      type: Number,
      default: null,
      min: [1, "Approved amount must be greater than zero"],
      validate: {
        validator: (value) =>
          value === null ||
          (Number.isInteger(value) && value > 0),
        message: "Approved amount must be a positive whole number",
      },
    },

    // Date the application was closed
    closedAt: {
      type: Date,
      default: null,
    },

    // Full status-change history
    statusHistory: {
      type: [applicationHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster dashboard and reporting queries
loanApplicationSchema.index({
  status: 1,
  createdAt: -1,
});

loanApplicationSchema.index({
  assignedTo: 1,
  createdAt: -1,
});

loanApplicationSchema.index({
  bank: 1,
  loanScheme: 1,
});

loanApplicationSchema.index({
  submittedAt: -1,
});

module.exports = mongoose.model(
  "LoanApplication",
  loanApplicationSchema
);
