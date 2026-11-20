"use strict";

/**
 * SOPs — Admin & HR create / edit / delete; every employee reads.
 * Always scoped to the user's company.
 */

const { Sop, User } = require("../models/associations");

const MAX_ROWS = 500;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const fullName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || null;

// Visible text of rich text, for the list preview and "is it empty?" checks
const plainText = (html) =>
  String(html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const editorInclude = [{ model: User, as: "editor", attributes: ["firstName", "lastName", "email"] }];

function toResponse(sop, { withContent }) {
  return {
    uuid: sop.uuid,
    title: sop.title,
    department: sop.department,
    effectiveDate: sop.effectiveDate,
    preview: plainText(sop.content).slice(0, 220),
    ...(withContent ? { content: sop.content } : {}),
    updatedBy: fullName(sop.editor),
    updatedAt: sop.updatedAt,
  };
}

async function listSops(user) {
  const rows = await Sop.findAll({
    where: { companyId: user.companyId },
    include: editorInclude,
    order: [["department", "ASC"], ["title", "ASC"]],
    limit: MAX_ROWS,
  });
  return rows.map((row) => toResponse(row, { withContent: false }));
}

async function findSop(user, uuid) {
  const sop = await Sop.findOne({ where: { uuid, companyId: user.companyId }, include: editorInclude });
  if (!sop) throw httpError(404, "SOP not found.");
  return sop;
}

async function getSop(user, uuid) {
  return toResponse(await findSop(user, uuid), { withContent: true });
}

function fields(body) {
  if (!plainText(body.content) && !/<img\s/i.test(body.content)) {
    throw httpError(400, "Write the procedure");
  }
  return {
    title: body.title.trim(),
    department: body.department,
    effectiveDate: body.effectiveDate || null,
    content: body.content,
  };
}

async function createSop(user, body) {
  const sop = await Sop.create({
    ...fields(body),
    companyId: user.companyId,
    createdBy: user.userId,
    updatedBy: user.userId,
  });
  return getSop(user, sop.uuid);
}

async function updateSop(user, uuid, body) {
  const sop = await findSop(user, uuid);
  await sop.update({ ...fields(body), updatedBy: user.userId });
  return getSop(user, uuid);
}

async function deleteSop(user, uuid) {
  const sop = await findSop(user, uuid);
  await sop.destroy();
  return { uuid };
}

module.exports = { listSops, getSop, createSop, updateSop, deleteSop };
