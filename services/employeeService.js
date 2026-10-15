const User = require("../models/User");
const Employee = require("../models/Employee");
const Role = require("../models/Role");
const { Op } = require("@sequelize/core");
const sequelize = require("../config/db");
const bcrypt = require("bcrypt");

async function getAllEmployees(companyId) {
  try {
    return await Employee.findAll({
      where: {
        companyId,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: {
            exclude: ["passwordHash"],
          },
          include: [
            {
              model: Role,
              as: "role",
              attributes: ["id", "uuid", "name", "description"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  } catch (error) {
    throw error;
  }
}

async function getEmployeeById(employeeId, companyId) {
  try {
    return await Employee.findOne({
      where: {
        id: employeeId,
        companyId,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: {
            exclude: ["passwordHash"],
          },
          include: [
            {
              model: Role,
              as: "role",
              attributes: ["id", "uuid", "name", "description"],
            },
          ],
        },
      ],
    });
  } catch (error) {
    throw error;
  }
}

const getRoleByUuid = async (uuid, transaction) => {
  const role = await Role.findOne({
    where: {
      uuid,
      isActive: true,
    },
    transaction,
  });

  if (!role) {
    throw new Error("Invalid or inactive role.");
  }

  return role;
};

async function getAllRoles() {
  try {
    return await Role.findAll({
      where: {
        isActive: true,
        name: {
          [Op.ne]: "client",
        },
      },
      attributes: ["uuid", "name", "description"],
      order: [["name", "ASC"]],
    });
  } catch (error) {
    throw error;
  }
}

async function createEmployee(data, companyId) {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const {
      firstName,
      lastName,
      email,
      companyEmail,
      password,
      confirmPassword,
      roleUuid,
      phone1,
      phone2,
      whatsapp,
      joiningDate,
      dateOfBirth,
      linkedinUrl,
      githubUrl,
      aadhaarLast4,
      employmentType,
      employmentStatus,
      photoUrl,
    } = data;

    const role = await Role.findOne({
      where: {
        uuid: roleUuid,
        isActive: true,
      },
      transaction,
    });

    if (!role) {
      throw new Error("Invalid or inactive role.");
    }

    const existingUser = await User.findOne({
      where: {
        companyId,
        email,
      },
      transaction,
    });

    if (existingUser) {
      throw new Error("A user with this email already exists.");
    }
    if (password !== confirmPassword) {
      throw new Error("Password and confirm password do not match.");
    }
    // Hash password using 12 salt rounds
    const passwordHash = await bcrypt.hash(password, 12);

    const roleByuuid = await getRoleByUuid(roleUuid, transaction);
    console.log(roleByuuid);
    const user = await User.create(
      {
        companyId,
        roleId: roleByuuid.id,
        firstName,
        lastName,
        email,
        passwordHash,
      },
      {
        transaction,
      },
    );

    const employee = await Employee.create(
      {
        userId: user.id,
        companyId,
        phone1,
        companyEmail,
        phone2,
        whatsapp,
        joiningDate,
        dateOfBirth,
        linkedinUrl,
        githubUrl,
        aadhaarLast4,
        employmentType,
        employmentStatus,
        photoUrl,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return await getEmployeeById(employee.id, companyId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function updateEmployee(employeeId, companyId, data) {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const employee = await Employee.findOne({
      where: {
        id: employeeId,
        companyId,
      },
      include: [
        {
          model: User,
          as: "user",
        },
      ],
      transaction,
    });

    if (!employee) {
      throw new Error("Employee not found.");
    }

    if (!employee.user) {
      throw new Error("Employee user account not found.");
    }

    const {
      firstName,
      lastName,
      email,
      companyEmail,
      password,
      confirmPassword,
      roleUuid,
      phone1,
      phone2,
      whatsapp,
      joiningDate,
      dateOfBirth,
      linkedinUrl,
      githubUrl,
      aadhaarLast4,
      employmentType,
      employmentStatus,
      photoUrl,
    } = data;

    /**
     * --------------------------------------------------
     * RESOLVE ROLE UUID -> ROLE ID
     * --------------------------------------------------
     */
    let roleId;

    if (roleUuid !== undefined) {
      const role = await getRoleByUuid(roleUuid, transaction);

      roleId = role.id;
    }

    /**
     * --------------------------------------------------
     * CHECK DUPLICATE EMAIL
     * --------------------------------------------------
     */
    if (email !== undefined && email !== employee.user.email) {
      const existingUser = await User.findOne({
        where: {
          companyId,
          email,
        },
        transaction,
      });

      if (existingUser && existingUser.id !== employee.user.id) {
        throw new Error("A user with this email already exists.");
      }
    }

    /**
     * --------------------------------------------------
     * PASSWORD
     * --------------------------------------------------
     *
     * Password is optional during update.
     *
     * If neither password nor confirmPassword is sent:
     *     Don't change password.
     *
     * If either one is sent:
     *     Both are required.
     *
     * Both must match.
     */
    let passwordHash;

    if (password !== undefined || confirmPassword !== undefined) {
      if (!password || !confirmPassword) {
        throw new Error("Password and confirm password are required.");
      }

      if (password !== confirmPassword) {
        throw new Error("Password and confirm password do not match.");
      }

      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      passwordHash = await bcrypt.hash(password, 12);
    }

    /**
     * --------------------------------------------------
     * UPDATE USER
     * --------------------------------------------------
     */
    const userUpdateData = {
      ...(firstName !== undefined && {
        firstName: firstName.trim(),
      }),

      ...(lastName !== undefined && {
        lastName: lastName.trim(),
      }),

      ...(email !== undefined && {
        email: email.trim(),
      }),

      ...(roleId !== undefined && {
        roleId,
      }),

      ...(passwordHash !== undefined && {
        passwordHash,
      }),
    };

    await employee.user.update(userUpdateData, {
      transaction,
    });

    /**
     * --------------------------------------------------
     * UPDATE EMPLOYEE
     * --------------------------------------------------
     */
    const employeeUpdateData = {
      ...(companyEmail !== undefined && {
        companyEmail: companyEmail || null,
      }),
      ...(phone1 !== undefined && {
        phone1: phone1 || null,
      }),

      ...(phone2 !== undefined && {
        phone2: phone2 || null,
      }),

      ...(whatsapp !== undefined && {
        whatsapp: whatsapp || null,
      }),

      ...(joiningDate !== undefined && {
        joiningDate: joiningDate || null,
      }),

      ...(dateOfBirth !== undefined && {
        dateOfBirth: dateOfBirth || null,
      }),

      ...(linkedinUrl !== undefined && {
        linkedinUrl: linkedinUrl || null,
      }),

      ...(githubUrl !== undefined && {
        githubUrl: githubUrl || null,
      }),

      ...(aadhaarLast4 !== undefined && {
        aadhaarLast4: aadhaarLast4 || null,
      }),

      ...(employmentType !== undefined && {
        employmentType,
      }),

      ...(employmentStatus !== undefined && {
        employmentStatus,
      }),

      ...(photoUrl !== undefined && {
        photoUrl: photoUrl || null,
      }),
    };

    await employee.update(employeeUpdateData, {
      transaction,
    });

    await transaction.commit();

    return await getEmployeeById(employeeId, companyId);
  } catch (error) {
    /**
     * Rollback only if transaction is still active.
     */
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error("Transaction rollback error:", rollbackError);
    }

    throw error;
  }
}

async function deleteEmployee(employeeId, companyId) {
  const transaction = await sequelize.transaction();

  try {
    const employee = await Employee.findOne({
      where: {
        id: employeeId,
        companyId,
      },
      transaction,
    });

    if (!employee) {
      throw new Error("Employee not found.");
    }

    // Delete user.
    // Employee will be deleted automatically if
    // employee.user_id has ON DELETE CASCADE.
    await User.destroy({
      where: {
        id: employee.userId,
        companyId,
      },
      transaction,
    });

    await transaction.commit();

    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getEmployeeIdByUserId(userId, transaction) {
  try {
    const employee = await Employee.findOne({
      where: {
        userId,
      },
      attributes: ["id"],
      transaction,
    });

    if (!employee) {
      throw new Error("Employee record not found for this user.");
    }

    return employee.id;
  } catch (error) {
    throw error;
  }
}

// services/employee.service.js

async function getPeople(companyId, options = {}) {
  const { search = "", page = 1, limit = 10, status, role } = options;

  const offset = (page - 1) * limit;

  const userWhere = {
    companyId,
  };

  const trimmedSearch = search.trim();

  if (trimmedSearch) {
    userWhere[Op.or] = [
      {
        firstName: {
          [Op.iLike]: `%${trimmedSearch}%`,
        },
      },
      {
        lastName: {
          [Op.iLike]: `%${trimmedSearch}%`,
        },
      },
      {
        email: {
          [Op.iLike]: `%${trimmedSearch}%`,
        },
      },
    ];
  }

  const roleWhere = {
    // Admin dashboard should not show clients
    name: {
      [Op.ne]: "client",
    },
  };

  if (role) {
    roleWhere.name = role;
  }

  const employeeWhere = {};

  if (status) {
    employeeWhere.employmentStatus = status;
  }

  const result = await User.findAndCountAll({
    where: userWhere,

    attributes: [
      "id",
      "uuid",
      "companyId",
      "roleId",
      "firstName",
      "lastName",
      "email",
      "isActive",
      "createdAt",
      "updatedAt",
    ],

    include: [
      {
        model: Role,
        as: "role",
        required: true,

        attributes: ["id", "uuid", "name", "description"],

        where: roleWhere,
      },

      {
        model: Employee,
        as: "employee",

        // VERY IMPORTANT
        // false = LEFT JOIN
        required: false,

        attributes: [
          "id",
          "uuid",
          "companyId",
          "companyEmail",
          "phone1",
          "phone2",
          "whatsapp",
          "joiningDate",
          "dateOfBirth",
          "linkedinUrl",
          "githubUrl",
          "aadhaarLast4",
          "employmentType",
          "employmentStatus",
          "photoUrl",
        ],

        where:
          Object.keys(employeeWhere).length > 0 ? employeeWhere : undefined,
      },
    ],

    order: [["createdAt", "DESC"]],

    limit,
    offset,

    distinct: true,
  });

  const rows = result.rows.map((user) => {
    const employee = user.employee;

    return {
      // User information
      id: employee?.id ?? user.id,

      userId: user.id,
      userUuid: user.uuid,

      name: [user.firstName, user.lastName].filter(Boolean).join(" "),

      firstName: user.firstName,
      lastName: user.lastName,

      email: user.email,

      role: user.role?.name,
      roleId: user.role?.id,
      roleUuid: user.role?.uuid,
      userIsActive: user.isActive,

      // Employee information
      employeeId: employee?.id ?? null,
      employeeUuid: employee?.uuid ?? null,

      companyEmail: employee?.companyEmail ?? null,

      phone1: employee?.phone1 ?? null,
      phone2: employee?.phone2 ?? null,
      whatsapp: employee?.whatsapp ?? null,

      joiningDate: employee?.joiningDate ?? null,
      joinDate: employee?.joiningDate ?? null,

      dateOfBirth: employee?.dateOfBirth ?? null,

      linkedinUrl: employee?.linkedinUrl ?? null,
      githubUrl: employee?.githubUrl ?? null,

      aadhaarLast4: employee?.aadhaarLast4 ?? null,

      employmentType: employee?.employmentType ?? null,

      employmentStatus: employee?.employmentStatus ?? null,

      status:
        employee?.employmentStatus ?? (user.isActive ? "Active" : "Inactive"),

      photoUrl: employee?.photoUrl ?? null,

      // Useful flag for frontend
      isEmployee: Boolean(employee),
    };
  });

  return {
    rows,

    pagination: {
      total: result.count,
      page,
      limit,
      totalPages: Math.ceil(result.count / limit),
    },
  };
}

async function createPerson(data, companyId) {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      roleUuid,
      isActive = true,
    } = data;

    /**
     * Required fields.
     */
    if (!firstName || !firstName.trim()) {
      throw new Error("First name is required.");
    }

    if (!lastName || !lastName.trim()) {
      throw new Error("Last name is required.");
    }

    if (!email || !email.trim()) {
      throw new Error("Email is required.");
    }

    if (!password) {
      throw new Error("Password is required.");
    }

    if (!confirmPassword) {
      throw new Error("Confirm password is required.");
    }

    if (password !== confirmPassword) {
      throw new Error("Password and confirm password do not match.");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    if (!roleUuid) {
      throw new Error("Role is required.");
    }

    /**
     * Find role using UUID.
     */
    const role = await Role.findOne({
      where: {
        uuid: roleUuid,
        isActive: true,

        /**
         * Client cannot be assigned from People Management.
         */
        name: {
          [Op.ne]: "client",
        },
      },

      transaction,
    });

    if (!role) {
      throw new Error("Invalid or inactive role.");
    }

    /**
     * Check duplicate email inside company.
     */
    const existingUser = await User.findOne({
      where: {
        companyId,
        email: email.trim(),
      },

      transaction,
    });

    if (existingUser) {
      throw new Error("A user with this email already exists.");
    }

    /**
     * Hash password.
     */
    const passwordHash = await bcrypt.hash(password, 12);

    /**
     * Create User ONLY.
     */
    const user = await User.create(
      {
        companyId,
        roleId: role.id,

        firstName: firstName.trim(),
        lastName: lastName.trim(),

        email: email.trim(),

        passwordHash,

        isActive,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}

async function updatePerson(data, personId, companyId) {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      roleUuid,
      isActive,
    } = data;

    const user = await User.findOne({
      where: {
        uuid: personId,
        companyId,
      },
      transaction,
    });

    console.log(user);

    if (!user) {
      throw new Error("User not found.");
    }
    const updateData = {};

    if (firstName !== undefined) {
      if (!firstName || !firstName.trim()) {
        throw new Error("First name is required.");
      }

      if (firstName.trim().length < 2) {
        throw new Error("First name must be at least 2 characters.");
      }

      if (!/^[a-zA-Z\s'-]+$/.test(firstName.trim())) {
        throw new Error("First name contains invalid characters.");
      }

      updateData.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      if (!lastName || !lastName.trim()) {
        throw new Error("Last name is required.");
      }

      if (lastName.trim().length < 2) {
        throw new Error("Last name must be at least 2 characters.");
      }

      if (!/^[a-zA-Z\s'-]+$/.test(lastName.trim())) {
        throw new Error("Last name contains invalid characters.");
      }

      updateData.lastName = lastName.trim();
    }

    if (email !== undefined) {
      if (!email || !email.trim()) {
        throw new Error("Email is required.");
      }

      const normalizedEmail = email.trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new Error("Enter a valid email address.");
      }

      if (normalizedEmail !== user.email) {
        const existingUser = await User.findOne({
          where: {
            companyId,
            email: normalizedEmail,
            id: {
              [Op.ne]: user.id,
            },
          },
          transaction,
        });

        if (existingUser) {
          throw new Error("A user with this email already exists.");
        }
      }

      updateData.email = normalizedEmail;
    }

    if (roleUuid !== undefined) {
      if (!roleUuid) {
        throw new Error("Role is required.");
      }

      const role = await Role.findOne({
        where: {
          uuid: roleUuid,
          isActive: true,

          name: {
            [Op.ne]: "client",
          },
        },
        transaction,
      });

      if (!role) {
        throw new Error("Invalid or inactive role.");
      }

      updateData.roleId = role.id;
    }

    if (password !== undefined || confirmPassword !== undefined) {
      if (!password) {
        throw new Error("Password is required.");
      }

      if (!confirmPassword) {
        throw new Error("Confirm password is required.");
      }

      if (password !== confirmPassword) {
        throw new Error("Password and confirm password do not match.");
      }

      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        throw new Error("Account status must be true or false.");
      }

      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error("No fields provided for update.");
    }

    await user.update(updateData, {
      transaction,
    });

    await transaction.commit();

    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };
  } catch (error) {
    console.log(error);
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  getAllEmployees,
  getEmployeeById,
  getAllRoles,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeIdByUserId,
  getPeople,
  createPerson,
  updatePerson,
};
