const { User } = require("../models/User");
const { Employee } = require("../models/Employee");
const { Role } = require("../models/Role");
const sequelize = require("../config/db");

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

async function getAllRoles() {
  try {
    return await Role.findAll({
      where: {
        isActive: true,
      },
      attributes: ["id", "uuid", "name", "description"],
      order: [["name", "ASC"]],
    });
  } catch (error) {
    throw error;
  }
}

async function createEmployee(data, companyId) {
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

    // Check role
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

    // Check duplicate email
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

    // Create user
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

    // Create employee
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

    // Commit only after both records are created
    await transaction.commit();

    // Fetch complete employee after transaction is committed
    return await getEmployeeById(employee.id, companyId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function updateEmployee(employeeId, companyId, data) {
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

    // Validate role when supplied
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

    // Check duplicate email when email is changed
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

    // Update User
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

    // Update Employee
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

    return await getEmployeeById(employeeId, companyId);
  } catch (error) {
    await transaction.rollback();
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

module.exports = {
  getAllEmployees,
  getEmployeeById,
  getAllRoles,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
