const bcrypt = require("bcrypt");
const User = require("../models/User");
const Role = require("../models/Role");
const Company = require("../models/Company");
const CompanyProfile = require("../models/CompanyProfile");
const logger = require("../utils/logger");

async function seedUsers() {
  try {
    // ============================================================
    // 1. Create required roles
    // ============================================================

    const roles = [
      {
        name: "admin",
        description: "System administrator",
      },
      {
        name: "bde",
        description: "Business Development Executive",
      },
      {
        name: "client",
        description: "Client user",
      },
      {
        name: "developer",
        description: "Developer",
      },
      {
        name: "hr",
        description: "Human Resources",
      },
      {
        name: "project_lead",
        description: "Project lead",
      },
      {
        name: "tester",
        description: "Software tester",
      },
    ];

    const roleMap = {};

    for (const roleData of roles) {
      const [role] = await Role.findOrCreate({
        where: {
          name: roleData.name,
        },
        defaults: roleData,
      });

      roleMap[role.name] = role.id;

      logger.info("Role ready", {
        roleId: role.id,
        name: role.name,
      });
    }

    // ============================================================
    // 2. Find or create company
    // ============================================================

    const [company, companyCreated] = await Company.findOrCreate({
      where: {
        name: "Hawk'N Technologies",
      },
      defaults: {
        name: "Hawk'N Technologies",
      },
    });

    if (companyCreated) {
      logger.info("Company created successfully", {
        companyId: company.id,
        name: company.name,
      });
    } else {
      logger.info("Company already exists", {
        companyId: company.id,
        name: company.name,
      });
    }

    // ============================================================
    // 3. Find or create company profile
    // ============================================================

    const [companyProfile, profileCreated] = await CompanyProfile.findOrCreate({
      where: {
        companyId: company.id,
      },
      defaults: {
        companyId: company.id,
        officialCompanyName: company.name,
        officialEmail: "admin@gmail.com",
        vision: "",
        mission: "",
        blogContent: "",
      },
    });

    if (profileCreated) {
      logger.info("Company profile created successfully", {
        profileId: companyProfile.id,
        companyId: company.id,
      });
    } else {
      logger.info("Company profile already exists", {
        profileId: companyProfile.id,
        companyId: company.id,
      });
    }

    // ============================================================
    // 4. Users to seed
    // ============================================================

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
    ];

    // ============================================================
    // 5. Create users
    // ============================================================

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

      const createdUser = await User.create({
        companyId: company.id,
        roleId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        passwordHash,
        isActive: true,
      });

      logger.info("User seeded successfully", {
        userId: createdUser.id,
        email: user.email,
        role: user.roleName,
        companyId: company.id,
      });
    }

    // ============================================================
    // 6. Completed
    // ============================================================

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
