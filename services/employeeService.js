const User = require("../models/User");
const Employee = require("../models/Employee");
const EmployeeSalary = require("../models/EmployeeSalary");
const Role = require("../models/Role");
const { Op } = require("@sequelize/core");
const sequelize = require("../config/db");
const bcrypt = require("bcrypt");
const Joi = require("joi");
const { setSalarySchema } = require("../validations/payroll.validation");

const countryCodeRegex = /^\+[1-9]\d{0,2}$/;
const phoneNumberRegex = /^\d{4,15}$/;
const salarySchema = setSalarySchema.extract("salary").integer();

function validateAndNormalizeSalary(salary) {
  const { error, value } = salarySchema.validate(salary);

  if (error) {
    error.statusCode = 400;
    throw error;
  }

  return value;
}

async function saveEmployeeSalary(employeeId, salary, transaction) {
  if (
    salary === undefined ||
    salary === null ||
    (typeof salary === "string" && salary.trim() === "")
  ) {
    return;
  }

  const normalizedSalary = validateAndNormalizeSalary(salary);
  const existingSalary = await EmployeeSalary.findOne({
    where: { employeeId },
    transaction,
  });

  if (existingSalary) {
    await existingSalary.update(
      { salary: normalizedSalary },
      { transaction },
    );
    return;
  }

  await EmployeeSalary.create(
    { employeeId, salary: normalizedSalary },
    { transaction },
  );
}

function validateRequiredEmployeeFields(data) {
  const requiredFields = [
    [
      "phone1",
      "Phone number",
      Joi.string().pattern(phoneNumberRegex).messages({
        "string.pattern.base": "Phone number must contain 4 to 15 digits.",
      }),
    ],
    ["dateOfBirth", "Date of birth", Joi.date().iso()],
    [
      "linkedinUrl",
      "LinkedIn URL",
      Joi.string().uri({ scheme: ["http", "https"] }),
    ],
    [
      "githubUrl",
      "GitHub URL",
      Joi.string().uri({ scheme: ["http", "https"] }),
    ],
    [
      "aadhaarLast4",
      "Aadhaar last 4 digits",
      Joi.string()
        .pattern(/^\d{12}$/)
        .messages({
          "string.pattern.base":
            "Aadhaar last 4 digits must contain exactly 4 digits.",
        }),
    ],
  ];

  for (const [field, label, schema] of requiredFields) {
    const value = data[field];

    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    ) {
      const error = new Error(`${label} is required.`);
      error.statusCode = 400;
      throw error;
    }

    const { error } = schema.validate(
      typeof value === "string" ? value.trim() : value,
    );

    if (error) {
      error.statusCode = 400;
      throw error;
    }
  }
}

function validateContactDetails(data) {
  const invalid = (message) => {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  };

  const countryCodeFields = [
    ["phone1CountryCode", "Phone 1 country code"],
    ["phone2CountryCode", "Phone 2 country code"],
    ["whatsappCountryCode", "WhatsApp country code"],
  ];

  for (const [field, label] of countryCodeFields) {
    const value = data[field];

    if (value !== undefined && value !== null && value !== "") {
      if (typeof value !== "string" || !countryCodeRegex.test(value.trim())) {
        invalid(`${label} must be a valid international dialing code.`);
      }
    }
  }

  for (const [field, label] of [
    ["phone1", "Phone 1"],
    ["phone2", "Phone 2"],
    ["whatsapp", "WhatsApp"],
  ]) {
    const value = data[field];

    if (value !== undefined && value !== null && value !== "") {
      if (typeof value !== "string" || !phoneNumberRegex.test(value.trim())) {
        invalid(`${label} must contain 4 to 15 digits.`);
      }
    }
  }

  for (const [field, label, maxLength] of [
    ["address", "Address", 500],
    ["city", "City", 100],
    ["country", "Country", 100],
  ]) {
    const value = data[field];

    if (value !== undefined && value !== null && value !== "") {
      if (typeof value !== "string" || value.trim().length > maxLength) {
        invalid(
          `${label} must be a string of at most ${maxLength} characters.`,
        );
      }
    }
  }
}

function optionalText(value) {
  return value === undefined || value === null || value === ""
    ? null
    : value.trim();
}



