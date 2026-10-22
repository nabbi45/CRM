import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import HRMOnboarding, { employeeTour, adminTour } from "./HRMOnboarding";

const data = {
  today: "2026-10-22",
  activationDate: "",
  isHR: false,
  isSystem: false,
  onboarding: { tourVersion: 0, database: { transactionsSupported: true } },
  employees: [
    {
      userId: "one",
      name: "Existing Employee",
      hasProfile: true,
      department: "Admin",
      gender: "Female",
      branch: "Delhi",
      dateOfJoining: "2020-01-01",
      eligible: true,
    },
  ],
  ledger: [],
  policies: [],
  policy: {},
};
const open = (overrides = {}) => {
  const api = jest.fn().mockResolvedValue({}),
    reload = jest.fn().mockResolvedValue();
  render(
    <HRMOnboarding
      data={{ ...data, ...overrides }}
      api={api}
      reload={reload}
      navigate={jest.fn()}
    />,
  );
  return { api, reload };
};
test("employee receives one-time tour and completion is saved only at finish", async () => {
  const { api } = open();
  expect(screen.getByText("Welcome to HRM Portal")).toBeVisible();
  for (let i = 1; i < employeeTour.length; i++)
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Finish tour" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("/tour/complete", "POST", {}),
  );
});
test("completed employee is not interrupted and can replay tour", () => {
  open({ onboarding: { tourVersion: 1 } });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Continue guided setup")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Help & tours"));
  expect(screen.getByText("Welcome to HRM Portal")).toBeVisible();
});
test("new HR receives admin tour even after completing employee tour", () => {
  open({ isHR: true, onboarding: { tourVersion: 1, adminTourVersion: 0 } });
  for (let i = 0; i < employeeTour.length; i++)
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText(adminTour[0][0])).toBeVisible();
});
test("setup reads existing employees and confirms existing database support", () => {
  open({
    isHR: true,
    onboarding: {
      tourVersion: 1,
      adminTourVersion: 1,
      database: { transactionsSupported: true },
    },
  });
  fireEvent.click(screen.getByText("Continue guided setup"));
  expect(
    screen.getByText(/No database setup or second database is required/),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText(/0 \/ 1 employees confirmed/)).toBeVisible();
  expect(screen.getByLabelText("Employee to review")).toBeVisible();
});
test("unprofiled existing employee can be reviewed without creating a duplicate account", async () => {
  const { api } = open({
    isHR: true,
    onboarding: { tourVersion: 1, adminTourVersion: 1 },
    employees: [{ ...data.employees[0], hasProfile: false }],
  });
  fireEvent.click(screen.getByText("Continue guided setup"));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.mouseDown(screen.getByLabelText("Employee to review"));
  fireEvent.click(
    await screen.findByRole("option", { name: /Existing Employee/ }),
  );
  expect(
    screen.getByText(/This account has no full employee profile/),
  ).toBeVisible();
  const save = screen.getByRole("button", { name: "Save employee review" });
  expect(save).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/I reviewed this employee/));
  fireEvent.click(save);
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/setup",
      "POST",
      expect.objectContaining({
        userId: "one",
        profile: {
          department: "Admin",
          gender: "Female",
          branch: "Delhi",
          dateOfJoining: "2020-01-01",
        },
        openingBalances: { EL: 0, WFH: 0, ML: 0 },
      }),
    ),
  );
});
