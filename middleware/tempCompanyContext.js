function tempCompanyContext(req, res, next) {
  req.user = { companyId: Number(process.env.DEFAULT_COMPANY_ID || 1) };
  next();
}

module.exports = tempCompanyContext;