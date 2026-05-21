require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 8001;

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_ALGORITHM = "HS256";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// ===================
// File-based data
// ===================
const USERS_FILE = path.join(__dirname, "data", "users.json");

function loadUsers() {
  const raw = fs.readFileSync(USERS_FILE, "utf-8");
  return JSON.parse(raw).users;
}

// In-memory data (lost on restart — switch to MongoDB later)
const users = loadUsers();
const enquiries = [];
const advanceRequests = [];

// ===================
// Middleware
// ===================
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:3000",
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
// ===================
// Helpers
// ===================
function createAccessToken(userId, email) {
  return jwt.sign({ sub: userId, email, type: "access" }, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: "15m",
  });
}

function createRefreshToken(userId) {
  return jwt.sign({ sub: userId, type: "refresh" }, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: "7d",
  });
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
    path: "/",
  });
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function publicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

function getCurrentUser(req, res, next) {
  let token = req.cookies.access_token;
  if (!token) {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) token = authHeader.substring(7);
  }
  if (!token) return res.status(401).json({ detail: "Not authenticated" });
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });
    if (payload.type !== "access")
      return res.status(401).json({ detail: "Invalid token type" });
    const user = users.find((u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ detail: "User not found" });
    req.currentUser = publicUser(user);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError")
      return res.status(401).json({ detail: "Token expired" });
    return res.status(401).json({ detail: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.currentUser.role)) {
      return res
        .status(403)
        .json({ detail: `${roles.join("/")} access required` });
    }
    next();
  };
}

// ===================
// AUTH ROUTES
// ===================
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ detail: "Email and password required" });
  const emailLower = email.toLowerCase();
  const user = users.find((u) => u.email.toLowerCase() === emailLower);
  if (!user || user.password !== password) {
    return res.status(401).json({ detail: "Invalid email or password" });
  }
  setAuthCookies(
    res,
    createAccessToken(user.id, emailLower),
    createRefreshToken(user.id)
  );
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    company_id: user.company_id || null,
    status: user.status || "active",
  });
});

app.post("/api/auth/logout", getCurrentUser, (req, res) => {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
  res.json({ message: "Logged out successfully" });
});

app.get("/api/auth/me", getCurrentUser, (req, res) => {
  res.json(req.currentUser);
});

// ===================
// ENQUIRY
// ===================
app.post("/api/enquiry/submit", (req, res) => {
  const enquiry = {
    id: uuidv4(),
    ...req.body,
    status: "pending",
    created_at: new Date().toISOString(),
  };
  enquiries.push(enquiry);
  res.json({
    message: "Enquiry submitted successfully",
    enquiry_id: enquiry.id,
  });
});

// ===================
// ADMIN
// ===================
app.get(
  "/api/admin/enquiries",
  getCurrentUser,
  requireRole("admin"),
  (req, res) => {
    res.json(enquiries);
  }
);

app.post(
  "/api/admin/approve-employer",
  getCurrentUser,
  requireRole("admin"),
  (req, res) => {
    const { enquiry_id, employer_email, employer_password } = req.body;
    const enquiry = enquiries.find((e) => e.work_email === enquiry_id);
    if (!enquiry) return res.status(404).json({ detail: "Enquiry not found" });

    const newEmployer = {
      id: uuidv4(),
      email: employer_email.toLowerCase(),
      password: employer_password,
      name: enquiry.contact_person_name || "Employer",
      role: "employer",
      company_name: enquiry.company_name,
      phone_number: enquiry.phone_number,
      city: enquiry.city,
      industry: enquiry.industry,
      status: "active",
    };
    users.push(newEmployer);
    enquiry.status = "approved";
    enquiry.employer_id = newEmployer.id;

    res.json({
      message: "Employer approved and account created",
      employer_id: newEmployer.id,
    });
  }
);

app.get(
  "/api/admin/users",
  getCurrentUser,
  requireRole("admin"),
  (req, res) => {
    res.json(users.map(publicUser));
  }
);

app.get(
  "/api/admin/advance-requests",
  getCurrentUser,
  requireRole("admin"),
  (req, res) => {
    res.json(advanceRequests);
  }
);

// ===================
// EMPLOYER
// ===================
app.post(
  "/api/employer/add-employee",
  getCurrentUser,
  requireRole("employer"),
  (req, res) => {
    const {
      name,
      email,
      phone_number,
      monthly_salary,
      advance_limit_percentage,
      department,
    } = req.body;
    const emailLower = email.toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === emailLower)) {
      return res.status(400).json({ detail: "Email already exists" });
    }
    const newEmployee = {
      id: uuidv4(),
      email: emailLower,
      password: "employee123",
      name,
      role: "employee",
      company_id: req.currentUser.id,
      phone_number,
      monthly_salary: parseFloat(monthly_salary),
      advance_limit_percentage: parseFloat(advance_limit_percentage) || 30,
      department: department || null,
      status: "active",
    };
    users.push(newEmployee);
    res.json({
      message: "Employee added successfully",
      employee_id: newEmployee.id,
    });
  }
);

