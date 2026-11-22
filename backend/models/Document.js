
const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },

    documentType: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "Aadhaar Card",
        "PAN Card",
        "Bank Statement",
        "Salary Slip",
        "Address Proof",
        "Other",
      ],
    },

    originalName: {
      type: String,
      required: true,
      trim: true,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
    },

    filePath: {
      type: String,
      required: true,
      trim: true,
    },

    mimeType: {
      type: String,
      required: true,
      enum: [
        "application/pdf",
        "image/jpeg",
        "image/png",
      ],
    },

    fileSize: {
      type: Number,
      required: true,
      min: 1,
      max: 5 * 1024 * 1024,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    verificationStatus: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },

    verificationRemarks: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

documentSchema.index({
  lead: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "Document",
  documentSchema
);
