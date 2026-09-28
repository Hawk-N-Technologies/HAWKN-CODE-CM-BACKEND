function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();

  return JSON.stringify({
    timestamp,
    level,
    message,
    ...(meta || {}),
  });
}

function info(message, meta) {
  console.log(formatMessage("info", message, meta));
}

function warn(message, meta) {
  console.warn(formatMessage("warn", message, meta));
}

function error(message, meta) {
  console.error(formatMessage("error", message, meta));
}

module.exports = {
  info,
  warn,
  error,
};
