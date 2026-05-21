const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const { users, advanceRequests } = require("../store/memoryStore");
const {
  getCurrentUser,
  requireRole,
  publicUser,
} = require("../middleware/auth");

router.post(
  "/add-employee",
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

    if (!name || !email || !monthly_salary) {
      return res.status(400).json({
        detail: "Name, email and monthly salary are required",
      });
    }

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
      employer_name: req.currentUser.name,
      phone_number: phone_number || null,
      monthly_salary: Number(monthly_salary),
      advance_limit_percentage: Number(advance_limit_percentage) || 30,
      department: department || null,
      status: "active",
      created_at: new Date().toISOString(),
    };

    users.push(newEmployee);

    res.json({
      message: "Employee added successfully",
      employee_id: newEmployee.id,
      default_password: "employee123",
    });
  }
);

router.get(
  "/employees",
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

router.get(
  "/advance-requests",
  getCurrentUser,
  requireRole("employer"),
  (req, res) => {
    const list = advanceRequests.filter(
      (r) => r.employer_id === req.currentUser.id
    );

    res.json(list);
  }
);

router.post(
  "/handle-request",
  getCurrentUser,
  requireRole("employer"),
  (req, res) => {
    const { request_id, action, rejection_reason } = req.body;

    if (!request_id || !action) {
      return res.status(400).json({
        detail: "request_id and action are required",
      });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        detail: "Action must be approve or reject",
      });
    }

    const request = advanceRequests.find(
      (ar) =>
        ar.request_id === request_id && ar.employer_id === req.currentUser.id
    );

    if (!request) {
      return res.status(404).json({ detail: "Request not found" });
    }

    request.status = action === "approve" ? "approved" : "rejected";
    request.updated_at = new Date().toISOString();
    request.reviewed_by = req.currentUser.id;

    if (action === "reject") {
      request.rejection_reason = rejection_reason || "Rejected by employer";
    }

    res.json({
      message: `Request ${action}d successfully`,
      request,
    });
  }
);

router.get(
  "/dashboard-stats",
  getCurrentUser,
  requireRole("employer"),
  (req, res) => {
    const employees = users.filter(
      (u) => u.role === "employee" && u.company_id === req.currentUser.id
    );

    const requests = advanceRequests.filter(
      (r) => r.employer_id === req.currentUser.id
    );

    const pending = requests.filter((r) => r.status === "pending");
    const approved = requests.filter((r) => r.status === "approved");
    const rejected = requests.filter((r) => r.status === "rejected");

    const totalApprovedAmount = approved.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    res.json({
      total_employees: employees.length,
      active_employees: employees.filter((e) => e.status === "active").length,
      pending_requests: pending.length,
      approved_requests: approved.length,
      rejected_requests: rejected.length,
      total_approved_amount: totalApprovedAmount,
    });
  }
);

module.exports = router;
