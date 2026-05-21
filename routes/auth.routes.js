const express = require("express");
const router = express.Router();

const { users } = require("../store/memoryStore");
const { getCurrentUser } = require("../middleware/auth");
const {
  createAccessToken,
  createRefreshToken,
  setAuthCookies,
} = require("../utils/token");

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ detail: "Email and password required" });
  }

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

router.post("/logout", getCurrentUser, (req, res) => {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });

  res.json({ message: "Logged out successfully" });
});

router.get("/me", getCurrentUser, (req, res) => {
  res.json(req.currentUser);
});

module.exports = router;
