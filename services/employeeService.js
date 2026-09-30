<<<<<<< HEAD
const User = require("../models/User");
const Employee = require("../models/Employee");
const Role = require("../models/Role");
=======
// Models export themselves directly (module.exports = User), so no { } here.
// Loading them via associations also guarantees the "user"/"role" links exist.
const { User, Employee, Role } = require("../models/associations");
>>>>>>> feature/hr-1
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
module.exports = {
  getAllEmployees,
  getEmployeeById,
  getAllRoles,
  createEmployee,
  updateEmployee,
  deleteEmployee,
<<<<<<< HEAD
  getEmployeeIdByUserId,
};
=======
};
>>>>>>> feature/hr-1
