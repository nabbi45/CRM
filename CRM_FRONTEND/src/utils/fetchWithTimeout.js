// Always release the timer, including network failures and aborted requests.
export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        "The server is taking too long to respond. Please retry.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
