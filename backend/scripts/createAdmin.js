
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dns = require("node:dns");
const User = require("../models/User");

// Use Google DNS for MongoDB Atlas
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Set a valid ADMIN_EMAIL in .env");
    }

    if (!password || password.length < 8) {
      throw new Error("ADMIN_PASSWORD must be at least 8 characters");
    }

    const existingAdmin = await User.findOne({ email });

    if (existingAdmin) {
      console.log("An account with this email already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name: "CRM Administrator",
      email,
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin account created successfully!");
  } catch (error) {
    console.error("Admin creation failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();
