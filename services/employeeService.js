const { User, Employee, Role, Company } = require("../models");
const sequelize = require("../config/db");

const getAllEmployees = async (companyId) => {
  return Employee.findAll({
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
};

const getEmployeeById = async (employeeId, companyId) => {
  return Employee.findOne({
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
};

const getAllRoles = async () => {
  return Role.findAll({
    where: {
      isActive: true,
    },
    attributes: ["id", "uuid", "name", "description"],
    order: [["name", "ASC"]],
  });
};

const createEmployee = async (data, companyId) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      firstName,
      lastName,
      email,
      passwordHash,
      roleId,

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

    // Check role exists and is active
    const role = await Role.findOne({
      where: {
        id: roleId,
        isActive: true,
      },
      transaction,
    });

    if (!role) {
      throw new Error("Invalid or inactive role.");
    }

    // Check email already exists in this company
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

    // 1. Create User
    const user = await User.create(
      {
        companyId,
        roleId,
        firstName,
        lastName,
        email,
        passwordHash,
      },
      {
        transaction,
      },
    );

    // 2. Create Employee profile
    const employee = await Employee.create(
      {
        userId: user.id,
        companyId,

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
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    // Return complete employee after commit
    return getEmployeeById(employee.id, companyId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const updateEmployee = async (employeeId, companyId, data) => {
  const transaction = await sequelize.transaction();

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

    const {
      firstName,
      lastName,
      email,
      roleId,
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

    // Validate role if supplied
    if (roleId !== undefined) {
      const role = await Role.findOne({
        where: {
          id: roleId,
          isActive: true,
        },
        transaction,
      });

      if (!role) {
        throw new Error("Invalid or inactive role.");
      }
    }

    // Update User information
    await employee.user.update(
      {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email !== undefined && { email }),
        ...(roleId !== undefined && { roleId }),
      },
      {
        transaction,
      },
    );

    // Update Employee information
    await employee.update(
      {
        ...(phone1 !== undefined && { phone1 }),
        ...(phone2 !== undefined && { phone2 }),
        ...(whatsapp !== undefined && { whatsapp }),
        ...(joiningDate !== undefined && { joiningDate }),
        ...(dateOfBirth !== undefined && { dateOfBirth }),
        ...(linkedinUrl !== undefined && { linkedinUrl }),
        ...(githubUrl !== undefined && { githubUrl }),
        ...(aadhaarLast4 !== undefined && { aadhaarLast4 }),
        ...(employmentType !== undefined && { employmentType }),
        ...(employmentStatus !== undefined && { employmentStatus }),
        ...(photoUrl !== undefined && { photoUrl }),
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return getEmployeeById(employeeId, companyId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const deleteEmployee = async (employeeId, companyId) => {
  const employee = await Employee.findOne({
    where: {
      id: employeeId,
      companyId,
    },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  // Because employees.user_id has ON DELETE CASCADE,
  // deleting the user will also delete the employee.
  await User.destroy({
    where: {
      id: employee.userId,
      companyId,
    },
  });

  return true;
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  getAllRoles,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
