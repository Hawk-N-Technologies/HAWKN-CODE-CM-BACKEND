const Company = require("./Company");
const CompanyProfile = require("./CompanyProfile");
const CompanyPolicy = require("./CompanyPolicy");
const CompanyRolesResponsibilities = require("./CompanyRolesResponsibilities");
const EmployeeHierarchyImage = require("./EmployeeHierarchyImage");
const User = require("./User");
const Role = require("./Role");
const Payroll = require("./Payroll");
const Employee = require("./Employee");

// Company → Users
Company.hasMany(User, {
  foreignKey: "companyId",
  as: "users",
});

User.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

// Role → Users
Role.hasMany(User, {
  foreignKey: "roleId",
  as: "users",
});

User.belongsTo(Role, {
  foreignKey: "roleId",
  as: "role",
});

// User → Employee
User.hasOne(Employee, {
  foreignKey: "userId",
  as: "employee",
});

Employee.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// Company → Employees
Company.hasMany(Employee, {
  foreignKey: "companyId",
  as: "employees",
});

Employee.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

// User → Payrolls (the employee being paid)
User.hasMany(Payroll, {
  foreignKey: "userId",
  as: "payrolls",
});

Payroll.belongsTo(User, {
  foreignKey: "userId",
  as: "employee",
});

Employee.hasMany(Attendance, {
  foreignKey: "employeeId",
  as: "attendances",
});

Attendance.belongsTo(Employee, {
  foreignKey: "employeeId",
  as: "employee",
});

Company.hasMany(Attendance, {
  foreignKey: "companyId",
  as: "attendances",
});

Attendance.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

module.exports = {
  Company,
  CompanyProfile,
  CompanyPolicy,
  CompanyRolesResponsibilities,
  EmployeeHierarchyImage,
  User,
  Role,
  Employee,
};
