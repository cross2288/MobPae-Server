const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const { users, advanceRequests } = require("../store/memoryStore");
const { getCurrentUser, requireRole } = require("../middleware/auth");

router.post(
  "/request-advance",
  getCurrentUser,
  requireRole("employee"),
  (req, res) => {
    const { amount, reason, repayment_date } = req.body;

    if (!amount) {
      return res.status(400).json({ detail: "Amount is required" });
    }

    const user = users.find((u) => u.id === req.currentUser.id);

    if (!user) {
      return res.status(404).json({ detail: "User not found" });
    }

    const monthlySalary = Number(user.monthly_salary || 0);
    const advanceLimitPct = Number(user.advance_limit_percentage || 30);
    const maxAdvance = (monthlySalary * advanceLimitPct) / 100;
    const requestedAmount = Number(amount);

    if (requestedAmount <= 0) {
      return res.status(400).json({ detail: "Amount must be greater than 0" });
    }

    if (requestedAmount > maxAdvance) {
      return res.status(400).json({
        detail: `Amount exceeds limit of ₹${maxAdvance}`,
      });
    }

    const pending = advanceRequests.find(
      (r) => r.employee_email === user.email && r.status === "pending"
    );

    if (pending) {
      return res.status(400).json({
        detail: "You already have a pending request",
      });
    }

    const newRequest = {
      request_id: uuidv4(),
      employee_id: user.id,
      employee_email: user.email,
      employee_name: user.name,
      employer_id: user.company_id,
      amount: requestedAmount,
      reason: reason || null,
      repayment_date: repayment_date || null,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    advanceRequests.push(newRequest);

    res.json({
      message: "Advance request submitted successfully",
      request_id: newRequest.request_id,
      request: newRequest,
    });
  }
);

router.get(
  "/my-requests",
  getCurrentUser,
  requireRole("employee"),
  (req, res) => {
    const user = users.find((u) => u.id === req.currentUser.id);

    const list = advanceRequests.filter((r) => r.employee_email === user.email);

    res.json(list);
  }
);

router.get(
  "/dashboard-stats",
  getCurrentUser,
  requireRole("employee"),
  (req, res) => {
    const user = users.find((u) => u.id === req.currentUser.id);

    if (!user) {
      return res.status(404).json({ detail: "User not found" });
    }

    const monthlySalary = Number(user.monthly_salary || 0);
    const advanceLimitPct = Number(user.advance_limit_percentage || 30);
    const maxAdvance = (monthlySalary * advanceLimitPct) / 100;

    const approved = advanceRequests.filter(
      (r) => r.employee_email === user.email && r.status === "approved"
    );

    const pending = advanceRequests.filter(
      (r) => r.employee_email === user.email && r.status === "pending"
    );

    const rejected = advanceRequests.filter(
      (r) => r.employee_email === user.email && r.status === "rejected"
    );

    const totalUsed = approved.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    const availableAdvance = Math.max(maxAdvance - totalUsed, 0);

    res.json({
      monthly_salary: monthlySalary,
      advance_limit_percentage: advanceLimitPct,
      max_advance: maxAdvance,
      total_used: totalUsed,
      available_advance: availableAdvance,
      usage_percentage: maxAdvance > 0 ? (totalUsed / maxAdvance) * 100 : 0,
      pending_requests: pending.length,
      approved_requests: approved.length,
      rejected_requests: rejected.length,
    });
  }
);

module.exports = router;
