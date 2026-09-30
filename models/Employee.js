const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const Employee = sequelize.define(
  "Employee",
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

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: "user_id",
    },

    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "company_id",
    },

    phone1: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: "phone1",
    },

    phone2: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: "phone2",
    },

    whatsapp: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },

    joiningDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "joining_date",
    },

    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "date_of_birth",
    },

    linkedinUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "linkedin_url",
    },

    githubUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "github_url",
    },

    aadhaarLast4: {
      type: DataTypes.STRING(4),
      allowNull: true,
      field: "aadhaar_last4",
    },

    employmentType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Full Time",
      field: "employment_type",
      validate: {
        isIn: [["Full Time", "Intern", "Probation"]],
      },
    },

    employmentStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Active",
      field: "employment_status",
      validate: {
        isIn: [["Active", "On Leave", "Exited"]],
      },
    },

    photoUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "photo_url",
    },
  },
  {
    tableName: "employees",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Employee;
