import { requestJson } from "./requestJson";
jest.mock("../components/LoginSignup", () => ({ apiUrl: "http://crm.test" }));
test("simultaneous reads share a request, but a later read gets fresh data", async () => {
  let release;
  global.fetch = jest.fn(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const first = requestJson("/summary", "account-one");
  const same = requestJson("/summary", "account-one");
  expect(first).toBe(same);
  expect(fetch).toHaveBeenCalledTimes(1);
  release({ ok: true, json: async () => ({ value: 1 }) });
  expect(await first).toEqual({ value: 1 });
  const later = requestJson("/summary", "account-one");
  expect(fetch).toHaveBeenCalledTimes(2);
  release({ ok: true, json: async () => ({ value: 2 }) });
  expect(await later).toEqual({ value: 2 });
});
test("different accounts never share a request", async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
  await Promise.all([
    requestJson("/summary", "account-two"),
    requestJson("/summary", "account-three"),
  ]);
  expect(fetch).toHaveBeenCalledTimes(2);
});
