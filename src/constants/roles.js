/**
 * Role identifiers — MUST match frontend src/constants/roles.js exactly.
 * If a role is added/renamed there, change it here in the same PR.
 */
export const ROLES = Object.freeze({
  ADMIN: "admin",
  HR: "hr",
  BD: "bd",
  PROJECT_LEAD: "projectLead",
  DEVELOPER: "developer",
  TESTER: "tester",
  CLIENT: "client",
});

export const ALL_ROLES = Object.values(ROLES);
