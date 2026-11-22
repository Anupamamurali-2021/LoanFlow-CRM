
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dns = require("node:dns");
const readline = require("node:readline");
const User = require("../models/User");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question) =>
  new Promise((resolve) => {
    rl.question(question, resolve);
  });

async function resetEmployeePassword() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing.");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully!");

    const email = (
      await ask("Enter employee email: ")
    )
      .trim()
      .toLowerCase();

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      console.log("Invalid email address.");
      return;
    }

    const employee = await User.findOne({
      email,
      role: "staff",
    });

    if (!employee) {
      console.log("Staff employee not found.");
      return;
    }

    console.log(`Employee found: ${employee.name}`);

    const password = await ask(
      "Enter new password (8-72 characters): "
    );

    if (
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      console.log(
        "Password must be at least 8 characters and no more than 72 bytes."
      );
      return;
    }

    const confirmation = await ask(
      "Type RESET to confirm: "
    );

    if (confirmation !== "RESET") {
      console.log("Password reset cancelled.");
      return;
    }

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    employee.password = hashedPassword;

    await employee.save();

    console.log(
      "Employee password reset successfully!"
    );
  } catch (error) {
    console.error(
      "Password reset failed:",
      error.message
    );
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

resetEmployeePassword();
