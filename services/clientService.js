const sequelize = require("../config/db");

const Client = require("../models/Client");
const User = require("../models/User");
const Role = require("../models/Role");
const bcrypt = require("bcrypt");

const createClient = async ({
  companyId,
  firstName,
  lastName,
  email,
  password,
  phone,
  companyName,
  address,
}) => {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const normalizedEmail = email.trim().toLowerCase();

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

    const clientRole = await Role.findOne({
      where: {
        name: "client",
      },
      transaction,
    });

    if (!clientRole) {
      throw new Error("Client role not found.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

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
      {
        transaction,
      },
    );

    const client = await Client.create(
      {
        userId: user.id,
        companyId,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return {
      id: client.id,
      uuid: client.uuid,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
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
      id: clientId,
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
  { firstName, lastName, email, password, phone, companyName, address },
) => {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const client = await Client.findOne({
      where: {
        id: clientId,
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

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();

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

    if (firstName !== undefined) {
      user.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      user.lastName = lastName?.trim() || null;
    }

    // Password is optional while editing.
    // If supplied, replace the old password.
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 12);
    }

    await user.save({ transaction });

    if (phone !== undefined) {
      client.phone = phone?.trim() || null;
    }

    if (companyName !== undefined) {
      client.companyName = companyName?.trim() || null;
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

module.exports = {
  createClient,
  getClients,
  getClientById,
  updateClient,
};
