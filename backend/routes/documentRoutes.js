
const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const Document = require("../models/Document");
const Lead = require("../models/Lead");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const {
  upload,
  uploadDirectory,
} = require("../middleware/uploadMiddleware");

const router = express.Router();

const documentTypes = [
  "Aadhaar Card",
  "PAN Card",
  "Bank Statement",
  "Salary Slip",
  "Address Proof",
  "Other",
];

const verificationStatuses = [
  "Verified",
  "Rejected",
];

const deleteUploadedFile = async (file) => {
  if (!file?.path) return;

  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    console.error(
      "Unable to delete temporary upload:",
      error.message
    );
  }
};

// Check the actual file signature, not just its extension.
const hasValidFileSignature = async (file) => {
  const handle = await fs.promises.open(file.path, "r");

  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(
      buffer,
      0,
      buffer.length,
      0
    );

    const bytes = buffer.subarray(0, bytesRead);

    if (file.mimetype === "application/pdf") {
      return bytes.subarray(0, 5).toString() === "%PDF-";
    }

    if (file.mimetype === "image/jpeg") {
      return (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      );
    }

    if (file.mimetype === "image/png") {
      return (
        bytes.length >= 8 &&
        bytes.subarray(0, 8).equals(
          Buffer.from([
            137, 80, 78, 71,
            13, 10, 26, 10,
          ])
        )
      );
    }

    return false;
  } finally {
    await handle.close();
  }
};

// All document routes require login.
router.use(protect);

// STAFF: Upload a document for an assigned lead.
router.post(
  "/upload",
  authorize("staff"),
  (req, res, next) => {
    upload.single("file")(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next();
    });
  },
  async (req, res) => {
    try {
      const { leadId, documentType } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a document to upload.",
        });
      }

      if (!mongoose.isValidObjectId(leadId)) {
        await deleteUploadedFile(req.file);

        return res.status(400).json({
          success: false,
          message: "Invalid customer lead.",
        });
      }

      if (!documentTypes.includes(documentType)) {
        await deleteUploadedFile(req.file);

        return res.status(400).json({
          success: false,
          message: "Please select a valid document type.",
        });
      }

      const lead = await Lead.findOne({
        _id: leadId,
        assignedTo: req.user._id,
      });

      if (!lead) {
        await deleteUploadedFile(req.file);

        return res.status(403).json({
          success: false,
          message:
            "You can upload documents only for your assigned leads.",
        });
      }

      const validSignature = await hasValidFileSignature(
        req.file
      );

      if (!validSignature) {
        await deleteUploadedFile(req.file);

        return res.status(400).json({
          success: false,
          message:
            "Invalid file contents. Upload a valid PDF, JPG, or PNG.",
        });
      }

      const document = await Document.create({
        lead: lead._id,
        documentType,
        originalName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy: req.user._id,
      });

      return res.status(201).json({
        success: true,
        message: "Document uploaded successfully.",
        document,
      });
    } catch (error) {
      await deleteUploadedFile(req.file);

      console.error(
        "Document upload error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Unable to upload document.",
      });
    }
  }
);

// STAFF: View document details for assigned leads.
router.get(
  "/my-documents",
  authorize("staff"),
  async (req, res) => {
    try {
      const assignedLeads = await Lead.find({
        assignedTo: req.user._id,
      }).select("_id");

      const leadIds = assignedLeads.map(
        (lead) => lead._id
      );

      const documents = await Document.find({
        lead: { $in: leadIds },
      })
        .select("-filePath -fileName")
        .populate("lead", "name phone")
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        documents,
      });
    } catch (error) {
      console.error(
        "Staff document list error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Unable to load documents.",
      });
    }
  }
);

// ADMIN: View all uploaded documents.
router.get(
  "/",
  authorize("admin"),
  async (req, res) => {
    try {
      const documents = await Document.find()
        .select("-filePath -fileName")
        .populate("lead", "name phone")
        .populate("uploadedBy", "name email")
        .populate("verifiedBy", "name email")
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        documents,
      });
    } catch (error) {
      console.error(
        "Admin document list error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Unable to load documents.",
      });
    }
  }
);

// ADMIN: Verify or reject a document.
router.patch(
  "/:id/verify",
  authorize("admin"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid document ID.",
        });
      }

      const { verificationStatus, verificationRemarks } =
        req.body;

      if (
        !verificationStatuses.includes(
          verificationStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be Verified or Rejected.",
        });
      }

      if (
        typeof verificationRemarks !== "undefined" &&
        typeof verificationRemarks !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Verification remarks must be text.",
        });
      }

      const remarks =
        typeof verificationRemarks === "string"
          ? verificationRemarks.trim()
          : "";

      if (remarks.length > 1000) {
        return res.status(400).json({
          success: false,
          message:
            "Verification remarks cannot exceed 1000 characters.",
        });
      }

      if (
        verificationStatus === "Rejected" &&
        remarks.length < 2
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide a reason for rejection.",
        });
      }

      const document = await Document.findByIdAndUpdate(
        req.params.id,
        {
          verificationStatus,
          verificationRemarks: remarks,
          verifiedBy: req.user._id,
          verifiedAt: new Date(),
        },
        {
          new: true,
          runValidators: true,
        }
      )
        .select("-filePath -fileName")
        .populate("lead", "name phone")
        .populate("uploadedBy", "name email")
        .populate("verifiedBy", "name email");

      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found.",
        });
      }

      return res.json({
        success: true,
        message:
          verificationStatus === "Verified"
            ? "Document verified successfully."
            : "Document rejected successfully.",
        document,
      });
    } catch (error) {
      console.error(
        "Document verification error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Unable to update verification.",
      });
    }
  }
);

// ADMIN / STAFF: Securely view an uploaded file.
router.get("/:id/file", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    const document = await Document.findById(
      req.params.id
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    if (req.user.role === "staff") {
      const assignedLead = await Lead.exists({
        _id: document.lead,
        assignedTo: req.user._id,
      });

      if (!assignedLead) {
        return res.status(403).json({
          success: false,
          message: "Access denied.",
        });
      }
    } else if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    // Never trust a database path as an arbitrary
    // filesystem location.
    const safeFileName = path.basename(
      document.fileName
    );

    const fullPath = path.join(
      uploadDirectory,
      safeFileName
    );

    await fs.promises.access(
      fullPath,
      fs.constants.R_OK
    );

    res.setHeader(
      "Content-Type",
      document.mimeType
    );

    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="document${path.extname(
        safeFileName
      )}"`
    );

    return res.sendFile(fullPath);
  } catch (error) {
    console.error(
      "Document file access error:",
      error.message
    );

    if (!res.headersSent) {
      return res.status(404).json({
        success: false,
        message: "Document file not available.",
      });
    }
  }
});

module.exports = router;
