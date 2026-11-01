// Postgres reports duplicate keys as 23505. Drizzle may wrap the driver error in `cause`.
export function isUniqueViolation(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  const causeCode =
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "code" in error.cause
      ? error.cause.code
      : undefined;

  return code === "23505" || causeCode === "23505";
}
