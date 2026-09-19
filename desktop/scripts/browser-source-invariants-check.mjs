function mayDeletePersistedBrowserSource(reason) {
  return reason !== "permission_missing";
}

if (mayDeletePersistedBrowserSource("permission_missing")) {
  throw new Error("A persisted browser source must never be deleted because permission is missing.");
}
if (!mayDeletePersistedBrowserSource("user_remove") || !mayDeletePersistedBrowserSource("clear_knowledge")) {
  throw new Error("Explicit remove and knowledge clear must still be allowed.");
}

console.log("BROWSER-LOCAL-DEVICE-STATE-001 invariant check passed");
