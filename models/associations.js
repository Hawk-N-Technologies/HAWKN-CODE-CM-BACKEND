const Company = require("./Company");
const CompanyProfile = require("./CompanyProfile");
const CompanyPolicy = require("./CompanyPolicy");
const CompanyRolesResponsibilities = require("./CompanyRolesResponsibilities");
const EmployeeHierarchyImage = require("./EmployeeHierarchyImage");
const User = require("./User");
const Role = require("./Role");
const Payroll = require("./Payroll");
const Employee = require("./Employee");
const EmployeeOnboarding = require("./EmployeeOnboarding");
const Attendance = require("./Attendance");
const EmployeeSalary = require("./EmployeeSalary");
const EmployeeLeave = require("./EmployeeLeave");
const Client = require("./Client");
const Project = require("./Project");

// --------------------------------------------------
// Company → Users
// --------------------------------------------------

Company.hasMany(User, {
  foreignKey: "companyId",
  as: "users",
});

User.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

// --------------------------------------------------
// Role → Users
// --------------------------------------------------

Role.hasMany(User, {
  foreignKey: "roleId",
  as: "users",
});

User.belongsTo(Role, {
  foreignKey: "roleId",
  as: "role",
});

// --------------------------------------------------
// User → Employee
// --------------------------------------------------

User.hasOne(Employee, {
  foreignKey: "userId",
  as: "employee",
});

Employee.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// --------------------------------------------------
// Company → Employees
// --------------------------------------------------

Company.hasMany(Employee, {
  foreignKey: "companyId",
  as: "employees",
});

Employee.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

// --------------------------------------------------
// User → Client
// --------------------------------------------------

User.hasOne(Client, {
  foreignKey: "userId",
  as: "client",
});

Client.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// --------------------------------------------------
// Company → Clients
// --------------------------------------------------

Company.hasMany(Client, {
  foreignKey: "companyId",
  as: "clients",
});

Client.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

// --------------------------------------------------
// Employee → Onboarding
// --------------------------------------------------

Employee.hasOne(EmployeeOnboarding, {
  foreignKey: "employeeId",
  as: "onboarding",
});

EmployeeOnboarding.belongsTo(Employee, {
  foreignKey: "employeeId",
  as: "employee",
});

// --------------------------------------------------
// User → Payrolls
// --------------------------------------------------

User.hasMany(Payroll, {
  foreignKey: "userId",
  as: "payrolls",
});

Payroll.belongsTo(User, {
  foreignKey: "userId",
  as: "employee",
});

// --------------------------------------------------
// Employee → Salary
// --------------------------------------------------

Employee.hasOne(EmployeeSalary, {
  foreignKey: "employeeId",
  as: "salary",
});

EmployeeSalary.belongsTo(Employee, {
  foreignKey: "employeeId",
  as: "employee",
});

// --------------------------------------------------
// Employee → Attendance
// --------------------------------------------------

Employee.hasMany(Attendance, {
  foreignKey: "employeeId",
  as: "attendances",
});

Attendance.belongsTo(Employee, {
  foreignKey: "employeeId",
  as: "employee",
});

// --------------------------------------------------
// Company → Attendance
// --------------------------------------------------

Company.hasMany(Attendance, {
  foreignKey: "companyId",
  as: "attendances",
});

Attendance.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

// --------------------------------------------------
// Employee → Leave
// --------------------------------------------------

Employee.hasMany(EmployeeLeave, {
  foreignKey: "employeeId",
  as: "leaves",
});

EmployeeLeave.belongsTo(Employee, {
  foreignKey: "employeeId",
  as: "employee",
});

// --------------------------------------------------
// Client → Projects
// --------------------------------------------------

Client.hasMany(Project, {
  foreignKey: "clientId",
  as: "projects",
});

Project.belongsTo(Client, {
  foreignKey: "clientId",
  as: "client",
});

// --------------------------------------------------
// Employee → Projects as Project Lead
// --------------------------------------------------

Employee.hasMany(Project, {
  foreignKey: "projectLeadId",
  as: "ledProjects",
});

Project.belongsTo(Employee, {
  foreignKey: "projectLeadId",
  as: "projectLead",
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
  Attendance,
  EmployeeOnboarding,
  EmployeeLeave,
  Client,
  Project,
};
