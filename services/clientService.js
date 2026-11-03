const sequelize = require("../config/db");

const Client = require("../models/Client");
const User = require("../models/User");
const Role = require("../models/Role");
const bcrypt = require("bcrypt");
const Project = require("../models/Project");

const createClient = async ({
  companyId,
  firstName,
  lastName,
  email,
  password,
  type,
  gst,
  domain,
  phone,
  companyName,
  address,
}) => {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Check existing user within company
    const existingUser = await User.findOne({
      where: {
        companyId,
        email: normalizedEmail,
      },
      transaction,
    });

    if (existingUser) {
      throw new Error("A user with this email already exists.");
    }

    // Find client role
    const clientRole = await Role.findOne({
      where: {
        name: "client",
      },
      transaction,
    });

    if (!clientRole) {
      throw new Error("Client role not found.");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create(
      {
        companyId,
        roleId: clientRole.id,
        firstName: firstName.trim(),
        lastName: lastName?.trim() || null,
        email: normalizedEmail,
        passwordHash,
        isActive: true,
      },
      { transaction },
    );

    // Create client
    const client = await Client.create(
      {
        userId: user.id,
        companyId,
        type,
        gst: gst?.trim() || null,
        domain: domain?.trim().toLowerCase() || null,
        phone: phone?.trim() || null,
        companyName: companyName?.trim() || null,
        address: address?.trim() || null,
      },
      { transaction },
    );

    await transaction.commit();

    return {
      id: client.id,
      uuid: client.uuid,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      type: client.type,
      gst: client.gst,
      domain: client.domain,
      phone: client.phone,
      companyName: client.companyName,
      address: client.address,
      roleId: clientRole.id,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getClients = async (companyId) => {
  const clients = await Client.findAll({
    where: {
      companyId,
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: [
          "id",
          "uuid",
          "firstName",
          "lastName",
          "email",
          "isActive",
          "roleId",
        ],
        include: [
          {
            model: Role,
            as: "role",
            attributes: ["id", "name"],
          },
        ],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return clients;
};

const getClientById = async (clientId, companyId) => {
  const client = await Client.findOne({
    where: {
      uuid: clientId,
      companyId,
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: [
          "id",
          "uuid",
          "firstName",
          "lastName",
          "email",
          "isActive",
          "roleId",
        ],
        include: [
          {
            model: Role,
            as: "role",
            attributes: ["id", "name"],
          },
        ],
      },
    ],
  });

  if (!client) {
    throw new Error("Client not found.");
  }

  return client;
};

const updateClient = async (
  clientId,
  companyId,
  { firstName, lastName, email, password, type, gst, domain, phone, address },
) => {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const client = await Client.findOne({
      where: {
        uuid: clientId,
        companyId,
      },
      transaction,
    });

    if (!client) {
      throw new Error("Client not found.");
    }

    const user = await User.findOne({
      where: {
        id: client.userId,
        companyId,
      },
      transaction,
    });

    if (!user) {
      throw new Error("Client user not found.");
    }

    // Email validation and duplicate check
    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        throw new Error("Email is required.");
      }

      const existingUser = await User.findOne({
        where: {
          companyId,
          email: normalizedEmail,
        },
        transaction,
      });

      if (existingUser && existingUser.id !== user.id) {
        throw new Error("A user with this email already exists.");
      }

      user.email = normalizedEmail;
    }

    // User fields
    if (firstName !== undefined) {
      if (!firstName.trim()) {
        throw new Error("First name is required.");
      }

      user.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      user.lastName = lastName?.trim() || null;
    }

    // Password is optional during editing
    if (password) {
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long.");
      }

      user.passwordHash = await bcrypt.hash(password, 12);
    }

    await user.save({ transaction });

    // Client fields
    if (type !== undefined) {
      const allowedTypes = ["lead", "converted"];

      if (!allowedTypes.includes(type)) {
        throw new Error("Type must be either lead or converted.");
      }

      client.type = type;
    }

    if (gst !== undefined) {
      client.gst = gst?.trim() || null;
    }

    if (domain !== undefined) {
      client.domain = domain?.trim().toLowerCase() || null;
    }

    if (phone !== undefined) {
      client.phone = phone?.trim() || null;
    }

    if (address !== undefined) {
      client.address = address?.trim() || null;
    }

    await client.save({ transaction });

    await transaction.commit();

    return getClientById(clientId, companyId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

async function clientProjectsDropdown(userId) {
  try {
    const client = await Client.findOne({
      where: {
        userId: userId,
      },
    });
    console.log(client);
    const projects = await Project.findAll({
      where: {
        clientId: client.id,
      },
      attributes: ["id", "uuid", "name"],
    });

    return projects;
  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  createClient,
  getClients,
  getClientById,
  updateClient,
  clientProjectsDropdown,
};
