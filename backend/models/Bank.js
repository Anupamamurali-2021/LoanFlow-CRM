
const mongoose = require("mongoose");

const bankSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Bank name is required"],
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    code: {
      type: String,
      required: [true, "Bank code is required"],
      trim: true,
      uppercase: true,
      unique: true,
      minlength: 2,
      maxlength: 20,
      match: [
        /^[A-Z0-9_-]+$/,
        "Bank code must contain only letters, numbers, hyphens or underscores",
      ],
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
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

module.exports = mongoose.model("Bank", bankSchema);
