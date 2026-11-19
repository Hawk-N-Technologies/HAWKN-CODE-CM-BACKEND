const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      defaultValue: DataTypes.UUIDV4,
    },

    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "company_id",
    },

    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "role_id",
    },

    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "first_name",
    },

    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "last_name",
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    passwordHash: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "password_hash",
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },

    // Set automatically whenever the password changes (see hook below).
    // Logins made before this moment are rejected by authenticate().
    passwordChangedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "password_changed_at",
    },
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
    hooks: {
      // Every password change (Employees, People, Clients, Onboarding …)
      // goes through user.update()/save(), so one hook covers them all.
      beforeUpdate(user) {
        if (user.changed("passwordHash")) {
          user.passwordChangedAt = new Date();
        }

        // Password reset or deactivation → this person's phone/laptop
        // alerts stop too (a hacked account's devices lose access)
        user._revokeDevices =
          user.changed("passwordHash") ||
          (user.changed("isActive") && user.isActive === false);
      },
      async afterUpdate(user, options) {
        if (!user._revokeDevices) return;
        user._revokeDevices = false;

        const PushSubscription = require("./PushSubscription");
        await PushSubscription.destroy({
          where: { userId: user.id },
          transaction: options?.transaction,
        });
      },
    },
  },
);

module.exports = User;
