const bcrypt = require("bcrypt");
const jwtService = require("../services/jwtService");
const User = require("../models/User");
const Role = require("../models/Role");
const Company = require("../models/Company");
const logger = require("../utils/logger");
const Employee = require("../models/Employee");
const Project = require("../models/Project");
const ProjectOperation = require("../models/ProjectOperation");

async function login(email, password) {
  try {
    if (!email || !password) {
      const error = new Error("Email and password are required");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({
      where: {
        email: email.toLowerCase().trim(),
        isActive: true,
      },
      include: [
        {
          model: Role,
          as: "role",
          attributes: ["uuid", "name", "description"],
        },
        {
          model: Company,
          as: "company",
          attributes: ["id", "uuid", "name"],
        },
      ],
    });

    if (!user) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
    }

    const payload = {
      userId: user.id,
      userUuid: user.uuid,
      companyId: user.companyId,
      roleId: user.roleId,
      role: user.role.name,
    };

    const token = jwtService.generateJwt(payload);

    logger.info("User login successful", {
      userId: user.id,
      email: user.email,
      role: user.role.name,
    });

    return {
      token,
      user: {
        uuid: user.uuid,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: {
          uuid: user.role.uuid,
          name: user.role.name,
        },
        company: {
          uuid: user.company.uuid,
          name: user.company.name,
        },
      },
    };
  } catch (error) {
    logger.error("User login failed", {
      email,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function getMe(userId) {
  try {
    if (!userId) {
      const error = new Error("User ID is required");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({
      where: {
        id: userId,
        isActive: true,
      },
      attributes: [
        "uuid",
        "firstName",
        "lastName",
        "email",
        "companyId",
        "roleId",
      ],
      include: [
        {
          model: Role,
          as: "role",
          attributes: ["uuid", "name", "description"],
        },
        {
          model: Company,
          as: "company",
          attributes: ["uuid", "name"],
        },
      ],
    });

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    return {
      uuid: user.uuid,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: {
        uuid: user.role.uuid,
        name: user.role.name,
        description: user.role.description,
      },
      company: {
        uuid: user.company.uuid,
        name: user.company.name,
      },
    };
  } catch (error) {
    logger.error("Failed to get authenticated user", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function getAvailableModes(userId, companyId, role) {
  const modes = [];

  if (role?.toLowerCase() === "developer") {
    modes.push("developer");

    const employee = await Employee.findOne({
      where: {
        userId,
        companyId,
        employmentStatus: "Active",
      },
      attributes: ["id"],
    });

    if (employee) {
      const [projectLeadProject, operationsPlan] = await Promise.all([
        Project.findOne({
          where: {
            companyId,
            projectLeadId: employee.id,
          },
          attributes: ["id"],
        }),
        ProjectOperation.findOne({
          where: {
            companyId,
            projectLeadId: employee.id,
          },
          attributes: ["id"],
        }),
      ]);

      if (projectLeadProject || operationsPlan) {
        modes.push("project_lead");
      }
    }
  }

  return modes;
}

async function checkProjectLeadAccess(userId, companyId) {
  const employee = await Employee.findOne({
    where: {
      userId,
      companyId,
      employmentStatus: "Active",
    },
    attributes: ["id", "uuid"],
  });

  if (!employee) return false;

  const [project, operation] = await Promise.all([
    Project.findOne({
      where: {
        companyId,
        projectLeadId: employee.id,
      },
      attributes: ["id"],
    }),

    ProjectOperation.findOne({
      where: {
        companyId,
        projectLeadId: employee.id,
      },
      attributes: ["id"],
    }),
  ]);

  return Boolean(project || operation);
}
module.exports = {
  login,
  getMe,
  getAvailableModes,
  checkProjectLeadAccess,
};
