const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "..", "data", "users.json");

function loadUsers() {
  const raw = fs.readFileSync(USERS_FILE, "utf-8");
  return JSON.parse(raw).users;
}

const users = loadUsers();
const enquiries = [];
const advanceRequests = [];

module.exports = {
  users,
  enquiries,
  advanceRequests,
  USERS_FILE,
};
