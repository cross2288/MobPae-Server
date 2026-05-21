require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { PORT, FRONTEND_URL } = require("./config/constants");
const { users, USERS_FILE } = require("./store/memoryStore");

const authRoutes = require("./routes/auth.routes");
const enquiryRoutes = require("./routes/enquiry.routes");
const adminRoutes = require("./routes/admin.routes");
const employerRoutes = require("./routes/employer.routes");
const employeeRoutes = require("./routes/employee.routes");

const app = express();

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options(
  "*",
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/enquiry", enquiryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/employer", employerRoutes);
app.use("/api/employee", employeeRoutes);

app.get("/api/", (req, res) => {
  res.json({
    message: "Mob Pae API is running",
    users_loaded: users.length,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Mob Pae backend running on port ${PORT}`);
  console.log(`Loaded ${users.length} users from ${USERS_FILE}`);
  console.log("Available accounts:");
  users.forEach((u) => console.log(`  [${u.role}] ${u.email} / ${u.password}`));
});
