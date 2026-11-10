const { UniqueConstraintError } = require("@sequelize/core");
const sequelize = require("../config/db");
const {
  User,
  Role,
  Employee,
  EmployeeOnboarding,
} = require("../models/associations");
const logger = require("../utils/logger");

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

// The checklist steps, in display order. key = model field, label = UI text.
// To add a step later: add a column (new migration) + one line here.
const CHECKLIST_ITEMS = [
  { key: "offerLetterSigned", label: "Offer letter signed" },
  { key: "documentsSubmitted", label: "Documents submitted" },
  { key: "documentsVerified", label: "Documents verified" },
  { key: "systemAccessGiven", label: "System access given" },
  { key: "inductionCompleted", label: "Induction completed" },
];
const CHECKLIST_KEYS = CHECKLIST_ITEMS.map((item) => item.key);

const EMPLOYMENT_TYPES = ["Full Time", "Intern", "Probation"];

// HR must not be able to create admins (privilege escalation) or clients
// (clients are not employees) through onboarding.
const NON_ONBOARDABLE_ROLES = ["admin", "client"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function httpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

function assertUuid(value) {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    throw httpError(400, "Invalid onboarding ID");
  }
}

// A real calendar date in YYYY-MM-DD form (rejects 2026-02-31)
function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

// Progress + status are CALCULATED from the checklist, never stored,
// so they can't drift out of sync with the ticked items.
function summarise(onboarding) {
  const done = CHECKLIST_KEYS.filter((key) => onboarding[key]).length;
  const total = CHECKLIST_KEYS.length;

  let status = "In Progress";
  if (done === 0) status = "Not Started";
  if (done === total) status = "Completed";

  return { done, total, progress: Math.round((done / total) * 100), status };
}

// Shape sent to the frontend — UUIDs only, never internal integer ids
function toResponse(onboarding) {
  const employee = onboarding.employee;
  const user = employee?.user;
  const { progress, status, done, total } = summarise(onboarding);

  return {
    uuid: onboarding.uuid,
    status,
    progress,
    completedSteps: done,
    totalSteps: total,
    checklist: CHECKLIST_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      done: Boolean(onboarding[item.key]),
    })),
    notes: onboarding.notes,
    completedAt: onboarding.completedAt,
    createdAt: onboarding.createdAt,
    updatedAt: onboarding.updatedAt,
    employee: employee
      ? {
          uuid: employee.uuid,
          firstName: user?.firstName ?? null,
          lastName: user?.lastName ?? null,
          email: user?.email ?? null,
          role: user?.role ? { uuid: user.role.uuid, name: user.role.name } : null,
          employmentType: employee.employmentType,
          employmentStatus: employee.employmentStatus,
          joiningDate: employee.joiningDate,
          phone1: employee.phone1,
        }
      : null,
  };
}

// Everything needed to build the response, in one query
const FULL_INCLUDE = [
  {
    model: Employee,
    as: "employee",
    include: [
      {
        model: User,
        as: "user",
        attributes: ["uuid", "firstName", "lastName", "email"],
        include: [{ model: Role, as: "role", attributes: ["uuid", "name"] }],
      },
    ],
  },
];

async function findOnboarding(uuid, companyId, options = {}) {
  assertUuid(uuid);

  const onboarding = await EmployeeOnboarding.findOne({
    where: { uuid, companyId },
    include: FULL_INCLUDE,
    ...options,
  });

  // Same 404 whether it doesn't exist or belongs to another company
  if (!onboarding) throw httpError(404, "Onboarding record not found");
  return onboarding;
}

/**
 * Validates + cleans the "Start Onboarding" form.
 * Only known fields are picked; anything extra in the body is ignored.
 * Collects ALL errors at once so the form can show them together.
 */
