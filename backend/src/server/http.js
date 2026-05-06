function httpError(status, message, payload) {
  const e = new Error(message);
  e.status = status;
  if (payload !== undefined) e.payload = payload;
  return e;
}

module.exports = { httpError };

