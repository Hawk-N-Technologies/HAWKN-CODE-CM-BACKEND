const express = require("express");
const cors = require("cors");
require("dotenv").config();
const sequelize = require("./config/db");
const companyRoutes = require("./routes/companyRoutes");
const errorHandler = require("./middleware/errorHandler");
const cookieParser = require("cookie-parser");
const companyProfileRoutes = require("./routes/companyProfileRoutes");
const companyPolicyRoutes = require("./routes/companyPolicyRoutes");
const companyRolesResponsibilitiesRoutes = require("./routes/companyRolesResponsibilitiesRoutes");
const employeeHierarchyRoutes = require("./routes/employeeHierarchyRoutes");
const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const employeeOnboardingRoutes = require("./routes/employeeOnboardingRoutes");
const companyHolidayRoutes = require("./routes/companyHolidayRoutes");
const employeeLeaveRoutes = require("./routes/employeeLeaveRoutes");
const bonusRoutes = require("./routes/bonusRoutes");
const incrementRoutes = require("./routes/incrementRoutes");
const internshipProbationRoutes = require("./routes/internshipProbationRoutes");
const adminHrmsRoutes = require("./routes/adminHrmsRoutes");
const clientRoutes = require("./routes/clientRoutes");
const projectRoutes = require("./routes/projectRoutes");

require("./models/associations");
// const tempCompanyContext = require("./middlewares/tempCompanyContext");
const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://frontend-codefrontendtemp-weigty-ed3f48-194-164-148-10.sslip.io",
    ],
  }),
);

app.use(express.json());
app.use(cookieParser());
// app.use(tempCompanyContext);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Server started running......",
  });
});

app.use("/api/companies", companyRoutes);
app.use("/api/company", companyProfileRoutes);
app.use("/api/company", companyPolicyRoutes);
app.use("/api/company", companyRolesResponsibilitiesRoutes);
app.use("/api/company", employeeHierarchyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/onboarding", employeeOnboardingRoutes);
app.use("/api/company", companyHolidayRoutes);
app.use("/api/leave", employeeLeaveRoutes);
app.use("/api/bonuses", bonusRoutes);
app.use("/api/increments", incrementRoutes);
app.use("/api/internship-probation", internshipProbationRoutes);
app.use("/api/admin/hrms", adminHrmsRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/admin/projects", projectRoutes);

app.use(errorHandler);
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await sequelize.authenticate();

    console.log("✅ PostgreSQL connected successfully");
    app.listen(PORT, () => {
      console.log(`🚀 Server started on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Database connection failed:");
    console.error(error.message);

    process.exit(1);
  }
}

startServer();