app.get(
  "/api/employer/employees",
  getCurrentUser,
  requireRole("employer"),
  (req, res) => {
    const list = users
      .filter(
        (u) => u.role === "employee" && u.company_id === req.currentUser.id
      )
      .map(publicUser);
    res.json(list);
  }
);

app.get(
  "/api/employer/advance-requests",
  getCurrentUser,
  requireRole("employer"),
  (req, res) => {
    const list = advanceRequests.filter(
      (r) => r.employer_id === req.currentUser.id
    );
    res.json(list);
  }
);

app.post(
  "/api/employer/handle-request",
  getCurrentUser,
  requireRole("employer"),
  (req, res) => {
    const { request_id, action, rejection_reason } = req.body;
    const r = advanceRequests.find((ar) => ar.request_id === request_id);
    if (!r) return res.status(404).json({ detail: "Request not found" });
    r.status = action === "approve" ? "approved" : "rejected";
    r.updated_at = new Date().toISOString();
    if (action === "reject" && rejection_reason)
      r.rejection_reason = rejection_reason;
    res.json({ message: `Request ${action}d successfully` });
  }
);

// ===================
// EMPLOYEE
// ===================
app.post(
  "/api/employee/request-advance",
  getCurrentUser,
  requireRole("employee"),
  (req, res) => {
    const { amount, reason, repayment_date } = req.body;
    const user = users.find((u) => u.id === req.currentUser.id);
    if (!user) return res.status(404).json({ detail: "User not found" });

    const monthlySalary = user.monthly_salary || 0;
    const advanceLimitPct = user.advance_limit_percentage || 30;
    const maxAdvance = (monthlySalary * advanceLimitPct) / 100;
    const requestedAmount = parseFloat(amount);

    if (requestedAmount > maxAdvance) {
      return res
        .status(400)
        .json({ detail: `Amount exceeds limit of ${maxAdvance}` });
    }
    const pending = advanceRequests.find(
      (r) => r.employee_email === user.email && r.status === "pending"
    );
    if (pending)
      return res
        .status(400)
        .json({ detail: "You already have a pending request" });

    const newRequest = {
      request_id: uuidv4(),
      employee_email: user.email,
      employee_name: user.name,
      employer_id: user.company_id,
      amount: requestedAmount,
      reason: reason || null,
      repayment_date,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    advanceRequests.push(newRequest);
    res.json({
      message: "Advance request submitted successfully",
      request_id: newRequest.request_id,
    });
  }
);

app.get(
  "/api/employee/my-requests",
  getCurrentUser,
  requireRole("employee"),
  (req, res) => {
    const user = users.find((u) => u.id === req.currentUser.id);
    const list = advanceRequests.filter((r) => r.employee_email === user.email);
    res.json(list);
  }
);

app.get(
  "/api/employee/dashboard-stats",
  getCurrentUser,
  requireRole("employee"),
  (req, res) => {
    const user = users.find((u) => u.id === req.currentUser.id);
    if (!user) return res.status(404).json({ detail: "User not found" });

    const monthlySalary = user.monthly_salary || 0;
    const advanceLimitPct = user.advance_limit_percentage || 30;
    const maxAdvance = (monthlySalary * advanceLimitPct) / 100;
    const approved = advanceRequests.filter(
      (r) => r.employee_email === user.email && r.status === "approved"
    );
    const totalUsed = approved.reduce((sum, r) => sum + (r.amount || 0), 0);

    res.json({
      monthly_salary: monthlySalary,
      available_advance: maxAdvance - totalUsed,
      max_advance: maxAdvance,
      total_used: totalUsed,
      usage_percentage: maxAdvance > 0 ? (totalUsed / maxAdvance) * 100 : 0,
    });
  }
);

// Health check
app.get("/api/", (req, res) => {
  res.json({ message: "Mob Pae API is running", users_loaded: users.length });
});

// ===================
// START
// ===================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Mob Pae backend running on port ${PORT}`);
  console.log(`Loaded ${users.length} users from ${USERS_FILE}`);
  console.log("Available accounts:");
  users.forEach((u) => console.log(`  [${u.role}] ${u.email} / ${u.password}`));
});
