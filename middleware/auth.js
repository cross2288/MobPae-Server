const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_ALGORITHM } = require("../config/constants");
const { users } = require("../store/memoryStore");

function publicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

function getCurrentUser(req, res, next) {
  let token = req.cookies.access_token;

  if (!token) {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({ detail: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });

    if (payload.type !== "access") {
      return res.status(401).json({ detail: "Invalid token type" });
    }

    const user = users.find((u) => u.id === payload.sub);

    if (!user) {
      return res.status(401).json({ detail: "User not found" });
    }

    req.currentUser = publicUser(user);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ detail: "Token expired" });
    }

    return res.status(401).json({ detail: "Invalid token" });
  }
}

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

module.exports = {
  getCurrentUser,
  requireRole,
  publicUser,
};
