# Back-end Server for Mob Pae

This backend is built using Node.js and Express.
It handles:

- Login/logout
- JWT authentication
- Role-based access
- Employer enquiries
- Admin employer approval
- Employer employee management
- Employee salary advance requests

---

## Backend Folder Structure

```txt
backend/
├── server.js
├── data/
│   └── users.json
├── config/
│   └── constants.js
├── store/
│   └── memoryStore.js
├── utils/
│   └── token.js
├── middleware/
│   └── auth.js
└── routes/
    ├── auth.routes.js
    ├── enquiry.routes.js
    ├── admin.routes.js
    ├── employer.routes.js
    └── employee.routes.js

⸻

1. server.js

This is the main backend entry file.

It does these things:

1. Loads environment variables
2. Creates Express app
3. Enables CORS
4. Enables JSON body parsing
5. Enables cookie parsing
6. Registers all route files
7. Starts backend server

Important code:

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

These imports are used for:

* dotenv → reads .env
* express → creates backend API server
* cors → allows frontend to call backend
* cookieParser → reads cookies from browser

⸻

Route Registration

app.use("/api/auth", authRoutes);
app.use("/api/enquiry", enquiryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/employer", employerRoutes);
app.use("/api/employee", employeeRoutes);

This means:

auth.routes.js      → /api/auth/...
enquiry.routes.js   → /api/enquiry/...
admin.routes.js     → /api/admin/...
employer.routes.js  → /api/employer/...
employee.routes.js  → /api/employee/...

Example:

router.post("/login")

inside auth.routes.js becomes:

POST /api/auth/login

⸻

Server Start

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Mob Pae backend running on port ${PORT}`);
});

This starts backend on:

http://localhost:8001

⸻

2. config/constants.js

This file stores backend constants.

const PORT = process.env.PORT || 8001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_ALGORITHM = "HS256";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

Used for:

* Backend port
* JWT secret
* JWT algorithm
* Frontend URL for CORS

Exported using:

module.exports = {
  PORT,
  JWT_SECRET,
  JWT_ALGORITHM,
  FRONTEND_URL,
};

Other files import these values instead of hardcoding.

⸻

3. data/users.json

This file stores demo users.

Example:

{
  "users": [
    {
      "id": "1",
      "email": "admin@mobpae.com",
      "password": "admin123",
      "name": "Admin",
      "role": "admin",
      "status": "active"
    }
  ]
}

Currently passwords are plain text for MVP.

Later this should be replaced with:

* Database
* Hashed passwords
* Proper user creation flow

⸻

4. store/memoryStore.js

This file loads and stores temporary backend data.

const USERS_FILE = path.join(__dirname, "..", "data", "users.json");

This points to:

backend/data/users.json

⸻

loadUsers()

function loadUsers() {
  const raw = fs.readFileSync(USERS_FILE, "utf-8");
  return JSON.parse(raw).users;
}

This reads users.json and returns users array.

⸻

In-memory arrays

const users = loadUsers();
const enquiries = [];
const advanceRequests = [];

Meaning:

* users comes from users.json
* enquiries stores employer enquiry data temporarily
* advanceRequests stores salary advance requests temporarily

Important:

enquiries and advanceRequests are lost when server restarts.

⸻

5. utils/token.js

This file handles JWT token creation and cookie setting.

⸻

createAccessToken()

function createAccessToken(userId, email) {
  return jwt.sign({ sub: userId, email, type: "access" }, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: "15m",
  });
}

Creates short-lived access token.

Payload contains:

{
  sub: userId,
  email,
  type: "access"
}

Expiry:

15 minutes

⸻

createRefreshToken()

function createRefreshToken(userId) {
  return jwt.sign({ sub: userId, type: "refresh" }, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: "7d",
  });
}

Creates long-lived refresh token.

Expiry:

7 days

⸻

setAuthCookies()

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

This sends cookies to browser.

Important:

* httpOnly: true means frontend JS cannot read cookie
* Browser automatically sends cookie in future API calls
* secure: false is okay for localhost
* In production, secure should be true

⸻

6. middleware/auth.js

This file protects APIs.

It exports:

getCurrentUser
requireRole
publicUser

⸻

publicUser()

function publicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

Removes password before sending user data to frontend.

⸻

