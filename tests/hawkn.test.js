"use strict";

/**
 * HawkN backend checks — run with:  npm test
 *
 * Builds a fresh test database (TEST_DATABASE_URL, name must end in "_test"),
 * starts the real server, and checks what must never break:
 *   - project access control (P0)
 *   - the bug flow: lead → developer → lead → tester → lead (P0)
 *   - safe responses + timezone (P1)
 *   - security headers + CORS (P2)
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const helpers = require("./helpers");

process.env.DATABASE_URL = helpers.testDatabaseUrl();
const sequelize = require("../config/db");

const PASSWORD = "Test@1234";
const q = (sql, replacements = {}) =>
  sequelize.query(sql, { replacements, type: "SELECT" });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const one = async (sql, replacements) => (await q(sql, replacements))[0];

let server;
const S = {}; // logged-in sessions
const D = {}; // ids of test data

// ---------------------------------------------------------------------------
// Test data: Company A (2 projects) + Company B (1 project)
// ---------------------------------------------------------------------------

async function createUser(companyId, role, firstName, lastName, email, hash) {
  await run(
    `INSERT INTO users (company_id, role_id, first_name, last_name, email, password_hash)
     VALUES (:companyId, (SELECT id FROM roles WHERE name = :role), :firstName, :lastName, :email, :hash)`,
    { companyId, role, firstName, lastName, email, hash },
  );

  if (!["admin", "client"].includes(role)) {
    await run(
      `INSERT INTO employees (user_id, company_id, joining_date)
       SELECT id, company_id, '2026-01-01' FROM users WHERE email = :email`,
      { email },
    );
  }
}

const employeeId = async (email) =>
  (
    await one(
      `SELECT e.id FROM employees e JOIN users u ON u.id = e.user_id WHERE u.email = :email`,
      { email },
    )
  ).id;

async function createClient(adminSession, firstName, email) {
  const res = await adminSession.request("POST", "/clients", {
    firstName,
    lastName: "Client",
    email,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    type: "converted",
    phone: "9876543210",
  });
  assert.equal(res.status, 201, `create client ${email}: ${JSON.stringify(res.body)}`);
}

async function createProject(adminSession, name, clientName, leadName) {
  const options = (await adminSession.request("GET", "/admin/projects/options")).body.data;
  const client = options.clients.find((item) => item.name === clientName);
  const lead = options.projectLeads.find((item) => item.fullName === leadName);

  const res = await adminSession.request("POST", "/admin/projects", {
    name,
    clientUuid: client.uuid,
    projectLeadUuid: lead.uuid,
    projectType: "Website",
  });
  assert.equal(res.status, 201, `create project ${name}: ${JSON.stringify(res.body)}`);

  // the API only exposes the UUID; tests also need the internal id
  const row = await one(`SELECT id FROM projects WHERE uuid = :uuid`, { uuid: res.body.data.uuid });
  return { ...res.body.data, id: row.id };
}

async function createTeam(project, companyId, leadEmail, testerEmail, developerEmails = []) {
  await run(
    `INSERT INTO project_operations (project_id, company_id, project_lead_id, tester_id)
     VALUES (:projectId, :companyId, :leadId, :testerId)`,
    {
      projectId: project.id,
      companyId,
      leadId: await employeeId(leadEmail),
      testerId: await employeeId(testerEmail),
    },
  );

  const operation = await one(
    `SELECT id FROM project_operations WHERE project_id = :projectId`,
    { projectId: project.id },
  );

  await run(
    `INSERT INTO project_operation_testers (project_operation_id, employee_id) VALUES (:op, :emp)`,
    { op: operation.id, emp: await employeeId(testerEmail) },
  );

  for (const email of developerEmails) {
    await run(
      `INSERT INTO project_operation_developers (project_operation_id, employee_id) VALUES (:op, :emp)`,
      { op: operation.id, emp: await employeeId(email) },
    );
  }
}

before(async () => {
  await helpers.resetDatabase(sequelize);
  server = await helpers.startServer();

  const hash = await bcrypt.hash(PASSWORD, 10);
  await run(`INSERT INTO companies (name) VALUES ('Company B')`);
  const companyA = (await one(`SELECT company_id AS id FROM users WHERE email = 'admin@gmail.com'`)).id;
  const companyB = (await one(`SELECT id FROM companies WHERE name = 'Company B'`)).id;
  D.companyA = companyA;

  const users = [
    [companyA, "developer", "Lead", "A", "lead.a@test.com"],
    [companyA, "developer", "Lead", "A2", "lead.a2@test.com"],
    [companyA, "developer", "Team", "Dev", "team.dev@test.com"],
    [companyA, "tester", "Tester", "A", "tester.a@test.com"],
    [companyA, "tester", "Tester", "A2", "tester.a2@test.com"],
    [companyB, "admin", "Admin", "B", "admin.b@test.com"],
    [companyB, "developer", "Lead", "B", "lead.b@test.com"],
    [companyB, "tester", "Tester", "B", "tester.b@test.com"],
  ];
  for (const [companyId, role, first, last, email] of users) {
    await createUser(companyId, role, first, last, email, hash);
  }
  // onboarded user who has no password yet
  await run(
    `INSERT INTO users (company_id, role_id, first_name, email)
     VALUES (:companyA, (SELECT id FROM roles WHERE name = 'developer'), 'NoPass', 'nopass@test.com')`,
    { companyA },
  );

  S.adminA = await helpers.Session.login("admin@gmail.com", "Admin@123");
  S.adminB = await helpers.Session.login("admin.b@test.com", PASSWORD);

  await createClient(S.adminA, "Alpha", "client.a@test.com");
  await createClient(S.adminB, "Beta", "client.b@test.com");

  D.projectA = await createProject(S.adminA, "A Project", "Alpha Client", "Lead A");
  D.projectA2 = await createProject(S.adminA, "A Project 2", "Alpha Client", "Lead A2");
  D.projectB = await createProject(S.adminB, "B Project", "Beta Client", "Lead B");

  await createTeam(D.projectA, companyA, "lead.a@test.com", "tester.a@test.com", ["team.dev@test.com"]);
  await createTeam(D.projectA2, companyA, "lead.a2@test.com", "tester.a2@test.com");
  await createTeam(D.projectB, companyB, "lead.b@test.com", "tester.b@test.com");

  for (const [key, email] of Object.entries({
    leadA: "lead.a@test.com",
    leadA2: "lead.a2@test.com",
    teamDev: "team.dev@test.com",
    testerA: "tester.a@test.com",
    testerA2: "tester.a2@test.com",
    leadB: "lead.b@test.com",
    testerB: "tester.b@test.com",
    clientA: "client.a@test.com",
    clientB: "client.b@test.com",
  })) {
    S[key] = await helpers.Session.login(email, PASSWORD);
  }

  D.teamDevId = await employeeId("team.dev@test.com");
  D.leadA2Id = await employeeId("lead.a2@test.com");
  D.leadBId = await employeeId("lead.b@test.com");

  // Company B module + a bug in A Project 2
  const moduleB = await S.leadB.request("POST", `/projects/${D.projectB.uuid}/modules`, { name: "B Payments" });
  assert.equal(moduleB.status, 201);
  D.moduleB = moduleB.body.data;

  await run(
    `INSERT INTO project_bugs (project_id, title, severity, status, discovery_source)
     VALUES (:projectId, 'A2 bug', 'Low', 'Open', 'Testing')`,
    { projectId: D.projectA2.id },
  );
  D.bugA2 = (await one(`SELECT uuid FROM project_bugs WHERE title = 'A2 bug'`)).uuid;

  // BRDs (one per company) with a version each
  for (const project of [D.projectA, D.projectB]) {
    await run(
      `INSERT INTO brds (project_id, company_id, client_id, title, status, created_by)
       SELECT p.id, p.company_id, p.client_id, :title, 'PENDING_ADMIN_APPROVAL', 1
       FROM projects p WHERE p.id = :projectId`,
      { projectId: project.id, title: `BRD of ${project.name}` },
    );
  }
  await run(
    `INSERT INTO brd_versions (brd_id, version, file_name, file_url, storage_key, mime_type, file_size, uploaded_by)
     SELECT id, 1, 'v1.pdf', '/x', 'missing-on-disk.pdf', 'application/pdf', 10, 1 FROM brds`,
  );
});

after(async () => {
  if (server) server.kill();
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// P0 — access control
// ---------------------------------------------------------------------------

describe("Access control: another company's project", () => {
  it("can't list, read, create, edit or delete its modules", async () => {
    const { leadA } = S;
    assert.equal((await leadA.request("GET", `/projects/${D.projectB.uuid}/modules`)).status, 404);
    assert.equal((await leadA.request("GET", `/modules/${D.moduleB.uuid}`)).status, 404);
    assert.equal((await leadA.request("POST", `/projects/${D.projectB.uuid}/modules`, { name: "x" })).status, 404);
    assert.equal((await leadA.request("PUT", `/modules/${D.moduleB.uuid}`, { name: "x" })).status, 404);
    assert.equal((await leadA.request("DELETE", `/modules/${D.moduleB.uuid}`)).status, 404);

    const still = await one(`SELECT name FROM project_modules WHERE uuid = :uuid`, { uuid: D.moduleB.uuid });
    assert.equal(still.name, "B Payments");
  });

  it("can't see its tasks, Kanban or bugs", async () => {
    const { leadA } = S;
    assert.equal((await leadA.request("GET", `/projects/${D.projectB.uuid}/tasks`)).status, 404);
    assert.equal((await leadA.request("GET", `/kanban/projects/${D.projectB.uuid}`)).status, 404);
    assert.equal((await leadA.request("GET", `/bugs/projects/${D.projectB.uuid}/bugs`)).status, 404);
  });
});

describe("Access control: same company, wrong project", () => {
  it("only the lead of THIS project can change it", async () => {
    const res = await S.leadA2.request("POST", `/projects/${D.projectA.uuid}/modules`, { name: "x" });
    assert.equal(res.status, 403);
  });

  it("a tester can't touch a project they don't test", async () => {
    const create = await S.testerA.request("POST", "/bugs/createByTester", { projectId: D.projectA2.uuid, title: "x" });
    assert.equal(create.status, 403);

    const edit = await S.testerA.request("PATCH", `/bugs/tester/bugs/${D.bugA2}`, {
      title: "x", status: "Open", severity: "Low", discoverySource: "Testing",
    });
    assert.equal(edit.status, 403);
  });

  it("dropdowns only show the user's own projects and team", async () => {
    const developers = (await S.leadA.request("GET", "/bugs/developers")).body.data;
    assert.deepEqual(developers.map((item) => item.name), ["Team Dev"]);

    const testerProjects = (await S.testerA.request("GET", "/bugs/projects-dropdown")).body.data;
    assert.deepEqual(testerProjects.map((item) => item.name), ["A Project"]);

    const leadProjects = (await S.leadA.request("GET", "/bugs/projects-dropdown")).body.data;
    assert.deepEqual(leadProjects.map((item) => item.name), ["A Project"]);
  });

  it("clients only see their own project", async () => {
    assert.equal((await S.clientA.request("GET", `/projects/${D.projectA.uuid}/modules`)).status, 200);
    assert.equal((await S.clientB.request("GET", `/projects/${D.projectA.uuid}/modules`)).status, 404);
  });
});

describe("Lead's own work still works", () => {
  it("creates and edits modules, phases and tasks", async () => {
    const created = await S.leadA.request("POST", `/projects/${D.projectA.uuid}/modules`, { name: "Payments" });
    assert.equal(created.status, 201);
    D.moduleA = created.body.data;

    assert.equal((await S.leadA.request("PUT", `/modules/${D.moduleA.uuid}`, { name: "Payments v2" })).status, 200);

    const phase = await S.leadA.request("POST", `/projects/${D.projectA.uuid}/modules/${D.moduleA.uuid}/phases`, { name: "Phase 1" });
    assert.equal(phase.status, 201);

    const task = await S.leadA.request("POST", `/projects/${D.projectA.uuid}/tasks`, {
      title: "Build API", moduleId: D.moduleA.id, phaseId: phase.body.data.id, assignedTo: D.teamDevId,
    });
    assert.equal(task.status, 201);

    const dropdown = await S.leadA.request("GET", `/task-dropdown/${phase.body.data.uuid}`);
    assert.deepEqual(dropdown.body.data.map((item) => item.name), ["Build API"]);
  });

  it("can't assign a task to another company's employee (clear 400)", async () => {
    const res = await S.leadA.request("POST", `/projects/${D.projectA.uuid}/tasks`, { title: "x", assignedTo: D.leadBId });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /must belong/);
  });
});

// ---------------------------------------------------------------------------
// P0 — bug flow: lead → developer → lead → tester → lead
// ---------------------------------------------------------------------------

describe("Bug flow", () => {
  const bugStatus = async (uuid) =>
    one(`SELECT status, assigned_to AS "assignedTo" FROM project_bugs WHERE uuid = :uuid`, { uuid });
  const attempts = async (uuid) =>
    (await q(
      `SELECT attempt_number AS n, status FROM bug_testing
       WHERE bug_id = (SELECT id FROM project_bugs WHERE uuid = :uuid) ORDER BY attempt_number`,
      { uuid },
    )).map((row) => `${row.n}:${row.status}`);

  it("lead can only assign bugs to developers on the project's team", async () => {
    const notTeam = await S.leadA.request("POST", "/bugs/createBug", { projectId: D.projectA.uuid, title: "x", assignedTo: D.leadA2Id });
    assert.equal(notTeam.status, 400);

    const otherCompany = await S.leadA.request("POST", "/bugs/createBug", { projectId: D.projectA.uuid, title: "x", assignedTo: D.leadBId });
    assert.equal(otherCompany.status, 400);
  });

  it("goes lead → developer → lead → tester → back to lead → closed", async () => {
    const created = await S.leadA.request("POST", "/bugs/createBug", {
      projectId: D.projectA.uuid, title: "Login breaks", severity: "High",
      discoverySource: "Development", assignedTo: D.teamDevId,
    });
    assert.equal(created.status, 201);
    const bug = created.body.data.uuid;
    assert.deepEqual(await bugStatus(bug), { status: "Assigned", assignedTo: D.teamDevId });

    // visible to lead, tester and the assigned developer
    assert.ok((await S.leadA.request("GET", `/bugs/projects/${D.projectA.uuid}/bugs`)).body.data.some((b) => b.uuid === bug));
    assert.ok((await S.testerA.request("GET", "/bugs/tester/bugs")).body.data.some((b) => b.uuid === bug));
    assert.ok((await S.teamDev.request("GET", `/bugs/projects/${D.projectA.id}/assigned-bugs`)).body.data.some((b) => b.uuid === bug));
    assert.ok((await S.teamDev.request("GET", `/bugs/projects/${D.projectA.uuid}/assigned-bugs`)).body.data.some((b) => b.uuid === bug));

    // another developer can't touch it
    assert.equal((await S.leadA2.request("PUT", `/bugs/developer/${bug}/status`, { status: "Fixed" })).status, 404);

    // developer fixes
    assert.equal((await S.teamDev.request("PUT", `/bugs/developer/${bug}/status`, { status: "In Progress" })).status, 200);
    assert.equal((await S.teamDev.request("PUT", `/bugs/developer/${bug}/status`, { status: "Fixed" })).status, 200);

    // tester can't close before the lead sends it for retest
    const early = await S.testerA.request("PATCH", `/bugs/tester/bugs/${bug}`, {
      title: "Login breaks", status: "Closed", severity: "High", discoverySource: "Development",
    });
    assert.equal(early.status, 409);

    // lead → retest (attempt 1)
    assert.equal((await S.leadA.request("PATCH", `/bugs/projects/${D.projectA.uuid}/bugs/${bug}`, { status: "Ready for Retest" })).status, 200);
    assert.deepEqual(await attempts(bug), ["1:Pending"]);
    assert.equal((await S.teamDev.request("PUT", `/bugs/developer/${bug}/status`, { status: "In Progress" })).status, 409);

    // tester reopens → back to the lead, developer no longer sees it
    const reopen = await S.testerA.request("PATCH", `/bugs/tester/bugs/${bug}`, {
      title: "Login breaks", status: "Reopened", severity: "High", discoverySource: "Development",
    });
    assert.equal(reopen.status, 200);
    assert.deepEqual(await bugStatus(bug), { status: "Reopened", assignedTo: null });
    assert.deepEqual(await attempts(bug), ["1:Failed"]);

    // lead reassigns, developer fixes, retest attempt 2, tester closes
    assert.equal((await S.leadA.request("PATCH", `/bugs/projects/${D.projectA.uuid}/bugs/${bug}`, { assignedTo: D.teamDevId, status: "Assigned" })).status, 200);
    assert.equal((await S.teamDev.request("PUT", `/bugs/developer/${bug}/status`, { status: "Fixed" })).status, 200);
    assert.equal((await S.leadA.request("PATCH", `/bugs/projects/${D.projectA.uuid}/bugs/${bug}`, { status: "Ready for Retest" })).status, 200);
    assert.deepEqual(await attempts(bug), ["1:Failed", "2:Pending"]);

    const close = await S.testerA.request("PATCH", `/bugs/tester/bugs/${bug}`, {
      title: "Login breaks", status: "Closed", severity: "High", discoverySource: "Development",
    });
    assert.equal(close.status, 200);
    assert.deepEqual(await attempts(bug), ["1:Failed", "2:Passed"]);
    assert.equal((await S.teamDev.request("PUT", `/bugs/developer/${bug}/status`, { status: "In Progress" })).status, 409);
  });

  it("a tester's bug always goes to the lead (Open, unassigned)", async () => {
    const created = await S.testerA.request("POST", "/bugs/createByTester", {
      projectId: D.projectA.uuid, moduleId: D.moduleA.uuid, title: "Typo",
      severity: "Low", status: "Closed", assignedTo: D.teamDevId,
    });
    assert.equal(created.status, 201);
    assert.deepEqual(await bugStatus(created.body.data.uuid), { status: "Open", assignedTo: null });

    const assign = await S.testerA.request("PATCH", `/bugs/tester/bugs/${created.body.data.uuid}`, {
      title: "Typo", status: "Assigned", severity: "Low", discoverySource: "Testing",
    });
    assert.equal(assign.status, 409);

    const move = await S.testerA.request("PATCH", `/bugs/tester/bugs/${created.body.data.uuid}`, {
      projectId: D.projectA2.uuid, title: "Typo", status: "Open", severity: "Low", discoverySource: "Testing",
    });
    assert.equal(move.status, 400);
  });
});

// ---------------------------------------------------------------------------
// P0 — BRD and login
// ---------------------------------------------------------------------------

describe("BRD and login", () => {
  const version = async (projectName) =>
    (await one(
      `SELECT v.uuid FROM brd_versions v JOIN brds b ON b.id = v.brd_id WHERE b.title = :title`,
      { title: `BRD of ${projectName}` },
    )).uuid;

  it("admin can open and approve ANY company's BRD", async () => {
    const brdB = await one(`SELECT id, uuid FROM brds WHERE title = 'BRD of B Project'`);
    assert.equal((await S.adminA.request("GET", `/brds/admin/${brdB.id}`)).status, 200);
    assert.equal((await S.adminA.request("GET", `/brds/admin/${brdB.uuid}`)).status, 200);
    assert.equal((await S.adminA.request("PATCH", `/brds/admin/${brdB.id}/decision`, { action: "APPROVED" })).status, 200);
  });

  it("clients can only download their own BRD file", async () => {
    const own = await S.clientA.request("GET", `/brds/versions/${await version("A Project")}/file`);
    assert.notEqual(own.body?.message, "BRD file not found"); // passed the access check

    const other = await S.clientB.request("GET", `/brds/versions/${await version("A Project")}/file`);
    assert.equal(other.status, 404);
    assert.equal(other.body.message, "BRD file not found");
  });

  it("a user without a password gets a clear 401", async () => {
    const res = await new helpers.Session().request("POST", "/auth/login", { email: "nopass@test.com", password: "anything" });
    assert.equal(res.status, 401);
    assert.match(res.body.message, /not activated/);
  });
});

// ---------------------------------------------------------------------------
// P1 — responses + timezone,  P2 — headers + CORS
// ---------------------------------------------------------------------------

describe("Responses, timezone, security headers", () => {
  it("every JSON response has `success`", async () => {
    const ok = await S.leadA.request("GET", `/projects/${D.projectA.uuid}/modules`);
    assert.equal(ok.body.success, true);

    const bad = await S.leadA.request("POST", `/projects/${D.projectA.uuid}/modules`, {});
    assert.equal(bad.status, 400);
    assert.equal(bad.body.success, false);
  });

  it("database time zone is India time", async () => {
    const row = await one(
      `SELECT current_setting('TimeZone') AS tz,
              (TIMESTAMPTZ '2026-11-11 09:00:00+05:30')::date::text AS day`,
    );
    assert.equal(row.tz, "Asia/Kolkata");
    assert.equal(row.day, "2026-11-11");
  });

  it("sends security headers and hides the server type", async () => {
    const res = await S.leadA.request("GET", `/projects/${D.projectA.uuid}/modules`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(res.headers.get("cross-origin-resource-policy"), "same-site");
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  it("CORS allows the portal with credentials, and nobody else", async () => {
    const portal = await fetch(`${helpers.BASE}/auth/me`, {
      headers: { Origin: "https://clientportal.hawkntechnologies.com" },
    });
    assert.equal(portal.headers.get("access-control-allow-origin"), "https://clientportal.hawkntechnologies.com");
    assert.equal(portal.headers.get("access-control-allow-credentials"), "true");

    const stranger = await fetch(`${helpers.BASE}/auth/me`, { headers: { Origin: "https://evil.example.com" } });
    assert.equal(stranger.headers.get("access-control-allow-origin"), null);
  });
});


// ---------------------------------------------------------------------------
// P3 (A) — pages connected to real data
// ---------------------------------------------------------------------------

describe("Project task list (Project Progress / Tasks pages)", () => {
  it("returns the project's tasks in `data`", async () => {
    const res = await S.leadA.request("GET", `/projects/${D.projectA.uuid}/tasks`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data), "data must be an array");
    assert.ok(res.body.data.some((task) => task.title === "Build API"));
  });

  it("another company's lead still can't read them", async () => {
    assert.equal((await S.leadB.request("GET", `/projects/${D.projectA.uuid}/tasks`)).status, 404);
  });
});

describe("Retesting (tester)", () => {
  const sendForRetest = async (title) => {
    const created = await S.leadA.request("POST", "/bugs/createBug", {
      projectId: D.projectA.uuid, title, severity: "Medium",
      discoverySource: "Development", assignedTo: D.teamDevId,
    });
    const uuid = created.body.data.uuid;
    await S.teamDev.request("PUT", `/bugs/developer/${uuid}/status`, { status: "Fixed" });
    await S.leadA.request("PATCH", `/bugs/projects/${D.projectA.uuid}/bugs/${uuid}`, { status: "Ready for Retest" });
    return uuid;
  };

  it("queue shows only the tester's projects, waiting bugs first", async () => {
    const uuid = await sendForRetest("Retest me");
    const mine = (await S.testerA.request("GET", "/bugs/tester/retests")).body.data;
    const row = mine.find((item) => item.uuid === uuid);
    assert.ok(row, "bug is in tester A's queue");
    assert.equal(row.result, "Pending");
    assert.equal(row.canRecord, true);
    assert.equal(mine[0].canRecord, true);

    const other = (await S.testerA2.request("GET", "/bugs/tester/retests")).body.data;
    assert.ok(!other.some((item) => item.uuid === uuid), "tester A2 doesn't see it");
  });

  it("Failed needs a note, then goes back to the lead (Reopened, unassigned)", async () => {
    const uuid = await sendForRetest("Fails retest");
    assert.equal((await S.testerA.request("PATCH", `/bugs/tester/retests/${uuid}`, { result: "Failed" })).status, 400);

    const failed = await S.testerA.request("PATCH", `/bugs/tester/retests/${uuid}`, { result: "Failed", testNotes: "Still broken" });
    assert.equal(failed.status, 200);

    const bug = await one(`SELECT status, assigned_to AS "assignedTo" FROM project_bugs WHERE uuid = :uuid`, { uuid });
    assert.deepEqual(bug, { status: "Reopened", assignedTo: null });

    // can't record twice
    assert.equal((await S.testerA.request("PATCH", `/bugs/tester/retests/${uuid}`, { result: "Passed" })).status, 409);
  });

  it("Passed closes the bug; other testers and companies can't record", async () => {
    const uuid = await sendForRetest("Passes retest");
    assert.equal((await S.testerA2.request("PATCH", `/bugs/tester/retests/${uuid}`, { result: "Passed" })).status, 403);
    assert.equal((await S.testerB.request("PATCH", `/bugs/tester/retests/${uuid}`, { result: "Passed" })).status, 404);

    assert.equal((await S.testerA.request("PATCH", `/bugs/tester/retests/${uuid}`, { result: "Passed" })).status, 200);
    const bug = await one(`SELECT status FROM project_bugs WHERE uuid = :uuid`, { uuid });
    assert.equal(bug.status, "Closed");
  });
});

describe("Employee hierarchy (admin uploads, HR views)", () => {
  // smallest valid PNG (1×1 pixel)
  const PNG = Buffer.from(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63F8CFC0F01F0005000201E2D8E2A90000000049454E44AE426082",
    "hex",
  );

  const upload = async (session, name, type, bytes) => {
    const form = new FormData();
    form.append("images", new Blob([bytes], { type }), name);
    const res = await fetch(`${helpers.BASE}/company/hierarchy`, {
      method: "POST",
      headers: { Cookie: session.cookie },
      body: form,
    });
    return { status: res.status, body: await res.json() };
  };

  it("admin uploads an image; HR can list and view it", async () => {
    const res = await upload(S.adminA, "org.png", "image/png", PNG);
    assert.equal(res.status, 201, JSON.stringify(res.body));

    S.hrA = await helpers.Session.login("hr@gmail.com", "Hr@12345");
    const list = await S.hrA.request("GET", "/company/hierarchy");
    assert.equal(list.status, 200);
    D.imageUuid = list.body.data[0].uuid;
    assert.ok(!String(list.body.data[0].fileUrl).includes("/"), "no server path is exposed");

    const file = await fetch(`${helpers.BASE}/company/hierarchy/${D.imageUuid}/file`, {
      headers: { Cookie: S.hrA.cookie },
    });
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "image/png");
  });

  it("only admins upload; wrong file types get a clear 400", async () => {
    assert.equal((await upload(S.hrA, "x.png", "image/png", PNG)).status, 403);

    const bad = await upload(S.adminA, "notes.txt", "text/plain", Buffer.from("hi"));
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /PNG, JPG or WEBP/);
  });

  it("other companies and other roles can't see it", async () => {
    const otherCompany = await fetch(`${helpers.BASE}/company/hierarchy/${D.imageUuid}/file`, {
      headers: { Cookie: S.adminB.cookie },
    });
    assert.equal(otherCompany.status, 404);
    assert.equal((await S.leadA.request("GET", "/company/hierarchy")).status, 403);
  });
});