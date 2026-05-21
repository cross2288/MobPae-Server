const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const { users, enquiries, advanceRequests } = require("../store/memoryStore");
const {
  getCurrentUser,
  requireRole,
  publicUser,
} = require("../middleware/auth");

router.get("/enquiries", getCurrentUser, requireRole("admin"), (req, res) => {
  res.json(enquiries);
});

router.post(
  "/approve-employer",
  getCurrentUser,
  requireRole("admin"),
  (req, res) => {
    const { enquiry_id, employer_email, employer_password } = req.body;

    const enquiry = enquiries.find((e) => e.id === enquiry_id);

    if (!enquiry) {
      return res.status(404).json({ detail: "Enquiry not found" });
    }

    const emailLower = employer_email.toLowerCase();

    if (users.some((u) => u.email.toLowerCase() === emailLower)) {
      return res.status(400).json({ detail: "Employer email already exists" });
    }

    const newEmployer = {
      id: uuidv4(),
      email: emailLower,
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
    enquiry.approved_at = new Date().toISOString();

    res.json({
      message: "Employer approved and account created",
      employer_id: newEmployer.id,
    });
  }
);

router.post(
  "/reject-employer",
  getCurrentUser,
  requireRole("admin"),
  (req, res) => {
    const { enquiry_id, rejection_reason } = req.body;

    const enquiry = enquiries.find((e) => e.id === enquiry_id);

    if (!enquiry) {
      return res.status(404).json({ detail: "Enquiry not found" });
    }

    enquiry.status = "rejected";
    enquiry.rejection_reason = rejection_reason || null;
    enquiry.rejected_at = new Date().toISOString();

    res.json({
      message: "Employer enquiry rejected",
      enquiry_id: enquiry.id,
    });
  }
);

router.get("/users", getCurrentUser, requireRole("admin"), (req, res) => {
  res.json(users.map(publicUser));
});

router.get(
  "/advance-requests",
  getCurrentUser,
  requireRole("admin"),
  (req, res) => {
    res.json(advanceRequests);
  }
);

router.get(
  "/dashboard-stats",
  getCurrentUser,
  requireRole("admin"),
  (req, res) => {
    const employers = users.filter((u) => u.role === "employer");
    const employees = users.filter((u) => u.role === "employee");

    const pendingRequests = advanceRequests.filter(
      (r) => r.status === "pending"
    );
    const approvedRequests = advanceRequests.filter(
      (r) => r.status === "approved"
    );
    const rejectedRequests = advanceRequests.filter(
      (r) => r.status === "rejected"
    );

    const totalApprovedAmount = approvedRequests.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    res.json({
      total_users: users.length,
      total_employers: employers.length,
      total_employees: employees.length,
      total_enquiries: enquiries.length,
      pending_enquiries: enquiries.filter((e) => e.status === "pending").length,
      pending_requests: pendingRequests.length,
      approved_requests: approvedRequests.length,
      rejected_requests: rejectedRequests.length,
      total_approved_amount: totalApprovedAmount,
    });
  }
);

module.exports = router;
