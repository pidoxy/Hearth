export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_SCHEDULER === "true") return;
  const { runReminders } = await import("./lib/reminders");
  const tick = () => runReminders().catch((err) => console.error("[reminders]", err));
  // Every 15 minutes; reminders are idempotent so restarts and overlap are safe.
  setInterval(tick, 15 * 60_000).unref();
  setTimeout(tick, 30_000).unref();
}
