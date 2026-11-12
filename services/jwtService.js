require("../config/env");
const jwt = require("jsonwebtoken");

function getJwtSecret() {
  return process.env.JWT_SECRET;
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || "30d";
}

function generateJwt(payload) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(payload, secret, {
    expiresIn: getJwtExpiresIn(),
    issuer: "hawkn-cm",
  });
}

function verifyJwt(token) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  try {
    return jwt.verify(token, secret, {
      issuer: "hawkn-cm",
    });
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateJwt,
  verifyJwt,
};
