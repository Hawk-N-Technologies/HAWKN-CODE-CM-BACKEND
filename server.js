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
require("./models/associations");
// const tempCompanyContext = require("./middlewares/tempCompanyContext");
const seed = require("./seeders/userSeeder");
const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
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
// seed();
