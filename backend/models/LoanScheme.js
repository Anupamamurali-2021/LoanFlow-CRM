
const mongoose = require("mongoose");

const loanSchemeSchema = new mongoose.Schema(
  {
    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      required: [true, "Bank is required"],
      index: true,
    },

    schemeName: {
      type: String,
      required: [true, "Scheme name is required"],
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    loanType: {
      type: String,
      required: [true, "Loan type is required"],
      enum: [
        "Personal Loan",
        "Home Loan",
        "Business Loan",
        "Vehicle Loan",
        "Education Loan",
        "Gold Loan",
        "Other",
      ],
    },

    interestRate: {
      type: Number,
      required: [true, "Interest rate is required"],
      min: [0, "Interest rate cannot be negative"],
      max: [100, "Interest rate cannot exceed 100%"],
    },

    minLoanAmount: {
      type: Number,
      required: [true, "Minimum loan amount is required"],
      min: [1, "Minimum loan amount must be positive"],
    },

    maxLoanAmount: {
      type: Number,
      required: [true, "Maximum loan amount is required"],
      min: [1, "Maximum loan amount must be positive"],
    },

    minTenureMonths: {
      type: Number,
      required: [true, "Minimum tenure is required"],
      min: [1, "Minimum tenure must be at least 1 month"],
    },

    maxTenureMonths: {
      type: Number,
      required: [true, "Maximum tenure is required"],
      min: [1, "Maximum tenure must be at least 1 month"],
    },

    eligibilityCriteria: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Validate minimum and maximum values.
loanSchemeSchema.pre("validate", function () {
  if (
    this.minLoanAmount != null &&
    this.maxLoanAmount != null &&
    this.maxLoanAmount < this.minLoanAmount
  ) {
    this.invalidate(
      "maxLoanAmount",
      "Maximum loan amount must be greater than or equal to minimum loan amount"
    );
  }

  if (
    this.minTenureMonths != null &&
    this.maxTenureMonths != null &&
    this.maxTenureMonths < this.minTenureMonths
  ) {
    this.invalidate(
      "maxTenureMonths",
      "Maximum tenure must be greater than or equal to minimum tenure"
    );
  }
});

loanSchemeSchema.index({
  bank: 1,
  loanType: 1,
  isActive: 1,
});

module.exports = mongoose.model(
  "LoanScheme",
  loanSchemeSchema
);
