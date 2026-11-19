"use strict";

/**
 * Is a login (decoded JWT) still allowed?
 *
 * A login stops working when:
 *  - the user no longer exists, or is deactivated
 *  - HR/Admin changed the password after this login was issued
 *    (emergency reset → the old session is locked out everywhere)
 */

const User = require("../models/User");

async function isSessionValid(decoded) {
  if (!decoded?.userId || !decoded?.companyId) return false;

  const user = await User.findOne({
    where: { id: decoded.userId, companyId: decoded.companyId },
    attributes: ["id", "isActive", "passwordChangedAt"],
  });

  if (!user || !user.isActive) return false;

  if (user.passwordChangedAt) {
    // iat is in seconds; a login issued before the change is no longer valid
    const changedAtSeconds = Math.floor(
      new Date(user.passwordChangedAt).getTime() / 1000,
    );

    if (!decoded.iat || decoded.iat < changedAtSeconds) return false;
  }

  return true;
}

module.exports = { isSessionValid };