function validateStartInput(body = {}) {
  const errors = {};

  const firstName = trimOrNull(body.firstName);
  const lastName = trimOrNull(body.lastName);
  const email = trimOrNull(body.email)?.toLowerCase() ?? null;
  const roleUuid = trimOrNull(body.roleUuid);
  const employmentType = trimOrNull(body.employmentType) ?? "Full Time";
  const joiningDate = trimOrNull(body.joiningDate);
  const phone1 = trimOrNull(body.phone1);

  if (!firstName) errors.firstName = "First name is required";
  else if (firstName.length > 100) errors.firstName = "Max 100 characters";

  if (lastName && lastName.length > 100) errors.lastName = "Max 100 characters";

  if (!email) errors.email = "Email is required";
  else if (!EMAIL_REGEX.test(email) || email.length > 255)
    errors.email = "Enter a valid email address";

  if (!roleUuid) errors.roleUuid = "Role is required";
  else if (!UUID_REGEX.test(roleUuid)) errors.roleUuid = "Invalid role";

  if (!EMPLOYMENT_TYPES.includes(employmentType))
    errors.employmentType = `Must be one of: ${EMPLOYMENT_TYPES.join(", ")}`;

  if (!joiningDate) errors.joiningDate = "Joining date is required";
  else if (!isValidDate(joiningDate)) errors.joiningDate = "Enter a valid date";

  if (phone1 && !PHONE_REGEX.test(phone1)) errors.phone1 = "Enter a valid phone number";

  if (Object.keys(errors).length) {
    throw httpError(400, "Please fix the highlighted fields", errors);
  }

  return { firstName, lastName, email, roleUuid, employmentType, joiningDate, phone1 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Roles HR is allowed to onboard someone into (for the form's dropdown)
async function getOnboardableRoles() {
  const roles = await Role.findAll({
    where: { isActive: true },
    attributes: ["uuid", "name", "description"],
    order: [["name", "ASC"]],
  });

  return roles
    .filter((role) => !NON_ONBOARDABLE_ROLES.includes(role.name))
    .map((role) => ({ uuid: role.uuid, name: role.name, description: role.description }));
}

async function listOnboarding(companyId) {
  try {
    const records = await EmployeeOnboarding.findAll({
      where: { companyId },
      include: FULL_INCLUDE,
      order: [["createdAt", "DESC"]],
    });

    logger.info("Onboarding records fetched", { companyId, count: records.length });
    return records.map(toResponse);
  } catch (error) {
    logger.error("Failed to fetch onboarding records", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * "Start Onboarding": creates the login user, the employee record and the
 * onboarding checklist in ONE transaction — all three exist, or none do.
 * No password is set: the new joiner can't log in until one is set
 * (invite / set-password flow comes with auth).
 */
async function startOnboarding(companyId, body) {
  const input = validateStartInput(body);

  try {
    // Managed transaction (Sequelize v7): commits if the callback finishes,
    // rolls back automatically if anything inside throws.
    const onboardingUuid = await sequelize.transaction(async (transaction) => {
      const role = await Role.findOne({
        where: { uuid: input.roleUuid, isActive: true },
        transaction,
      });

      if (!role || NON_ONBOARDABLE_ROLES.includes(role.name)) {
        throw httpError(400, "Please fix the highlighted fields", {
          roleUuid: "Select a valid role",
        });
      }

      const existingUser = await User.findOne({
        where: { companyId, email: input.email },
        transaction,
      });

      if (existingUser) {
        throw httpError(409, "Please fix the highlighted fields", {
          email: "An employee with this email already exists",
        });
      }

      const user = await User.create(
        {
          companyId,
          roleId: role.id,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash: null,
        },
        { transaction },
      );

      const employee = await Employee.create(
        {
          userId: user.id,
          companyId,
          joiningDate: input.joiningDate,
          employmentType: input.employmentType,
          phone1: input.phone1,
        },
        { transaction },
      );

      const onboarding = await EmployeeOnboarding.create(
        { employeeId: employee.id, companyId },
        { transaction },
      );

      logger.info("Onboarding started", {
        companyId,
        onboardingUuid: onboarding.uuid,
        role: role.name,
      });

      return onboarding.uuid;
    });

    // Read back AFTER commit so the response has the joined user + role
    return toResponse(await findOnboarding(onboardingUuid, companyId));
  } catch (error) {
    // Two HR users submitting the same email at the same moment
    if (error instanceof UniqueConstraintError) {
      throw httpError(409, "Please fix the highlighted fields", {
        email: "An employee with this email already exists",
      });
    }

    logger.error("Failed to start onboarding", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Tick / untick one checklist step
async function updateChecklistItem(uuid, companyId, body = {}) {
  const { item, done } = body;

  if (!CHECKLIST_KEYS.includes(item)) {
    throw httpError(400, `item must be one of: ${CHECKLIST_KEYS.join(", ")}`);
  }
  if (typeof done !== "boolean") {
    throw httpError(400, "done must be true or false");
  }

  try {
    const onboarding = await findOnboarding(uuid, companyId);

    onboarding[item] = done;

    // Keep completedAt in step with the checklist
    const { status } = summarise(onboarding);
    if (status === "Completed" && !onboarding.completedAt) {
      onboarding.completedAt = new Date();
    } else if (status !== "Completed") {
      onboarding.completedAt = null;
    }

    await onboarding.save();

    logger.info("Onboarding checklist updated", {
      companyId,
      onboardingUuid: uuid,
      item,
      done,
      status,
    });

    return toResponse(onboarding);
  } catch (error) {
    logger.error("Failed to update onboarding checklist", {
      companyId,
      onboardingUuid: uuid,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Cancel onboarding (e.g. candidate didn't join). Removes the user, which
 * cascades to the employee + onboarding rows. Blocked once onboarding is
 * completed — at that point they're a real employee and should be exited
 * through the employee module, not silently deleted.
 */
async function cancelOnboarding(uuid, companyId) {
  try {
    await sequelize.transaction(async (transaction) => {
      const onboarding = await findOnboarding(uuid, companyId, { transaction });

      if (summarise(onboarding).status === "Completed") {
        throw httpError(409, "Completed onboarding can't be cancelled");
      }

      await User.destroy({
        where: { id: onboarding.employee.userId, companyId },
        transaction,
      });
    });

    logger.info("Onboarding cancelled", { companyId, onboardingUuid: uuid });
  } catch (error) {
    logger.error("Failed to cancel onboarding", {
      companyId,
      onboardingUuid: uuid,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  CHECKLIST_ITEMS,
  getOnboardableRoles,
  listOnboarding,
  startOnboarding,
  updateChecklistItem,
  cancelOnboarding,
};