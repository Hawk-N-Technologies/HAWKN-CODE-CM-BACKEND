const express = require("express");
const cors = require("cors");
require("dotenv").config();
const companyRoutes = require("./routes/companyRoutes");

const sequelize = require("./config/db");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Server started running......",
  });
});

app.use("/api/companies", companyRoutes);

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
