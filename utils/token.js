const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_ALGORITHM } = require("../config/constants");

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

module.exports = {
  createAccessToken,
  createRefreshToken,
  setAuthCookies,
};
