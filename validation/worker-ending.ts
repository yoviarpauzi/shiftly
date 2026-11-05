// Reads the contract-ending filter from the URL. Only ending=1 turns it on.
export function parseWorkerEnding(value: string | string[] | undefined): boolean {
  const first = Array.isArray(value) ? value[0] : value;

  return first === "1";
}
