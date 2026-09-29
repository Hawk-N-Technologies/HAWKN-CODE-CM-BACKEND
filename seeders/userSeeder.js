const bcrypt = require("bcrypt");
const User = require("../models/User");
const Role = require("../models/Role");
const Company = require("../models/Company");
const logger = require("../utils/logger");

async function seedUsers() {
  try {
    const company = await Company.findOne({
      where: {
        name: "Hawk'N Technologies",
      },
    });

    if (!company) {
      throw new Error("Hawk'N Technologies company not found");
    }

    const roles = await Role.findAll({
      where: {
        name: ["admin", "hr", "bde", "client", "tester", "developer"],
      },
    });

    const roleMap = {};

    roles.forEach(function (role) {
      roleMap[role.name] = role.id;
    });

    const users = [
      {
        firstName: "Admin",
        lastName: "User",
        email: "admin@gmail.com",
        password: "Admin@123",
        roleName: "admin",
      },
      {
        firstName: "HR",
        lastName: "User",
        email: "hr@gmail.com",
        password: "Hr@12345",
        roleName: "hr",
      },
      {
        firstName: "BDE",
        lastName: "User",
        email: "bde@gmail.com",
        password: "Bde@12345",
        roleName: "bde",
      },
      {
        firstName: "Client",
        lastName: "User",
        email: "client@gmail.com",
        password: "Client@123",
        roleName: "client",
      },
      {
        firstName: "Tester",
        lastName: "User",
        email: "tester@gmail.com",
        password: "Tester@123",
        roleName: "tester",
      },
      {
        firstName: "Developer",
        lastName: "User",
        email: "dev@gmail.com",
        password: "Dev@12345",
        roleName: "developer",
      },
    ];

    for (const user of users) {
      const roleId = roleMap[user.roleName];

      if (!roleId) {
        throw new Error(`Role '${user.roleName}' not found`);
      }

      const existingUser = await User.findOne({
        where: {
          email: user.email,
        },
      });

      if (existingUser) {
        logger.info("User already exists", {
          email: user.email,
        });

        continue;
      }

      const passwordHash = await bcrypt.hash(user.password, 12);

      await User.create({
        companyId: company.id,
        roleId: roleId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        passwordHash: passwordHash,
        isActive: true,
      });

      logger.info("User seeded successfully", {
        email: user.email,
        role: user.roleName,
      });
    }

    logger.info("User seeding completed successfully");
  } catch (error) {
    logger.error("User seeding failed", {
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

module.exports = seedUsers;
