// Runs once when the server starts: continue any audio generation that was interrupted
// (e.g. the computer was turned off mid-way), without waiting for someone to open the page.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureWorker } = await import("./lib/worker");
    ensureWorker();
  }
}
