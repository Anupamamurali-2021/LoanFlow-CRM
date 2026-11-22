
const { protect, authorize } = require("./middleware/authMiddleware");

require("dotenv").config();

const mongoose = require("mongoose");



const express = require("express");
const cors = require("cors");

const User = require("./models/User");

const authRoutes = require("./routes/authRoutes");
const leadRoutes = require("./routes/leadRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const documentRoutes = require("./routes/documentRoutes");
const bankRoutes = require("./routes/bankRoutes");
const loanSchemeRoutes = require("./routes/loanSchemeRoutes");
const loanApplicationRoutes = require("./routes/loanApplicationRoutes");

// Reports & Analytics routes
const reportRoutes = require("./routes/reportRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Allow requests from React frontend

// Allow requests from local and deployed frontend
const allowedOrigins = [
  "http://localhost:5173",
  "https://loan-flow-crm.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  })
);


// Read JSON request bodies
app.use(express.json());

// Authentication routes
app.use("/api/auth", authRoutes);

// Lead management routes
app.use("/api/leads", leadRoutes);

// Employee management routes
app.use("/api/employees", employeeRoutes);

// Document upload and verification routes
app.use("/api/documents", documentRoutes);

// Bank management routes
app.use("/api/banks", bankRoutes);

// Loan scheme management routes
app.use("/api/loan-schemes", loanSchemeRoutes);

// Loan application and approval management routes
app.use("/api/loan-applications", loanApplicationRoutes);

// Reports & Analytics routes - Admin only
app.use("/api/reports", reportRoutes);

// --------------------------------------------------
// ADMIN DASHBOARD
// GET /api/admin/dashboard
// --------------------------------------------------

app.get(
  "/api/admin/dashboard",
  protect,
  authorize("admin"),
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome to the Admin Dashboard",
      admin: {
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  }
);

// --------------------------------------------------
// GET ACTIVE EMPLOYEES
// GET /api/admin/employees
// ADMIN ONLY
// --------------------------------------------------

app.get(
  "/api/admin/employees",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const employees = await User.find({
        role: "staff",
        isActive: true,
      })
        .select("name email role isActive")
        .sort({ name: 1 });

      return res.json({
        success: true,
        count: employees.length,
        employees,
      });
    } catch (error) {
      console.error(
        "Fetch employees error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Unable to fetch employees.",
      });
    }
  }
);

// --------------------------------------------------
// BACKEND HEALTH CHECK
// GET /
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "LoanFlow CRM Backend is running!",
  });
});

// --------------------------------------------------
// UNKNOWN ROUTES
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// --------------------------------------------------
// CONNECT TO MONGODB
// --------------------------------------------------

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");
  })
  .catch((error) => {
    console.error(
      "MongoDB connection failed:",
      error.message
    );
  });

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `LoanFlow CRM backend running on port ${PORT}`
  );
});
