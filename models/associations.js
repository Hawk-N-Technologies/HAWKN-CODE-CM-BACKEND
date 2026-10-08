const Company = require("./Company");
const CompanyProfile = require("./CompanyProfile");
const CompanyPolicy = require("./CompanyPolicy");
const CompanyRolesResponsibilities = require("./CompanyRolesResponsibilities");
const EmployeeHierarchyImage = require("./EmployeeHierarchyImage");

const User = require("./User");
const Role = require("./Role");

const Employee = require("./Employee");
const EmployeeOnboarding = require("./EmployeeOnboarding");
const EmployeeSalary = require("./EmployeeSalary");
const EmployeeLeave = require("./EmployeeLeave");
const Attendance = require("./Attendance");
const Payroll = require("./Payroll");

const Client = require("./Client");
const Project = require("./Project");

const BRD = require("./BRD");
const BRDVersion = require("./BRDVersion");
const BRDReview = require("./BRDReview");

/*
|--------------------------------------------------------------------------
| Company
|--------------------------------------------------------------------------
*/

Company.hasOne(CompanyProfile, {
  foreignKey: "companyId",
  as: "profile",
});

CompanyProfile.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

Company.hasOne(CompanyPolicy, {
  foreignKey: "companyId",
  as: "policy",
});

CompanyPolicy.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

Company.hasOne(CompanyRolesResponsibilities, {
  foreignKey: "companyId",
  as: "rolesResponsibilities",
});

CompanyRolesResponsibilities.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

Company.hasOne(EmployeeHierarchyImage, {
  foreignKey: "companyId",
  as: "employeeHierarchyImage",
});

EmployeeHierarchyImage.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

/*
|--------------------------------------------------------------------------
| Company - Users
|--------------------------------------------------------------------------
*/

Company.hasMany(User, {
  foreignKey: "companyId",
  as: "users",
});

User.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

/*
|--------------------------------------------------------------------------
| Role - Users
|--------------------------------------------------------------------------
*/

Role.hasMany(User, {
  foreignKey: "roleId",
  as: "users",
});

User.belongsTo(Role, {
  foreignKey: "roleId",
  as: "role",
});

/*
|--------------------------------------------------------------------------
| Company - Employees
|--------------------------------------------------------------------------
*/

Company.hasMany(Employee, {
  foreignKey: "companyId",
  as: "employees",
});

Employee.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

/*
|--------------------------------------------------------------------------
| User - Employee
|--------------------------------------------------------------------------
*/

User.hasOne(Employee, {
  foreignKey: "userId",
  as: "employee",
});

Employee.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

/*
|--------------------------------------------------------------------------
| Employee - Onboarding
|--------------------------------------------------------------------------
*/

Employee.hasOne(EmployeeOnboarding, {
  foreignKey: "employeeId",
  as: "onboarding",
});

EmployeeOnboarding.belongsTo(Employee, {
  foreignKey: "employeeId",
  as: "employee",
});

/*
|--------------------------------------------------------------------------
| Employee - Salary
|--------------------------------------------------------------------------
*/

Employee.hasMany(EmployeeSalary, {
  foreignKey: "employeeId",
  as: "salaries",
});

EmployeeSalary.belongsTo(Employee, {
  foreignKey: "employeeId",
  as: "employee",
});

/*
|--------------------------------------------------------------------------
| Employee - Attendance
|--------------------------------------------------------------------------
*/

Employee.hasMany(Attendance, {
  foreignKey: "employeeId",
  as: "attendances",
});

Attendance.belongsTo(Employee, {
  foreignKey: "employeeId",
  as: "employee",
});

/*
|--------------------------------------------------------------------------
| Company - Attendance
|--------------------------------------------------------------------------
*/

Company.hasMany(Attendance, {
  foreignKey: "companyId",
  as: "attendances",
});

Attendance.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

/*
|--------------------------------------------------------------------------
| Employee - Leave
|--------------------------------------------------------------------------
*/

Employee.hasMany(EmployeeLeave, {
  foreignKey: "employeeId",
  as: "leaves",
});

EmployeeLeave.belongsTo(Employee, {
  foreignKey: "employeeId",
  as: "employee",
});

/*
|--------------------------------------------------------------------------
| Company - Payroll
|--------------------------------------------------------------------------
*/

Company.hasMany(Payroll, {
  foreignKey: "companyId",
  as: "payrolls",
});

Payroll.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

/*
|--------------------------------------------------------------------------
| Employee - Payroll
|--------------------------------------------------------------------------
*/

