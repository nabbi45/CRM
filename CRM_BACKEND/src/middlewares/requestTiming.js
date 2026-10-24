import { performance } from "node:perf_hooks";
export function requestTiming(req, res, next) {
  const start = performance.now();
  res.on("finish", () => {
    const ms = Math.round(performance.now() - start);
    // Do not log tokens, query strings, user IDs or request bodies.
    if (ms >= 1000 || res.statusCode >= 500) {
      const route =
        req.route?.path ||
        req.baseUrl ||
        req.path.split("/").slice(0, 2).join("/");
      console.warn(
        JSON.stringify({
          event: "slow_api",
          method: req.method,
          route,
          status: res.statusCode,
          ms,
        }),
      );
    }
  });
  next();
}
