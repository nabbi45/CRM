import { apiUrl } from "../components/LoginSignup";
import { fetchWithTimeout } from "./fetchWithTimeout";

// Share only an in-flight GET. Results are never cached across sessions or saves.
const pending = new Map();
export function requestJson(path, token) {
  const key = `${token}:${path}`;
  if (pending.has(key)) return pending.get(key);
  const promise = (async () => {
    const response = await fetchWithTimeout(`${apiUrl}${path}`, {
      headers: { Authorization: token || "" },
    });
    const data = await response.json().catch(() => {
      throw new Error("The server returned an invalid response. Please retry.");
    });
    if (!response.ok)
      throw new Error(data.message || "Unable to load this section.");
    return data;
  })().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
