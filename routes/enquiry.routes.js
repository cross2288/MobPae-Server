const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const { enquiries } = require("../store/memoryStore");

router.post("/submit", (req, res) => {
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

module.exports = router;
