const Company = require("./Company");
const CompanyProfile = require("./CompanyProfile");
const CompanyPolicy = require("./CompanyPolicy");
const CompanyRolesResponsibilities = require("./CompanyRolesResponsibilities");
const EmployeeHierarchyImage = require("./EmployeeHierarchyImage");
const User = require("./User");
const Role = require("./Role");
const Employee = require("./Employee");
const Payroll = require("./Payroll");
const EmployeeSalary = require("./EmployeeSalary");

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

// Employee → Salary structure (one per employee)
Employee.hasOne(EmployeeSalary, {
  foreignKey: "employeeId",
  as: "salary",
});

EmployeeSalary.belongsTo(Employee, {
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
  Payroll,
  EmployeeSalary,
};