getCurrentUser()

- This middleware checks if user is logged in.
- It first reads token from cookie:
- let token = req.cookies.access_token;
- If cookie is not present, it checks Authorization header:
- Authorization: Bearer token

- Then verifies JWT:

const payload = jwt.verify(token, JWT_SECRET, {
  algorithms: [JWT_ALGORITHM],
});

- Then finds user:

const user = users.find((u) => u.id === payload.sub);

Then attaches user to request:

req.currentUser = publicUser(user);

After this, route can access:

req.currentUser

⸻

requireRole()

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.currentUser.role)) {
      return res.status(403).json({
        detail: `${roles.join("/")} access required`,
      });
    }
    next();
  };
}

This checks if logged-in user has correct role.

Example:

requireRole("admin")

Only admin can access.

⸻

7. routes/auth.routes.js

Base path:

/api/auth

⸻

POST /api/auth/login

Used for login.

Frontend sends:

{
  "email": "admin@mobpae.com",
  "password": "admin123"
}

Backend does:

1. Reads email/password from body
2. Finds user from users
3. Checks password
4. Creates access token
5. Creates refresh token
6. Sends cookies
7. Returns user details

Important code:

const user = users.find((u) => u.email.toLowerCase() === emailLower);

If invalid:

return res.status(401).json({ detail: "Invalid email or password" });

If valid:

setAuthCookies(
  res,
  createAccessToken(user.id, emailLower),
  createRefreshToken(user.id)
);

⸻

GET /api/auth/me

Used to get currently logged-in user.

Protected by:

getCurrentUser

Returns:

res.json(req.currentUser);

Frontend uses this to redirect user by role.

⸻

POST /api/auth/logout

Protected by:

getCurrentUser

Clears cookies:

res.clearCookie("access_token", { path: "/" });
res.clearCookie("refresh_token", { path: "/" });

⸻

8. routes/enquiry.routes.js

Base path:

/api/enquiry

⸻

POST /api/enquiry/submit

Used when employer submits enquiry form.

Backend creates:

const enquiry = {
  id: uuidv4(),
  ...req.body,
  status: "pending",
  created_at: new Date().toISOString(),
};

Then stores in:

enquiries.push(enquiry);

Response:

{
  "message": "Enquiry submitted successfully",
  "enquiry_id": "generated-id"
}

⸻

9. routes/admin.routes.js

Base path:

/api/admin

All routes are protected by:

getCurrentUser
requireRole("admin")

⸻

GET /api/admin/enquiries

Returns all enquiries:

res.json(enquiries);

⸻

POST /api/admin/approve-employer

Approves employer enquiry and creates employer account.

Request:

{
  "enquiry_id": "enquiry-id",
  "employer_email": "employer@mobpae.com",
  "employer_password": "employer123"
}

Backend:

1. Finds enquiry
2. Checks employer email duplicate
3. Creates employer user
4. Pushes employer into users array
5. Marks enquiry approved

Important:

users.push(newEmployer);
enquiry.status = "approved";

⸻

POST /api/admin/reject-employer

Rejects enquiry.

Updates:

enquiry.status = "rejected";
enquiry.rejection_reason = rejection_reason || null;

⸻

GET /api/admin/users

Returns all users without passwords:

res.json(users.map(publicUser));

⸻

GET /api/admin/advance-requests

Returns all advance requests:

res.json(advanceRequests);

⸻

GET /api/admin/dashboard-stats

Calculates dashboard stats:

const employers = users.filter((u) => u.role === "employer");
const employees = users.filter((u) => u.role === "employee");

Returns counts and approved amount.

⸻

10. routes/employer.routes.js

Base path:

/api/employer

All routes are protected by:

getCurrentUser
requireRole("employer")

⸻

POST /api/employer/add-employee

Employer adds employee.

Request:

{
  "name": "Amit Das",
  "email": "amit@company.com",
  "phone_number": "9999999999",
  "monthly_salary": 30000,
  "advance_limit_percentage": 30,
  "department": "Operations"
}

Backend creates employee:

const newEmployee = {
  id: uuidv4(),
  email: emailLower,
  password: "employee123",
  name,
  role: "employee",
  company_id: req.currentUser.id,
  monthly_salary: Number(monthly_salary),
  advance_limit_percentage: Number(advance_limit_percentage) || 30,
  department,
  status: "active",
};

