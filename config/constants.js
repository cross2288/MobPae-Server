const PORT = process.env.PORT || 8001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_ALGORITHM = "HS256";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

module.exports = {
  PORT,
  JWT_SECRET,
  JWT_ALGORITHM,
  FRONTEND_URL,
};