Employee.hasMany(Payroll, {
  foreignKey: "employeeId",
  as: "payrolls",
});

Payroll.belongsTo(Employee, {
  foreignKey: "employeeId",
  as: "employee",
});

/*
|--------------------------------------------------------------------------
| Company - Clients
|--------------------------------------------------------------------------
*/

Company.hasMany(Client, {
  foreignKey: "companyId",
  as: "clients",
});

Client.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

/*
|--------------------------------------------------------------------------
| User - Client
|--------------------------------------------------------------------------
*/

User.hasOne(Client, {
  foreignKey: "userId",
  as: "client",
});

Client.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

/*
|--------------------------------------------------------------------------
| Client - Projects
|--------------------------------------------------------------------------
*/

Client.hasMany(Project, {
  foreignKey: "clientId",
  as: "projects",
});

Project.belongsTo(Client, {
  foreignKey: "clientId",
  as: "client",
});

/*
|--------------------------------------------------------------------------
| Company - Projects
|--------------------------------------------------------------------------
*/

Company.hasMany(Project, {
  foreignKey: "companyId",
  as: "projects",
});

Project.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

/*
|--------------------------------------------------------------------------
| Employee - Projects
|--------------------------------------------------------------------------
| Project Lead
*/

Employee.hasMany(Project, {
  foreignKey: "projectLeadId",
  as: "ledProjects",
});

Project.belongsTo(Employee, {
  foreignKey: "projectLeadId",
  as: "projectLead",
});

/*
|--------------------------------------------------------------------------
| BRD
|--------------------------------------------------------------------------
| One Project -> One BRD
*/

Project.hasOne(BRD, {
  foreignKey: "projectId",
  as: "brd",
});

BRD.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

/*
|--------------------------------------------------------------------------
| Company - BRD
|--------------------------------------------------------------------------
*/

Company.hasMany(BRD, {
  foreignKey: "companyId",
  as: "brds",
});

BRD.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

/*
|--------------------------------------------------------------------------
| Client - BRD
|--------------------------------------------------------------------------
*/

Client.hasMany(BRD, {
  foreignKey: "clientId",
  as: "brds",
});

BRD.belongsTo(Client, {
  foreignKey: "clientId",
  as: "client",
});

/*
|--------------------------------------------------------------------------
| User - BRD
|--------------------------------------------------------------------------
| User who created the BRD
*/

User.hasMany(BRD, {
  foreignKey: "createdBy",
  as: "createdBrds",
});

BRD.belongsTo(User, {
  foreignKey: "createdBy",
  as: "creator",
});

/*
|--------------------------------------------------------------------------
| BRD - BRD Versions
|--------------------------------------------------------------------------
*/

BRD.hasMany(BRDVersion, {
  foreignKey: "brdId",
  as: "versions",
});

BRDVersion.belongsTo(BRD, {
  foreignKey: "brdId",
  as: "brd",
});

/*
|--------------------------------------------------------------------------
| User - BRD Versions
|--------------------------------------------------------------------------
| User who uploaded the version
*/

User.hasMany(BRDVersion, {
  foreignKey: "uploadedBy",
  as: "uploadedBrdVersions",
});

BRDVersion.belongsTo(User, {
  foreignKey: "uploadedBy",
  as: "uploader",
});

/*
|--------------------------------------------------------------------------
| BRD - Reviews
|--------------------------------------------------------------------------
*/

BRD.hasMany(BRDReview, {
  foreignKey: "brdId",
  as: "reviews",
});

BRDReview.belongsTo(BRD, {
  foreignKey: "brdId",
  as: "brd",
});

/*
|--------------------------------------------------------------------------
| BRD Version - Reviews
|--------------------------------------------------------------------------
*/

BRDVersion.hasMany(BRDReview, {
  foreignKey: "brdVersionId",
  as: "reviews",
});

BRDReview.belongsTo(BRDVersion, {
  foreignKey: "brdVersionId",
  as: "version",
});

/*
|--------------------------------------------------------------------------
| User - BRD Reviews
|--------------------------------------------------------------------------
| Admin / Client who reviewed the BRD
*/

User.hasMany(BRDReview, {
  foreignKey: "reviewerId",
  as: "brdReviews",
});

BRDReview.belongsTo(User, {
  foreignKey: "reviewerId",
  as: "reviewer",
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
  EmployeeSalary,
  EmployeeLeave,
  Attendance,
  Payroll,

  Client,
  Project,

  BRD,
  BRDVersion,
  BRDReview,
};