async function getAllEmployees(
  companyId,
  { search, page = 1, limit = 10, status, role } = {},
) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(limit) || 10));
  const offset = (currentPage - 1) * pageSize;

  const where = { companyId };
  const userWhere = {};

  if (search?.trim()) {
    userWhere[Op.or] = [
      { name: { [Op.iLike]: `%${search.trim()}%` } },
      { email: { [Op.iLike]: `%${search.trim()}%` } },
      { phone: { [Op.iLike]: `%${search.trim()}%` } },
    ];
  }

  if (status) {
    where.status = status;
  }

  const userInclude = {
    model: User,
    as: "user",
    attributes: { exclude: ["passwordHash"] },
    required: Boolean(search?.trim() || role),
    where: Object.keys(userWhere).length ? userWhere : undefined,
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["id", "uuid", "name", "description"],
        required: Boolean(role),
        where: role ? { name: role } : undefined,
      },
    ],
  };

  const { count, rows } = await Employee.findAndCountAll({
    where,
    include: [
      userInclude,
      {
        model: EmployeeSalary,
        as: "salaryDetails",
        attributes: ["uuid", "salary"],
        required: false,
      },
    ],
    limit: pageSize,
    offset,
    order: [["createdAt", "DESC"]],
    distinct: true,
  });

  return {
    rows,
    pagination: {
      total: count,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(count / pageSize),
    },
  };
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
      salary,
      confirmPassword,
      roleUuid,
      phone1,
      phone1CountryCode,
      phone2,
      phone2CountryCode,
      whatsapp,
      whatsappCountryCode,
      address,
      city,
      country,
      joiningDate,
      dateOfBirth,
      linkedinUrl,
      githubUrl,
      aadhaarLast4,
      employmentType,
      employmentStatus,
      photoUrl,
    } = data;

    validateContactDetails(data);
    validateRequiredEmployeeFields(data);

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
        phone1CountryCode,
        companyEmail,
        phone2,
        phone2CountryCode,
        whatsapp,
        whatsappCountryCode,
        address,
        city,
        country,
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

    if (
      salary === undefined ||
      salary === null ||
      !Number.isSafeInteger(Number(salary)) ||
      Number(salary) < 0
    ) {
      throw new Error("Salary must be a valid positive whole number.");
    }

    await EmployeeSalary.create(
      {
        employeeId: employee.id,
        salary,
      },
      { transaction },
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
      phone1CountryCode,
      phone2,
      phone2CountryCode,
      whatsapp,
      whatsappCountryCode,
      address,
      city,
      country,
      joiningDate,
      dateOfBirth,
      linkedinUrl,
      githubUrl,
      aadhaarLast4,
      employmentType,
      employmentStatus,
      photoUrl,
      salary,
    } = data;

    validateContactDetails(data);

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

      ...(phone1CountryCode !== undefined && {
        phone1CountryCode: phone1CountryCode || null,
      }),

      ...(phone2 !== undefined && {
        phone2: phone2 || null,
      }),

      ...(phone2CountryCode !== undefined && {
        phone2CountryCode: phone2CountryCode || null,
      }),

      ...(whatsapp !== undefined && {
        whatsapp: whatsapp || null,
      }),

      ...(whatsappCountryCode !== undefined && {
        whatsappCountryCode: whatsappCountryCode || null,
      }),

      ...(address !== undefined && {
        address: optionalText(address),
      }),

      ...(city !== undefined && {
        city: optionalText(city),
      }),

      ...(country !== undefined && {
        country: optionalText(country),
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

    if (salary !== undefined) {
      if (
        salary === null ||
        salary === "" ||
        !Number.isSafeInteger(Number(salary)) ||
        Number(salary) < 0
      ) {
        throw new Error("Salary must be a valid whole number.");
      }

      const existingSalary = await EmployeeSalary.findOne({
        where: {
          employeeId: employee.id,
        },
        transaction,
      });

      if (existingSalary) {
        await existingSalary.update(
          {
            salary: Number(salary),
          },
          { transaction },
        );
      } else {
        await EmployeeSalary.create(
          {
            employeeId: employee.id,
            salary: Number(salary),
          },
          { transaction },
        );
      }
    }
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

async function getPeople(companyId, options = {}) {
  const { search = "", page = 1, limit = 10, status, role } = options;

  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(limit) || 10));
  const offset = (currentPage - 1) * pageSize;

  const trimmedSearch = String(search ?? "").trim();
  const trimmedRole = String(role ?? "").trim();
  const receivedStatus = String(status ?? "").trim();

  // Normalize status to the exact values stored in PostgreSQL.
  const allowedStatuses = ["Active", "On Leave", "Exited"];

  const normalizedStatus = receivedStatus
    ? allowedStatuses.find(
        (value) => value.toLowerCase() === receivedStatus.toLowerCase(),
      )
    : undefined;

  if (receivedStatus && !normalizedStatus) {
    const error = new Error(
      `Invalid status. Allowed values: ${allowedStatuses.join(", ")}`,
    );
    error.statusCode = 400;
    throw error;
  }

  // Filter users belonging to the current company.
  const userWhere = { companyId };

  if (trimmedSearch) {
    userWhere[Op.or] = [
      { firstName: { [Op.iLike]: `%${trimmedSearch}%` } },
      { lastName: { [Op.iLike]: `%${trimmedSearch}%` } },
      { email: { [Op.iLike]: `%${trimmedSearch}%` } },
    ];
  }

  // Always exclude clients; apply the requested role if provided.
  const roleWhere = {
    name: {
      [Op.ne]: "client",
      ...(trimmedRole ? { [Op.eq]: trimmedRole } : {}),
    },
  };

  // Only filter employee records when a status was supplied.
  const employeeWhere = normalizedStatus
    ? { employmentStatus: normalizedStatus }
    : undefined;

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

        // A status filter requires a matching employee record.
        required: Boolean(normalizedStatus),

        attributes: [
          "id",
          "uuid",
          "companyId",
          "companyEmail",
          "address",
          "city",
          "country",
          "phone1",
          "phone1CountryCode",
          "phone2",
          "phone2CountryCode",
          "whatsapp",
          "whatsappCountryCode",
          "joiningDate",
          "dateOfBirth",
          "linkedinUrl",
          "githubUrl",
          "aadhaarLast4",
          "employmentType",
          "employmentStatus",
          "photoUrl",
        ],

        where: employeeWhere,
      },
    ],

    order: [["createdAt", "DESC"]],
    limit: pageSize,
    offset,
    distinct: true,
    subQuery: false,
  });

  const rows = result.rows.map((user) => {
    const employee = user.employee;

    return {
      id: employee?.id ?? user.id,

      userId: user.id,
      userUuid: user.uuid,
      companyId: user.companyId,

      name: [user.firstName, user.lastName].filter(Boolean).join(" "),

      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,

      role: user.role?.name ?? null,
      roleId: user.role?.id ?? null,
      roleUuid: user.role?.uuid ?? null,

      userIsActive: user.isActive,

      employeeId: employee?.id ?? null,
      employeeUuid: employee?.uuid ?? null,
      companyEmail: employee?.companyEmail ?? null,

      phone1: employee?.phone1 ?? null,
      phone1CountryCode: employee?.phone1CountryCode ?? null,
      phone2: employee?.phone2 ?? null,
      phone2CountryCode: employee?.phone2CountryCode ?? null,
      whatsapp: employee?.whatsapp ?? null,
      whatsappCountryCode: employee?.whatsappCountryCode ?? null,

      address: employee?.address ?? null,
      city: employee?.city ?? null,
      country: employee?.country ?? null,

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
      isEmployee: Boolean(employee),
    };
  });

  const total = Number(result.count);

  return {
    rows,
    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
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
      address,
      city,
      country,
      phone1,
      phone1CountryCode,
      phone2,
      phone2CountryCode,
      whatsapp,
      whatsappCountryCode,
      dateOfBirth,
      linkedinUrl,
      githubUrl,
      aadhaarLast4,
      salary,
      isActive = true,
    } = data;

    validateContactDetails(data);
    validateRequiredEmployeeFields(data);

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

    const employee = await Employee.create(
      {
        userId: user.id,
        companyId,
        address: optionalText(address),
        city: optionalText(city),
        country: optionalText(country),
        phone1: optionalText(phone1),
        phone1CountryCode: optionalText(phone1CountryCode),
        phone2: optionalText(phone2),
        phone2CountryCode: optionalText(phone2CountryCode),
        whatsapp: optionalText(whatsapp),
        whatsappCountryCode: optionalText(whatsappCountryCode),
        dateOfBirth,
        linkedinUrl: linkedinUrl.trim(),
        githubUrl: githubUrl.trim(),
        aadhaarLast4: aadhaarLast4.trim(),
      },
      { transaction },
    );

    await saveEmployeeSalary(employee.id, salary, transaction);

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
      aadhaarLast4,
      githubUrl,
      linkedinUrl,
      companyEmail,
      dateOfBirth,
      joiningDate,
      whatsapp,
      whatsappCountryCode,
      phone1,
      phone1CountryCode,
      phone2,
      phone2CountryCode,
      address,
      city,
      country,
      isActive,
      salary,
    } = data;

    validateContactDetails(data);

    const user = await User.findOne({
      where: {
        uuid: personId,
        companyId,
      },
      transaction,
    });

    const emp = await Employee.findOne({
      where: {
        userId: user.id,
      },
    });

    if (!emp) {
      throw new Error("Employee record not found.");
    }

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

    const employeeUpdateData = {};

    // Phone 1
    if (phone1 !== undefined) {
      employeeUpdateData.phone1 = phone1?.trim() || null;
    }

    if (phone1CountryCode !== undefined) {
      employeeUpdateData.phone1CountryCode = phone1CountryCode?.trim() || null;
    }

    if (companyEmail !== null && companyEmail !== "") {
      const normalizedEmail = companyEmail.trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new Error("Enter a valid email address.");
      }

      if (normalizedEmail !== emp.companyEmail) {
        const existingUser = await Employee.findOne({
          where: {
            userId: user.id,
            companyEmail: normalizedEmail,
          },
          transaction,
        });

        if (existingUser) {
          throw new Error("A user with this email already exists.");
        }
      }

      employeeUpdateData.companyEmail = normalizedEmail;
    }

    // Phone 2
    if (phone2 !== undefined) {
      employeeUpdateData.phone2 = phone2?.trim() || null;
    }

    if (phone2CountryCode !== undefined) {
      employeeUpdateData.phone2CountryCode = phone2CountryCode?.trim() || null;
    }

    // WhatsApp
    if (whatsapp !== undefined) {
      employeeUpdateData.whatsapp = whatsapp?.trim() || null;
    }

    if (whatsappCountryCode !== undefined) {
      employeeUpdateData.whatsappCountryCode =
        whatsappCountryCode?.trim() || null;
    }

    if (address !== undefined) {
      employeeUpdateData.address = optionalText(address);
    }

    if (city !== undefined) {
      employeeUpdateData.city = optionalText(city);
    }

    if (country !== undefined) {
      employeeUpdateData.country = optionalText(country);
    }

    // Date of birth
    if (dateOfBirth !== undefined) {
      employeeUpdateData.dateOfBirth = dateOfBirth || null;
    }

    // Joining date
    if (joiningDate !== undefined) {
      employeeUpdateData.joiningDate = joiningDate || null;
    }

    // GitHub URL
    if (githubUrl !== undefined) {
      employeeUpdateData.githubUrl = githubUrl?.trim() || null;
    }

    // LinkedIn URL
    if (linkedinUrl !== undefined) {
      employeeUpdateData.linkedinUrl = linkedinUrl?.trim() || null;
    }

    // Aadhaar last four digits
    if (aadhaarLast4 !== undefined) {
      const value = aadhaarLast4?.trim() || null;

      if (value !== null && !/^\d{4}$/.test(value)) {
        throw new Error(
          "Aadhaar last four digits must contain exactly 4 digits.",
        );
      }

      employeeUpdateData.aadhaarLast4 = value;
    }

    // Update User
    if (Object.keys(updateData).length > 0) {
      await user.update(updateData, { transaction });
    }

    // Update Employee
    if (Object.keys(employeeUpdateData).length > 0) {
      await emp.update(employeeUpdateData, { transaction });
    }

    await saveEmployeeSalary(emp.id, salary, transaction);

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
