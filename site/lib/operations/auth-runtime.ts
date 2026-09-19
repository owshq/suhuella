export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXTJS_ENV === "production"
  );
}
