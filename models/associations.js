const Company = require("./Company");
const CompanyProfile = require("./CompanyProfile");
const CompanyPolicy = require("./CompanyPolicy");
const CompanyRolesResponsibilities = require("./CompanyRolesResponsibilities");
const EmployeeHierarchyImage = require("./EmployeeHierarchyImage");
const User = require("./User");
const Role = require("./Role");
const Employee = require("./Employee");
const EmployeeOnboarding = require("./EmployeeOnboarding");

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

// Employee → Onboarding (one checklist per employee)
Employee.hasOne(EmployeeOnboarding, {
  foreignKey: "employeeId",
  as: "onboarding",
});

EmployeeOnboarding.belongsTo(Employee, {
  foreignKey: "employeeId",
  as: "employee",
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
  EmployeeOnboarding,
};