Then:

users.push(newEmployee);

⸻

GET /api/employer/employees

Returns employees of logged-in employer.

Filtering:

u.role === "employee" && u.company_id === req.currentUser.id

⸻

GET /api/employer/advance-requests

Returns requests belonging to employer.

Filtering:

r.employer_id === req.currentUser.id

⸻

POST /api/employer/handle-request

Employer approves/rejects employee request.

Request:

{
  "request_id": "request-id",
  "action": "approve"
}

or

{
  "request_id": "request-id",
  "action": "reject",
  "rejection_reason": "Not eligible"
}

Backend updates:

request.status = action === "approve" ? "approved" : "rejected";
request.updated_at = new Date().toISOString();

⸻

GET /api/employer/dashboard-stats

Returns:

* Total employees
* Active employees
* Pending requests
* Approved requests
* Rejected requests
* Total approved amount

⸻

11. routes/employee.routes.js

Base path:

/api/employee

All routes are protected by:

getCurrentUser
requireRole("employee")

⸻

POST /api/employee/request-advance

Employee requests salary advance.

Request:

{
  "amount": 5000,
  "reason": "Emergency expense",
  "repayment_date": "2026-06-05"
}

Backend calculates max advance:

const maxAdvance = (monthlySalary * advanceLimitPct) / 100;

Example:

Monthly salary = 30000
Limit percentage = 30
Max advance = 9000

Validation:

if (requestedAmount > maxAdvance) {
  return res.status(400).json({
    detail: `Amount exceeds limit of ₹${maxAdvance}`,
  });
}

Checks existing pending request:

const pending = advanceRequests.find(
  (r) => r.employee_email === user.email && r.status === "pending"
);

If valid, creates request:

const newRequest = {
  request_id: uuidv4(),
  employee_id: user.id,
  employee_email: user.email,
  employee_name: user.name,
  employer_id: user.company_id,
  amount: requestedAmount,
  reason,
  repayment_date,
  status: "pending",
  created_at: new Date().toISOString(),
};

Then:

advanceRequests.push(newRequest);

⸻

GET /api/employee/my-requests

Returns logged-in employee requests.

Filtering:

r.employee_email === user.email

⸻

GET /api/employee/dashboard-stats

Calculates:

const maxAdvance = (monthlySalary * advanceLimitPct) / 100;
const totalUsed = approved.reduce((sum, r) => sum + Number(r.amount || 0), 0);
const availableAdvance = Math.max(maxAdvance - totalUsed, 0);

Returns:

* Monthly salary
* Advance limit percentage
* Max advance
* Total used
* Available advance
* Usage percentage
* Request counts

⸻

12. Complete Backend Flow

Login Flow

POST /api/auth/login
        ↓
Check users.json loaded users
        ↓
Create JWT access token
        ↓
Create JWT refresh token
        ↓
Set cookies
        ↓
Return user details

⸻

Protected API Flow

Frontend calls protected API
        ↓
Browser sends access_token cookie
        ↓
getCurrentUser verifies JWT
        ↓
User attached to req.currentUser
        ↓
requireRole checks role
        ↓
Route logic executes

⸻

Employer Enquiry Flow

POST /api/enquiry/submit
        ↓
Create enquiry object
        ↓
Store in enquiries[]
        ↓
Admin can view using /api/admin/enquiries

⸻

Employee Request Flow

Employee calls /api/employee/request-advance
        ↓
Backend checks salary and limit
        ↓
Creates pending request
        ↓
Employer sees it in /api/employer/advance-requests
        ↓
Employer approves/rejects using /api/employer/handle-request

⸻

13. Important MVP Limitations

Current backend is MVP only.

Limitations:

* Passwords are plain text
* Users are loaded from JSON
* Enquiries are in memory
* Advance requests are in memory
* Data is lost on restart
* No MongoDB/PostgreSQL yet
* No real payment/disbursement
* No NBFC integration
* No production-level security

Before production:

* Use bcrypt for passwords
* Use MongoDB/PostgreSQL
* Add validations
* Add logging
* Add refresh-token endpoint
* Use HTTPS
* Set secure cookies
* Add rate limiting

```
