import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
  Tooltip,
  ThemeProvider,
  createTheme,
  useTheme,
} from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import ArrowForward from "@mui/icons-material/ArrowForward";
import CalendarMonth from "@mui/icons-material/CalendarMonth";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import EventAvailable from "@mui/icons-material/EventAvailable";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import Logout from "@mui/icons-material/Logout";
import Menu from "@mui/icons-material/Menu";
import MoreTime from "@mui/icons-material/MoreTime";
import OpenInNew from "@mui/icons-material/OpenInNew";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import WorkOutline from "@mui/icons-material/WorkOutline";
import { apiUrl } from "../components/LoginSignup";
import NotificationBell from "../components/NotificationBell";
import Timecard from "../components/Timecard";
import "./hrm.css";
import HRMOnboarding from "./HRMOnboarding";

const NAV = [
  ["Overview", "Dashboard", "", DashboardOutlined],
  ["Attendance", "My attendance", "attendance", CalendarMonth],
  ["Attendance", "Team attendance", "team", GroupsOutlined, "team"],
  ["Attendance", "Today's entry", "entry", MoreTime, "hr"],
  ["Attendance", "Regularisation", "regularisation", FactCheckOutlined],
  ["Leave", "Apply & history", "leave", EventAvailable],
  ["Leave", "Balances & ledger", "ledger", WorkOutline],
  ["Work from home", "Apply & history", "wfh", WorkOutline],
  ["Holidays", "Holiday calendar", "holidays", CalendarMonth],
  [
    "HR management",
    "Requests & approvals",
    "approvals",
    CheckCircleOutline,
    "team",
  ],
  [
    "HR management",
    "Monthly review & lock",
    "monthly",
    FactCheckOutlined,
    "hr",
  ],
  ["HR management", "Login activity", "activity", MoreTime, "hr"],
  ["HR management", "Audit trail", "audit", FactCheckOutlined, "hr"],
  ["Reports", "Reports & exports", "reports", FactCheckOutlined, "hr"],
  ["Settings", "Employee setup", "setup", GroupsOutlined, "hr"],
  ["Settings", "HR policies", "settings", SettingsOutlined, "system"],
];
const initialRequest = {
  kind: "LEAVE",
  leaveType: "earned",
  from: "",
  to: "",
  reason: "",
  source: "EMPLOYEE_CRM",
  intimationAt: "",
  halfDay: false,
  emergency: false,
  alreadyApproved: false,
  approvalSource: "WhatsApp",
  approvalBy: "",
  approvalAt: "",
  payTreatment: "",
  remarks: "",
  overrideReason: "",
};
const POLICY_LABELS = {
  officeStart: "Office start",
  graceUntil: "Late arrival after",
  halfDayAfter: "Half-day check-in after",
  checkout: "Default checkout",
  earlyGoingReference: "Early going reference",
  emergencyCutoff: "Emergency intimation cutoff",
  allowedLates: "Allowed late arrivals / month",
  elMonthly: "EL credit / month",
  elFirstPartialMonth: "EL in partial joining month",
  mlMonthly: "Menstrual leave / month",
  mlFirstMonth: "Menstrual leave in joining month",
  wfhMonthly: "WFH credit / month",
  wfhFirstMonth: "WFH credit in joining month",
  wfhQuarterly: "WFH entitlement / quarter",
  maxEL: "Maximum consecutive EL days",
  maxWFH: "Maximum consecutive WFH days",
  maxCombined: "Maximum combined EL + WFH days",
  extendedPerQuarter: "Extended combinations / quarter",
};
const localTimestamp = (value) =>
  value
    ? new Date(
        `${value.length === 16 ? value + ":00" : value}+05:30`,
      ).toISOString()
    : undefined;
const dateLabel = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      })
    : "—";
const stamp = (date) =>
  date
    ? new Date(date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "—";
const colorFor = (status) =>
  /Pending|pending|Late|Verification/.test(status)
    ? "warning"
    : /UA|Absent|rejected|Unpaid/.test(status)
      ? "error"
      : /Present|Paid|approved/.test(status)
        ? "success"
        : "default";
const Status = ({ value = "" }) => (
  <Chip
    size="small"
    color={colorFor(value)}
    variant="outlined"
    label={value || "Pending"}
  />
);
const Field = ({
  label,
  value,
  onChange,
  type = "text",
  options,
  ...props
}) => (
  <TextField
    size="small"
    fullWidth
    label={label}
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value)}
    type={options ? undefined : type}
    select={Boolean(options)}
    InputLabelProps={
      type === "date" ||
      type === "time" ||
      type === "month" ||
      type === "datetime-local"
        ? { shrink: true }
        : undefined
    }
    {...props}
  >
    {options?.map((o) => (
      <MenuItem
        key={typeof o === "string" ? o : o.value}
        value={typeof o === "string" ? o : o.value}
      >
        {typeof o === "string" ? o : o.label}
      </MenuItem>
    ))}
  </TextField>
);
const Panel = ({ title, description, children, action }) => (
  <section className="hrm-panel">
    <div className="hrm-panel-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);
const Empty = ({ children = "No records to show." }) => (
  <div className="hrm-empty">{children}</div>
);
const Table = ({ headers, children }) => (
  <div className="hrm-table-scroll">
    <table className="hrm-table">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);
function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const flat = rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        v && typeof v === "object" ? JSON.stringify(v) : (v ?? ""),
      ]),
    ),
  );
  const keys = [...new Set(flat.flatMap(Object.keys))];
  const quote = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  const blob = new Blob(
    [
      "\ufeff" +
        [
          keys.map(quote).join(","),
          ...flat.map((r) => keys.map((k) => quote(r[k])).join(",")),
        ].join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HRMPortal() {
  const existingTheme = useTheme();
  const theme = useMemo(
    () =>
      createTheme({
        ...existingTheme,
        palette: { ...existingTheme.palette, primary: { main: "#176b57" } },
        shape: { borderRadius: 8 },
      }),
    [existingTheme],
  );
  return (
    <ThemeProvider theme={theme}>
      <HRMWorkspace />
    </ThemeProvider>
  );
}

function HRMWorkspace() {
  const theme = useTheme();
  const [recalculationPolicy, setRecalculationPolicy] = useState("");
  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userSession")) || {};
    } catch {
      return {};
    }
  }, []);
  const navigate = useNavigate(),
    location = useLocation(),
    page = location.pathname.split("/")[2] || "";
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [mobileNav, setMobileNav] = useState(false);
  const [branding, setBranding] = useState({ company_name: "CRM" });
  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/company/public`)
      .then((r) => r.json())
      .then((r) => {
        if (active) {
          setBranding(r);
          document.title = `${r.company_name || "CRM"} | HRM Portal`;
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [month, setMonth] = useState(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    })
      .format(new Date())
      .slice(0, 7),
  );
  const [employeeId, setEmployeeId] = useState(session.user_id),
    [records, setRecords] = useState([]),
    [team, setTeam] = useState([]),
    [filter, setFilter] = useState(""),
    [department, setDepartment] = useState(""),
    [date, setDate] = useState("");
  const [request, setRequest] = useState(initialRequest),
    [proof, setProof] = useState(null),
    [detail, setDetail] = useState(null),
    [decision, setDecision] = useState(null),
    [decisionForm, setDecisionForm] = useState({});
  const [editAttendance, setEditAttendance] = useState(null),
    [adjustment, setAdjustment] = useState({
      kind: "EL",
      amount: "",
      reason: "",
      date: "",
      userId: "",
    });
  const [regular, setRegular] = useState({
    date: "",
    checkIn: "",
    checkOut: "",
    category: "Incorrect Check-In",
    reason: "",
  });
  const [holiday, setHoliday] = useState({
    date: "",
    name: "",
    department: "",
    location: "",
    holidayType: "Company",
    description: "",
  });
  const [employeeSetup, setEmployeeSetup] = useState({
    userId: "",
    managerId: "",
    group: "Operations",
    eligible: true,
    exitDate: "",
    openingBalances: { EL: 0, WFH: 0, ML: 0 },
  });
  const [policy, setPolicy] = useState({}),
    [effectiveDate, setEffectiveDate] = useState(""),
    [activationDate, setActivationDate] = useState(""),
    [reportType, setReportType] = useState("attendance"),
    [reportRows, setReportRows] = useState([]),
    [auditRows, setAuditRows] = useState([]),
    [activityRows, setActivityRows] = useState([]),
    [review, setReview] = useState(false),
    [reason, setReason] = useState("");

  const api = useCallback(
    async (path, method = "GET", body) => {
      const form = typeof FormData !== "undefined" && body instanceof FormData;
      const response = await fetchWithTimeout(`${apiUrl}/hrm${path}`, {
        method,
        headers: {
          Authorization: session.token || "",
          ...(!form ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? (form ? body : JSON.stringify(body)) : undefined,
      });
      const result = await response
        .json()
        .catch(() => ({
          message: "The server returned an invalid response. Please retry.",
        }));
      if (!response.ok)
        throw new Error(result.message || "Unable to complete request");
      return result;
    },
    [session.token],
  );
  const load = useCallback(async () => {
    const result = await api(`/bootstrap?month=${month}`);
    setData(result);
    setDate((d) => d || result.today);
    setPolicy((p) => (Object.keys(p).length ? p : result.policy));
    setActivationDate((d) => d || result.today);
    setEffectiveDate((d) => d || result.today);
  }, [api, month]);
  useEffect(() => {
    let active = true;
    setError("");
    api(`/bootstrap?month=${month}`)
      .then((result) => {
        if (active) {
          setData(result);
          setDate((d) => d || result.today);
          setPolicy((p) => (Object.keys(p).length ? p : result.policy));
          setActivationDate((d) => d || result.today);
          setEffectiveDate((d) => d || result.today);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [api, month]);
  useEffect(() => {
    let active = true;
    if (data && ["attendance", "team", "entry", "monthly", ""].includes(page)) {
      if ((employeeId || session.user_id) === session.user_id) {
        setRecords(data.attendance || []);
      } else if (page === "attendance") {
        api(`/attendance?month=${month}&userId=${employeeId}`)
          .then((r) => active && setRecords(r.records))
          .catch((e) => active && setError(e.message));
      }
      if (
        ["team", "entry", "monthly", ""].includes(page) &&
        (data.isHR || data.employees.length > 1)
      )
        api(
          `/attendance/team?month=${page === "entry" ? date.slice(0, 7) || month : month}`,
        )
          .then((r) => active && setTeam(r.team || []))
          .catch((e) => active && setError(e.message));
    }
    return () => {
      active = false;
    };
  }, [api, data, month, employeeId, page, date, session.user_id]);
  const run = async (action) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await load();
      setMessage("Saved successfully");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const setReq = (key) => (value) =>
    setRequest((r) => ({ ...r, [key]: value }));
  const people = data?.employees || [],
    personOptions = people.map((e) => ({
      value: e.userId,
      label: `${e.name}${e.department ? ` · ${e.department}` : ""}`,
    }));
  const nameFor = (id) => people.find((e) => e.userId === id)?.name || id;
  const ownRows = data?.attendance || [],
    completed = ownRows.filter(
      (r) => !r.future && !r.historical && r.status !== "Not Employed",
    );
  const currentPerson = people.find((e) => e.userId === session.user_id);
  const requestBalances =
    data?.employeeBalances?.[request.userId || session.user_id] ||
    data?.balances ||
    {};
  const estimatedDays = estimateDays(
    { ...request, halfDay: page === "leave" && request.halfDay },
    people.find((e) => e.userId === (request.userId || session.user_id)),
    data?.policy,
    data?.holidays,
  );
  const myRequests = (data?.requests || []).filter(
    (r) => r.userId === session.user_id,
  );
  const pending = myRequests.filter((r) => r.status === "pending");
  const allowedNav = NAV.filter(
    (n) =>
      !n[4] ||
      (n[4] === "hr" && data?.isHR) ||
      (n[4] === "system" && data?.isSystem) ||
      (n[4] === "team" && (data?.isHR || people.length > 1)),
  );
  const allowedPage = allowedNav.some((n) => n[2] === page);
  const title = NAV.find((n) => n[2] === page)?.[1] || "Dashboard";
  const count = (regex) => completed.filter((r) => regex.test(r.status)).length;
  const rowsForRequests = (data?.requests || [])
    .filter((r) =>
      page === "wfh"
        ? r.kind === "WFH"
        : page === "leave"
          ? r.kind === "LEAVE"
          : true,
    )
    .filter(
      (r) =>
        !filter ||
        `${nameFor(r.userId)} ${r.status} ${r.data.source} ${r.kind}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
    );
  const attendanceTable = (rows) => (
    <Table
      headers={[
        "Date",
        "Check-in",
        "Check-out",
        "Status",
        "Late #",
        "Early going",
        "Source",
        "Payable",
      ]}
    >
      {rows.map((r) => (
        <tr
          key={`${r.userId}-${r.date}`}
          onClick={() => setDetail(r)}
          className="hrm-clickable"
        >
          <td>{dateLabel(r.date)}</td>
          <td>{r.checkIn || "—"}</td>
          <td>
            {r.checkOut || "—"}{" "}
            {r.checkOutSource === "AUTO" && <small>AUTO</small>}
          </td>
          <td>
            <Status value={r.status} />
          </td>
          <td>{r.lateNumber || "—"}</td>
          <td>{r.earlyGoingMinutes ? `${r.earlyGoingMinutes} min` : "—"}</td>
          <td>{r.requestSource || r.checkInSource || "—"}</td>
          <td>{r.future ? "Scheduled" : (r.payable ?? "Review")}</td>
        </tr>
      ))}
    </Table>
  );
  const requestTable = (rows) =>
    rows.length ? (
      <Table
        headers={[
          "Employee / request",
          "Dates / days",
          "Source",
          "Status",
          "Entered by",
          "Actions",
        ]}
      >
        {rows.map((r) => (
          <tr key={r._id}>
            <td>
              <strong>{nameFor(r.userId)}</strong>
              <small>
                {r.kind} {r.data.leaveType || ""}
                {r.data.emergency ? " · Emergency" : ""}
              </small>
            </td>
            <td>
              {dateLabel(r.from)} – {dateLabel(r.to)}
              <small>
                {r.data.days?.reduce((n, d) => n + d.units, 0) || "—"} day(s)
              </small>
            </td>
            <td>
              {r.data.source}
              <small>{stamp(r.data.intimationAt)}</small>
            </td>
            <td>
              <Status value={r.status} />
              {r.data.lateEmergency && <small>Late emergency intimation</small>}
            </td>
            <td>
              {r.data.enteredByName || nameFor(r.data.enteredBy || r.userId)}
            </td>
            <td>
              <Button size="small" onClick={() => setDetail(r)}>
                Details
              </Button>
              {r.status === "pending" &&
                r.userId !== session.user_id &&
                (data.isHR ||
                  people.find((e) => e.userId === r.userId)?.managerId ===
                    session.user_id) && (
                  <Button
                    size="small"
                    onClick={() => {
                      setDecision(r);
                      setDecisionForm({
                        status: "approved",
                        remarks: "",
                        payTreatment: "",
                        approvalSource: "CRM",
                      });
                    }}
                  >
                    Review
                  </Button>
                )}
              {r.status !== "cancelled" &&
                r.kind !== "REGULARISATION" &&
                (data.isHR ||
                  (r.userId === session.user_id && r.status === "pending")) && (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      setDecision(r);
                      setDecisionForm({ status: "cancelled", remarks: "" });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              {data.isHR &&
                r.status === "approved" &&
                r.data.days?.some(
                  (d) => d.status === "WFH Verification Pending",
                ) && (
                  <Button
                    size="small"
                    onClick={() => {
                      setDecision(r);
                      setDecisionForm({
                        verify: true,
                        outcome: "Present",
                        reference: "",
                        remarks: "",
                      });
                    }}
                  >
                    Verify payment
                  </Button>
                )}
            </td>
          </tr>
        ))}
      </Table>
    ) : (
      <Empty />
    );

  if (!data)
    return (
      <div className="hrm-loading">
        {error ? (
          <>
            <Alert severity="error">{error}</Alert>
            <Button onClick={() => load().catch((e) => setError(e.message))}>
              Retry
            </Button>
            <Button component={Link} to="/dashboard">
              Back to CRM
            </Button>
          </>
        ) : (
          <>
            <CircularProgress color="inherit" />
            <p>Opening HRM Portal…</p>
          </>
        )}
      </div>
    );

  return (
    <div
      className={`hrm-app ${theme.palette.mode === "dark" ? "hrm-dark" : ""}`}
    >
      <aside className={`hrm-sidebar ${mobileNav ? "is-open" : ""}`}>
        <Link to="/hrm" className="hrm-brand">
          {branding.logo_url ? (
            <img
              className="hrm-brand-logo"
              src={branding.logo_url}
              alt={branding.company_name || "Company"}
            />
          ) : (
            <span className="hrm-brand-mark">h.</span>
          )}
          <span>
            HRM Portal
            <small>{branding.company_name || "PEOPLE & WORKPLACE"}</small>
          </span>
        </Link>
        <a className="hrm-back" href="/dashboard">
          <ArrowBack fontSize="small" /> Back to CRM
        </a>
        <nav>
          {allowedNav.map((n, i) => {
            const Icon = n[3];
            return (
              <React.Fragment key={n[2]}>
                {(i === 0 || allowedNav[i - 1][0] !== n[0]) && (
                  <div className="hrm-nav-group">{n[0]}</div>
                )}
                <NavLink
                  end={!n[2]}
                  to={`/hrm${n[2] ? `/${n[2]}` : ""}`}
                  onClick={() => {
                    setMobileNav(false);
                    setFilter("");
                  }}
                >
                  <Icon fontSize="small" />
                  {n[1]}
                </NavLink>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="hrm-sidebar-footer">
          <Avatar
            sx={{ bgcolor: "#d4eee5", color: "#155e50", width: 34, height: 34 }}
          >
            {session.name?.[0]}
          </Avatar>
          <div>
            <strong>{session.name}</strong>
            <small>{session.user_role}</small>
          </div>
          <Tooltip title="Log out of CRM and HRM">
            <Button
              aria-label="Log out"
              onClick={() => {
                ["userSession", "isAuthenticated", "loginTime"].forEach((k) =>
                  localStorage.removeItem(k),
                );
                navigate("/login");
              }}
            >
              <Logout fontSize="small" />
            </Button>
          </Tooltip>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="hrm-nav-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main className="hrm-main">
        <header className="hrm-topbar">
          <div className="hrm-breadcrumb">
            <button
              className="hrm-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ArrowForward sx={{ fontSize: 12 }} />
            <strong>{title}</strong>
          </div>
          <div className="hrm-top-actions">
            <span>{dateLabel(data.today)} · IST</span>
            <NotificationBell />
          </div>
        </header>
        <div className="hrm-content">
          <HRMOnboarding
            data={data}
            api={api}
            reload={load}
            navigate={navigate}
          />
          <div className="hrm-page-heading">
            <div>
              <span className="hrm-eyebrow">
                {branding.company_name || "CRM"} · HUMAN RESOURCES
              </span>
              <h1>
                {page
                  ? title
                  : `Good ${new Date().getHours() < 12 ? "morning" : "day"}, ${session.name?.split(" ")[0] || "there"}.`}
              </h1>
              <p>
                {page
                  ? "Your people, attendance and workplace — in one place."
                  : "A clear view of your workday and what’s coming next."}
              </p>
            </div>
            <div className="hrm-heading-actions">
              <Field
                label="Viewing month"
                type="month"
                value={month}
                onChange={(value) => {
                  if (value) setMonth(value);
                }}
              />
              <Button
                variant="outlined"
                disabled={busy}
                onClick={() => run(async () => {})}
              >
                Refresh
              </Button>
            </div>
          </div>
          {error && (
            <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {message && (
            <Alert
              severity="success"
              onClose={() => setMessage("")}
              sx={{ mb: 2 }}
            >
              {message}
            </Alert>
          )}
          {!data.activationDate && (
            <Alert severity="info" sx={{ mb: 3 }}>
              HRM setup is in progress. Historical records are available below.
              HR must confirm employee setup, opening balances and policies
              before activation.
            </Alert>
          )}
          {!allowedPage ? (
            <Alert severity="warning">
              Your account does not have access to this section.
            </Alert>
          ) : (
            <>
              {page === "" && (
                <>
                  <div className="hrm-hero">
                    <div>
                      <span className="hrm-pill">
                        YOUR WORKDAY, AT A GLANCE
                      </span>
                      <h2>
                        Make room for
                        <br />a better workday.
                      </h2>
                      <p>
                        Stay up to date with attendance, time off and your team.
                      </p>
                      <div>
                        <Button
                          component={Link}
                          to="/hrm/leave"
                          variant="contained"
                        >
                          Apply for leave <ArrowForward fontSize="small" />
                        </Button>
                        <Button component={Link} to="/hrm/wfh">
                          Request WFH
                        </Button>
                      </div>
                    </div>
                    <div className="hrm-today">
                      <span>TODAY · {dateLabel(data.today)}</span>
                      <Status
                        value={
                          ownRows.find((r) => r.date === data.today)?.status ||
                          "Pending"
                        }
                      />
                      <div>
                        <div>
                          <small>Check-in</small>
                          <strong>
                            {ownRows.find((r) => r.date === data.today)
                              ?.checkIn || "—"}
                          </strong>
                        </div>
                        <div>
                          <small>Check-out</small>
                          <strong>
                            {ownRows.find((r) => r.date === data.today)
                              ?.checkOut || "—"}
                          </strong>
                        </div>
                      </div>
                      <small>Attendance times are recorded by HR.</small>
                    </div>
                  </div>
                  <div className="hrm-stats">
                    {[
                      ["Present days", count(/^Present|^Late/), "This month"],
                      ["Earned leave", data.balances.EL, "Available days"],
                      [
                        "WFH balance",
                        data.balances.WFH,
                        `${data.wfhUsedQuarter} used this quarter`,
                      ],
                      ...(currentPerson?.gender === "Female"
                        ? [
                            [
                              "Menstrual leave",
                              data.balances.ML,
                              "Available this month",
                            ],
                          ]
                        : []),
                      ["Pending requests", pending.length, "Awaiting review"],
                    ].map(([label, value, note]) => (
                      <div className="hrm-stat" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                        <small>{note}</small>
                      </div>
                    ))}
                  </div>
                  <div className="hrm-two-col">
                    <Panel
                      title="This month"
                      description="Completed attendance through today"
                    >
                      <div className="hrm-summary-grid">
                        {[
                          ["Calendar days", ownRows.length],
                          [
                            "Working days",
                            completed.filter(
                              (r) => !/Holiday|Week Off/.test(r.status),
                            ).length,
                          ],
                          ["WFH", count(/WFH/)],
                          ["Earned leave", count(/Earned/)],
                          ["Menstrual leave", count(/Menstrual/)],
                          ["Half days", count(/Half/)],
                          [
                            "Late arrivals",
                            completed.filter((r) => r.late).length,
                          ],
                          [
                            "Early going",
                            completed.filter((r) => r.earlyGoingMinutes).length,
                          ],
                          ["Absent / UA", count(/Absent|UA/)],
                          ["Holiday / off", count(/Holiday|Week Off/)],
                          ["Attendance pending", count(/Pending/)],
                        ].map(([l, n]) => (
                          <div key={l}>
                            <span>{l}</span>
                            <strong>{n}</strong>
                          </div>
                        ))}
                      </div>
                    </Panel>
                    <Panel
                      title="Coming up"
                      description="Approved leave and WFH"
                    >
                      <div className="hrm-upcoming">
                        {myRequests
                          .filter(
                            (r) =>
                              r.status === "approved" && r.to >= data.today,
                          )
                          .slice(0, 5)
                          .map((r) => (
                            <div key={r._id}>
                              <CalendarMonth />
                              <div>
                                <strong>
                                  {r.kind === "WFH"
                                    ? "Work from home"
                                    : r.data.leaveType + " leave"}
                                </strong>
                                <small>
                                  {dateLabel(r.from)} – {dateLabel(r.to)} ·{" "}
                                  {r.data.source}
                                </small>
                              </div>
                              <Status value={r.status} />
                            </div>
                          ))}
                      </div>
                      {!myRequests.some(
                        (r) => r.status === "approved" && r.to >= data.today,
                      ) && (
                        <Empty>
                          No upcoming time off. Your next break starts here.
                        </Empty>
                      )}
                      <Button component={Link} to="/hrm/regularisation">
                        Request an attendance correction
                      </Button>
                    </Panel>
                  </div>
                  {(data.isHR || people.length > 1) && (
                    <Panel
                      title="Team pulse"
                      description="Today’s attendance across your permitted team"
                    >
                      <div className="hrm-summary-grid">
                        {[
                          "Present",
                          "Late",
                          "Half Day",
                          "Pending",
                          "WFH",
                          "Leave",
                          "Absent",
                          "UA",
                        ].map((status) => (
                          <div key={status}>
                            <span>{status}</span>
                            <strong>
                              {
                                team.filter((e) =>
                                  e.records
                                    .find((r) => r.date === data.today)
                                    ?.status.includes(status),
                                ).length
                              }
                            </strong>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  )}
                </>
              )}

              {page === "attendance" && (
                <Panel
                  title="Attendance calendar"
                  description="Select a day to see its times, source and remarks"
                >
                  <div className="hrm-calendar">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (d) => (
                        <div className="hrm-calendar-label" key={d}>
                          {d}
                        </div>
                      ),
                    )}
                    {Array.from(
                      { length: new Date(`${month}-01T12:00:00`).getDay() },
                      (_, i) => (
                        <div key={`blank${i}`} />
                      ),
                    )}
                    {records.map((r) => (
                      <button
                        className={`hrm-day ${r.future ? "is-future" : ""}`}
                        key={r.date}
                        onClick={() => setDetail(r)}
                      >
                        <strong>{Number(r.date.slice(-2))}</strong>
                        <span className={`hrm-dot ${colorFor(r.status)}`} />
                        <small>{r.status}</small>
                        {r.earlyGoingMinutes > 0 && (
                          <small>EG {r.earlyGoingMinutes}m</small>
                        )}
                      </button>
                    ))}
                  </div>
                  {attendanceTable(records)}
                </Panel>
              )}

              {["team", "monthly"].includes(page) && (
                <Panel
                  title={
                    page === "monthly"
                      ? "Monthly attendance review"
                      : "Team attendance"
                  }
                  description="Filter employees, then inspect individual days"
                >
                  <div className="hrm-form-grid">
                    <Field
                      label="Search employee or status"
                      value={filter}
                      onChange={setFilter}
                    />
                    <Field
                      label="Department"
                      value={department}
                      onChange={setDepartment}
                      options={[
                        { value: "", label: "All departments" },
                        ...[
                          ...new Set(
                            people.map((e) => e.department).filter(Boolean),
                          ),
                        ],
                      ]}
                    />
                  </div>
                  {team
                    .filter(
                      (t) =>
                        (!department || t.employee.department === department) &&
                        (!filter ||
                          `${t.employee.name} ${t.records.map((r) => `${r.status} ${r.requestSource || ""} ${r.earlyGoingMinutes ? "Early Going" : ""}`).join(" ")}`
                            .toLowerCase()
                            .includes(filter.toLowerCase())),
                    )
                    .map((t) => (
                      <details
                        className="hrm-employee-detail"
                        key={t.employee.userId}
                      >
                        <summary>
                          <strong>{t.employee.name}</strong>
                          <span>
                            {t.employee.department} ·{" "}
                            {
                              t.records.filter(
                                (r) => !r.future && r.payable === null,
                              ).length
                            }{" "}
                            unresolved
                          </span>
                        </summary>
                        {attendanceTable(t.records)}
                        {data.isHR && (
                          <Button
                            onClick={() => {
                              setEmployeeId(t.employee.userId);
                              setEditAttendance({
                                userId: t.employee.userId,
                                date: data.today,
                                checkIn: "",
                                checkOut: "",
                                remarks: "",
                              });
                            }}
                          >
                            Correct attendance
                          </Button>
                        )}
                      </details>
                    ))}
                  {page === "monthly" && (
                    <div className="hrm-lock-panel">
                      <h3>Finalise {month}</h3>
                      <p>
                        Review pending attendance, leave, WFH verification and
                        absence checks before locking payroll.
                      </p>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={review}
                            onChange={(e) => setReview(e.target.checked)}
                          />
                        }
                        label="I verified CRM, WhatsApp/offline, emergency, WFH and absence cases."
                      />
                      <Field
                        label="Review / unlock reason"
                        value={reason}
                        onChange={setReason}
                      />
                      <div className="hrm-actions">
                        <Button
                          disabled={busy || !review}
                          variant="contained"
                          onClick={() =>
                            run(() =>
                              api(`/months/${month}/lock`, "POST", {
                                reviewConfirmed: review,
                                reason,
                              }),
                            )
                          }
                        >
                          Lock reviewed month
                        </Button>
                        {data.isSystem && (
                          <Button
                            disabled={busy || !reason.trim()}
                            color="warning"
                            onClick={() =>
                              run(() =>
                                api(`/months/${month}/lock`, "POST", {
                                  unlock: true,
                                  reason,
                                }),
                              )
                            }
                          >
                            Unlock month
                          </Button>
                        )}
                        <Field
                          label="Recalculate attendance timing with policy"
                          value={recalculationPolicy}
                          onChange={setRecalculationPolicy}
                          options={[
                            {
                              value: "",
                              label: "Original effective-date rules",
                            },
                            ...data.policies.map((p) => ({
                              value: p.effectiveDate,
                              label: p.effectiveDate,
                            })),
                          ]}
                          helperText="Changes attendance time rules only; leave entitlements remain unchanged."
                        />
                        <Button
                          disabled={busy || !reason.trim()}
                          onClick={() =>
                            run(async () => {
                              await api(
                                `/months/${month}/recalculate`,
                                "POST",
                                {
                                  reason,
                                  policyEffectiveDate: recalculationPolicy,
                                },
                              );
                            })
                          }
                        >
                          Recalculate unlocked month
                        </Button>
                      </div>
                      <Table
                        headers={["Month", "Version", "Status", "Created"]}
                      >
                        {data.locks.map((l) => (
                          <tr key={l._id}>
                            <td>{l.month}</td>
                            <td>{l.version}</td>
                            <td>{l.locked ? "Locked" : "Unlocked"}</td>
                            <td>{stamp(l.createdAt)}</td>
                          </tr>
                        ))}
                      </Table>
                    </div>
                  )}
                </Panel>
              )}

              {page === "entry" && (
                <Panel
                  title="Daily attendance entry"
                  description="Enter the original WhatsApp ‘Reached’ time. Missing check-in stays pending."
                >
                  <div className="hrm-form-grid">
                    <Field
                      type="date"
                      label="Attendance date"
                      value={date}
                      onChange={setDate}
                    />
                    <Field
                      label="Search employee"
                      value={filter}
                      onChange={setFilter}
                    />
                  </div>
                  <Table
                    headers={[
                      "Employee",
                      "Check-in",
                      "Check-out",
                      "Status",
                      "Early going",
                      "Entry",
                    ]}
                  >
                    {team
                      .filter((t) =>
                        t.employee.name
                          .toLowerCase()
                          .includes(filter.toLowerCase()),
                      )
                      .map((t) => {
                        const r = t.records.find((r) => r.date === date) || {};
                        return (
                          <AttendanceEntry
                            key={`${t.employee.userId}-${date}-${r.checkIn}-${r.checkOut}`}
                            employee={t.employee}
                            row={r}
                            busy={busy}
                            onSave={(values) =>
                              run(() =>
                                api("/attendance", "POST", {
                                  ...values,
                                  userId: t.employee.userId,
                                  date,
                                }),
                              )
                            }
                            onEdit={() =>
                              setEditAttendance({
                                ...r,
                                userId: t.employee.userId,
                                date,
                                checkIn: r.checkIn || "",
                                checkOut:
                                  r.checkOutSource === "AUTO"
                                    ? ""
                                    : r.checkOut || "",
                                remarks: "",
                              })
                            }
                          />
                        );
                      })}
                  </Table>
                </Panel>
              )}

              {["leave", "wfh"].includes(page) && (
                <>
                  <Panel
                    title={
                      page === "wfh"
                        ? "Request work from home"
                        : "Plan your time off"
                    }
                    description="Your request will be reviewed before it affects attendance or balances."
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(async () => {
                          const payload = {
                            ...request,
                            kind: page === "wfh" ? "WFH" : "LEAVE",
                            leaveType:
                              page === "leave" ? request.leaveType : undefined,
                            halfDay: page === "leave" && request.halfDay,
                            userId: request.userId || session.user_id,
                            intimationAt: localTimestamp(request.intimationAt),
                            approvalAt: localTimestamp(request.approvalAt),
                          };
                          const form = new FormData();
                          form.append("payload", JSON.stringify(payload));
                          if (proof) form.append("attachment", proof);
                          await api("/requests", "POST", form);
                          setRequest(initialRequest);
                          setProof(null);
                        });
                      }}
                    >
                      <div className="hrm-balance-note">
                        Available for selected employee:{" "}
                        {requestBalances.EL || 0} EL ·{" "}
                        {requestBalances.WFH || 0} WFH{" "}
                        {people.find(
                          (e) =>
                            e.userId === (request.userId || session.user_id),
                        )?.gender === "Female"
                          ? `· ${requestBalances.ML || 0} Menstrual Leave`
                          : ""}
                      </div>
                      <div className="hrm-form-grid">
                        {data.isHR && (
                          <Field
                            label="Employee / on behalf of"
                            value={request.userId || session.user_id}
                            options={personOptions}
                            onChange={setReq("userId")}
                          />
                        )}
                        {page === "leave" && (
                          <Field
                            label="Leave type"
                            value={request.leaveType}
                            onChange={setReq("leaveType")}
                            options={[
                              { value: "earned", label: "Earned Leave" },
                              { value: "menstrual", label: "Menstrual Leave" },
                              { value: "emergency", label: "Emergency Leave" },
                              { value: "normal", label: "Normal Leave" },
                            ]}
                          />
                        )}
                        <Field
                          label="From"
                          type="date"
                          value={request.from}
                          onChange={setReq("from")}
                          required
                        />
                        <Field
                          label="To"
                          type="date"
                          value={request.to}
                          onChange={setReq("to")}
                          required
                        />
                        <Field
                          label="Estimated working days"
                          value={estimatedDays}
                          onChange={() => {}}
                          InputProps={{ readOnly: true }}
                        />
                        <Field
                          label="Reason"
                          value={request.reason}
                          onChange={setReq("reason")}
                          multiline
                          required
                        />
                        {data.isHR && (
                          <>
                            <Field
                              label="Request source"
                              value={request.source}
                              options={[
                                "EMPLOYEE_CRM",
                                "WHATSAPP",
                                "HR_MANUAL",
                                "OTHER",
                              ]}
                              onChange={setReq("source")}
                            />
                            <Field
                              label="Original intimation (IST)"
                              type="datetime-local"
                              value={request.intimationAt}
                              onChange={setReq("intimationAt")}
                              required={request.source === "WHATSAPP"}
                            />
                            <Field
                              label="HR remarks"
                              value={request.remarks}
                              onChange={setReq("remarks")}
                            />
                          </>
                        )}
                      </div>
                      <div className="hrm-actions">
                        {page === "leave" && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={request.halfDay}
                                onChange={(e) =>
                                  setReq("halfDay")(e.target.checked)
                                }
                              />
                            }
                            label="Half day"
                          />
                        )}
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={request.emergency}
                              onChange={(e) =>
                                setReq("emergency")(e.target.checked)
                              }
                            />
                          }
                          label="Emergency"
                        />
                        {data.isHR && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={request.alreadyApproved}
                                onChange={(e) =>
                                  setReq("alreadyApproved")(e.target.checked)
                                }
                              />
                            }
                            label="Already approved offline"
                          />
                        )}
                      </div>
                      {request.alreadyApproved && data.isHR && (
                        <div className="hrm-form-grid">
                          <Field
                            label="Original approver"
                            value={request.approvalBy}
                            onChange={setReq("approvalBy")}
                            required
                          />
                          <Field
                            label="Original approval time (IST)"
                            type="datetime-local"
                            value={request.approvalAt}
                            onChange={setReq("approvalAt")}
                            required
                          />
                          <Field
                            label="Approval channel"
                            value={request.approvalSource}
                            options={[
                              "CRM",
                              "WhatsApp",
                              "Call",
                              "Verbal",
                              "Other",
                            ]}
                            onChange={setReq("approvalSource")}
                          />
                          <Field
                            label="Normal / Emergency pay treatment"
                            value={request.payTreatment}
                            options={[
                              { value: "", label: "Choose when applicable" },
                              "EL",
                              "UNPAID",
                            ]}
                            onChange={setReq("payTreatment")}
                          />
                          <Field
                            label="Exception reason (if needed)"
                            value={request.overrideReason}
                            onChange={setReq("overrideReason")}
                          />
                        </div>
                      )}
                      <div className="hrm-actions">
                        <Button component="label" variant="outlined">
                          {proof ? proof.name : "Attach optional proof"}
                          <input
                            key={proof ? "attached" : "empty"}
                            type="file"
                            hidden
                            accept="image/png,image/jpeg,image/webp,application/pdf"
                            onChange={(e) => setProof(e.target.files[0])}
                          />
                        </Button>
                        <Button
                          variant="contained"
                          type="submit"
                          disabled={busy || !data.activationDate}
                        >
                          Submit {page === "wfh" ? "WFH" : "leave"} request
                        </Button>
                      </div>
                    </form>
                  </Panel>
                  <Panel
                    title={page === "wfh" ? "WFH history" : "Leave history"}
                    description="Original request, entry and approval timestamps remain separate"
                  >
                    {requestTable(rowsForRequests)}
                    {page === "leave" && data.legacyLeaves.length > 0 && (
                      <details className="hrm-employee-detail">
                        <summary>
                          Historical leave requests ({data.legacyLeaves.length})
                        </summary>
                        <Table
                          headers={[
                            "Employee",
                            "Type",
                            "Dates",
                            "Status",
                            "Action",
                          ]}
                        >
                          {data.legacyLeaves.map((l) => (
                            <tr key={l._id}>
                              <td>{l.user_name}</td>
                              <td>{l.leave_type}</td>
                              <td>
                                {dateLabel(l.start_date)} –{" "}
                                {dateLabel(l.end_date)}
                              </td>
                              <td>
                                <Status value={l.status} />
                              </td>
                              <td>
                                {data.isHR &&
                                  (l.status === "pending" ||
                                    (l.status === "approved" &&
                                      l.end_date.slice(0, 10) >=
                                        data.activationDate &&
                                      !l.notes?.includes(
                                        "Recorded in HRM:",
                                      ))) && (
                                    <Button
                                      onClick={() => {
                                        setDecision({ ...l, legacy: true });
                                        setDecisionForm({
                                          status: "approved",
                                          remarks: "",
                                          payTreatment: "",
                                        });
                                      }}
                                    >
                                      Review
                                    </Button>
                                  )}
                              </td>
                            </tr>
                          ))}
                        </Table>
                      </details>
                    )}
                  </Panel>
                </>
              )}

              {page === "approvals" && (
                <Panel
                  title="Request inbox"
                  description="Review CRM, WhatsApp and offline requests together"
                >
                  <Field
                    label="Filter employee, status, kind or source"
                    value={filter}
                    onChange={setFilter}
                    sx={{ mb: 2 }}
                  />
                  {requestTable(rowsForRequests)}
                </Panel>
              )}

              {page === "regularisation" && (
                <>
                  <Panel
                    title="Request a correction"
                    description="HR reviews attendance corrections and official work exceptions"
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(() => api("/regularisations", "POST", regular));
                      }}
                    >
                      <div className="hrm-form-grid">
                        <Field
                          label="Date"
                          type="date"
                          value={regular.date}
                          onChange={(v) => setRegular({ ...regular, date: v })}
                          required
                        />
                        <Field
                          label="Reason category"
                          value={regular.category}
                          options={[
                            "Incorrect Check-In",
                            "Incorrect Check-Out",
                            "Official Client Meeting",
                            "Approved Late Arrival",
                            "Official Outside Work",
                            "Other",
                          ]}
                          onChange={(v) =>
                            setRegular({ ...regular, category: v })
                          }
                        />
                        <Field
                          label="Correct check-in"
                          type="time"
                          value={regular.checkIn}
                          onChange={(v) =>
                            setRegular({ ...regular, checkIn: v })
                          }
                        />
                        <Field
                          label="Correct check-out"
                          type="time"
                          value={regular.checkOut}
                          onChange={(v) =>
                            setRegular({ ...regular, checkOut: v })
                          }
                        />
                        <Field
                          label="Explanation"
                          value={regular.reason}
                          onChange={(v) =>
                            setRegular({ ...regular, reason: v })
                          }
                          required
                          multiline
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={busy || !data.activationDate}
                      >
                        Submit for review
                      </Button>
                    </form>
                  </Panel>
                  <Panel title="Regularisation history">
                    {requestTable(
                      (data.requests || []).filter(
                        (r) => r.kind === "REGULARISATION",
                      ),
                    )}
                  </Panel>
                </>
              )}

              {page === "ledger" && (
                <>
                  <div className="hrm-stats">
                    {Object.entries(data.balances)
                      .filter(
                        ([k]) =>
                          k !== "ML" || currentPerson?.gender === "Female",
                      )
                      .map(([k, v]) => (
                        <div className="hrm-stat" key={k}>
                          <span>{k} available</span>
                          <strong>{v}</strong>
                          <small>As of today</small>
                        </div>
                      ))}
                  </div>
                  <Panel
                    title="Entitlement ledger"
                    description="Opening balances, credits, usage, expiry and adjustments"
                  >
                    <Field
                      label="Employee"
                      value={employeeId}
                      onChange={setEmployeeId}
                      options={personOptions}
                      sx={{ mb: 2 }}
                    />
                    <LedgerSummary
                      ledger={data.ledger.filter(
                        (l) => l.userId === employeeId,
                      )}
                      month={month}
                      showML={
                        people.find((e) => e.userId === employeeId)?.gender ===
                        "Female"
                      }
                    />
                    <Table
                      headers={[
                        "Employee",
                        "Date",
                        "Balance",
                        "Transaction",
                        "Days",
                        "Reason",
                      ]}
                    >
                      {data.ledger
                        .filter((l) => l.userId === employeeId)
                        .map((l) => (
                          <tr key={l._id}>
                            <td>{nameFor(l.userId)}</td>
                            <td>
                              {l.date === "9999-01-01"
                                ? "Opening (not activated)"
                                : l.date}
                            </td>
                            <td>{l.kind}</td>
                            <td>{l.category}</td>
                            <td className={l.amount > 0 ? "hrm-positive" : ""}>
                              {l.amount > 0 ? "+" : ""}
                              {l.amount}
                            </td>
                            <td>{l.reason || "—"}</td>
                          </tr>
                        ))}
                    </Table>
                  </Panel>
                  {data.isHR && (
                    <Panel
                      title="Manual balance adjustment"
                      description="Every adjustment requires a reason and appears in the audit trail"
                    >
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() =>
                            api("/adjustments", "POST", {
                              ...adjustment,
                              amount: Number(adjustment.amount),
                              operationId: crypto.randomUUID(),
                            }),
                          );
                        }}
                      >
                        <div className="hrm-form-grid">
                          <Field
                            label="Employee"
                            options={personOptions}
                            value={adjustment.userId}
                            onChange={(v) =>
                              setAdjustment({ ...adjustment, userId: v })
                            }
                            required
                          />
                          <Field
                            label="Balance"
                            options={["EL", "WFH", "ML"]}
                            value={adjustment.kind}
                            onChange={(v) =>
                              setAdjustment({ ...adjustment, kind: v })
                            }
                          />
                          <Field
                            label="Date"
                            type="date"
                            value={adjustment.date}
                            onChange={(v) =>
                              setAdjustment({ ...adjustment, date: v })
                            }
                            required
                          />
                          <Field
                            label="Days (+ / −)"
                            type="number"
                            inputProps={{ step: "0.5" }}
                            value={adjustment.amount}
                            onChange={(v) =>
                              setAdjustment({ ...adjustment, amount: v })
                            }
                            required
                          />
                          <Field
                            label="Reason"
                            value={adjustment.reason}
                            onChange={(v) =>
                              setAdjustment({ ...adjustment, reason: v })
                            }
                            required
                          />
                        </div>
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={busy}
                        >
                          Record adjustment
                        </Button>
                      </form>
                    </Panel>
                  )}
                </>
              )}

              {page === "holidays" && (
                <>
                  <Panel
                    title="Company holidays"
                    description="Holiday applicability follows department and location"
                  >
                    <Table
                      headers={[
                        "Date",
                        "Holiday",
                        "Type",
                        "Department",
                        "Location",
                        ...(data.isHR ? ["Action"] : []),
                      ]}
                    >
                      {data.holidays.map((h) => (
                        <tr key={h._id}>
                          <td>{h.date}</td>
                          <td>
                            {h.name}
                            <small>{h.description}</small>
                          </td>
                          <td>{h.holidayType || "Company"}</td>
                          <td>{h.department || "All"}</td>
                          <td>{h.location || "All"}</td>
                          {data.isHR && (
                            <td>
                              <Button
                                color="error"
                                disabled={busy}
                                onClick={() =>
                                  run(() => api(`/holidays/${h._id}`, "DELETE"))
                                }
                              >
                                Remove
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </Table>
                  </Panel>
                  {data.isHR && (
                    <Panel title="Holiday master">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() => api("/holidays", "POST", holiday));
                        }}
                      >
                        <div className="hrm-form-grid">
                          {Object.keys(holiday).map((k) => (
                            <Field
                              key={k}
                              label={
                                k === "department" || k === "location"
                                  ? `${k} (blank = all)`
                                  : k
                              }
                              type={k === "date" ? "date" : "text"}
                              value={holiday[k]}
                              onChange={(v) =>
                                setHoliday({ ...holiday, [k]: v })
                              }
                              required={["name", "date"].includes(k)}
                            />
                          ))}
                        </div>
                        <Button
                          variant="contained"
                          type="submit"
                          disabled={busy}
                        >
                          Save holiday
                        </Button>
                      </form>
                    </Panel>
                  )}
                </>
              )}

              {page === "setup" && (
                <Panel
                  title="Employee HR setup"
                  description="Confirm eligibility, policy group, manager and opening balances before activation"
                >
                  <div className="hrm-form-grid">
                    <Field
                      label="Employee"
                      value={employeeSetup.userId}
                      options={personOptions}
                      onChange={(v) => {
                        const p = people.find((e) => e.userId === v);
                        setEmployeeSetup({
                          userId: v,
                          managerId: p.managerId || "",
                          group: p.group,
                          eligible: p.eligible,
                          exitDate: p.exitDate || "",
                          openingBalances: Object.fromEntries(
                            ["EL", "WFH", "ML"].map((k) => [
                              k,
                              data.ledger.find(
                                (l) => l.key === `opening:${v}:${k}`,
                              )?.amount || 0,
                            ]),
                          ),
                        });
                      }}
                    />
                    <Field
                      label="Reporting manager"
                      value={employeeSetup.managerId}
                      options={[
                        { value: "", label: "Unassigned — HR approves" },
                        ...personOptions.filter(
                          (p) => p.value !== employeeSetup.userId,
                        ),
                      ]}
                      onChange={(v) =>
                        setEmployeeSetup({ ...employeeSetup, managerId: v })
                      }
                    />
                    <Field
                      label="WFH policy group"
                      value={employeeSetup.group}
                      options={["Sales", "Operations"]}
                      onChange={(v) =>
                        setEmployeeSetup({ ...employeeSetup, group: v })
                      }
                    />
                    <Field
                      label="Exit date (optional)"
                      type="date"
                      value={employeeSetup.exitDate}
                      onChange={(v) =>
                        setEmployeeSetup({ ...employeeSetup, exitDate: v })
                      }
                    />
                    {!data.activationDate &&
                      ["EL", "WFH", "ML"].map((k) => (
                        <Field
                          key={k}
                          label={`${k} opening balance (includes activation-month credits)`}
                          type="number"
                          inputProps={{ step: "0.5", min: 0 }}
                          value={employeeSetup.openingBalances[k]}
                          onChange={(v) =>
                            setEmployeeSetup({
                              ...employeeSetup,
                              openingBalances: {
                                ...employeeSetup.openingBalances,
                                [k]: Number(v),
                              },
                            })
                          }
                        />
                      ))}
                  </div>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={employeeSetup.eligible}
                        onChange={(e) =>
                          setEmployeeSetup({
                            ...employeeSetup,
                            eligible: e.target.checked,
                          })
                        }
                      />
                    }
                    label="Eligible for entitlements"
                  />
                  <div className="hrm-actions">
                    <Button
                      variant="contained"
                      disabled={busy || !employeeSetup.userId}
                      onClick={() =>
                        run(() =>
                          api("/setup", "POST", {
                            ...employeeSetup,
                            openingBalances: data.activationDate
                              ? undefined
                              : employeeSetup.openingBalances,
                          }),
                        )
                      }
                    >
                      Confirm employee setup
                    </Button>
                  </div>
                  <Table
                    headers={[
                      "Employee",
                      "Department / location",
                      "Joining",
                      "Manager",
                      "Group",
                      "Setup",
                    ]}
                  >
                    {people.map((e) => (
                      <tr key={e.userId}>
                        <td>
                          {e.name}
                          {e.disabled && <small>Account disabled</small>}
                        </td>
                        <td>
                          {e.department || "Missing"} / {e.branch || "Missing"}
                        </td>
                        <td>{e.dateOfJoining || "Missing"}</td>
                        <td>
                          {e.managerId
                            ? nameFor(e.managerId)
                            : e.reportingManager || "Unassigned"}
                        </td>
                        <td>{e.group}</td>
                        <td>
                          {e.setupConfirmed ? "Confirmed" : "Needs setup"}
                        </td>
                      </tr>
                    ))}
                  </Table>
                </Panel>
              )}

              {page === "settings" && (
                <>
                  <Panel
                    title="HR policy"
                    description="Policies are effective-dated. Existing periods retain the settings effective on their dates."
                  >
                    <div className="hrm-form-grid">
                      <Field
                        label="Effective from"
                        type="date"
                        value={effectiveDate}
                        onChange={setEffectiveDate}
                      />
                      {Object.entries(policy)
                        .filter(
                          ([k]) =>
                            ![
                              "weeklyOffs",
                              "departmentWeeklyOffs",
                              "earlyGoingPenalty",
                              "approvalMode",
                            ].includes(k),
                        )
                        .map(([k, v]) => (
                          <Field
                            key={k}
                            label={POLICY_LABELS[k] || k}
                            type={typeof v === "number" ? "number" : "time"}
                            value={v}
                            onChange={(value) =>
                              setPolicy({
                                ...policy,
                                [k]:
                                  typeof v === "number" ? Number(value) : value,
                              })
                            }
                          />
                        ))}
                      <Field
                        label="Approval workflow"
                        value={policy.approvalMode || "MANAGER_OR_HR"}
                        options={[
                          {
                            value: "MANAGER_OR_HR",
                            label: "Assigned manager or HR",
                          },
                          { value: "HR_ONLY", label: "HR only" },
                        ]}
                        onChange={(v) =>
                          setPolicy({ ...policy, approvalMode: v })
                        }
                      />
                    </div>
                    <WeeklyOffEditor
                      policy={policy}
                      setPolicy={setPolicy}
                      departments={[
                        ...new Set(
                          people.map((e) => e.department).filter(Boolean),
                        ),
                      ]}
                    />
                    <Button
                      variant="contained"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          api("/policy", "POST", {
                            effectiveDate,
                            values: {
                              ...policy,
                              departmentWeeklyOffs:
                                typeof policy.departmentWeeklyOffs === "string"
                                  ? JSON.parse(policy.departmentWeeklyOffs)
                                  : policy.departmentWeeklyOffs,
                            },
                          }),
                        )
                      }
                    >
                      Save policy version
                    </Button>
                    <Table headers={["Effective date", "Saved"]}>
                      {data.policies.map((p) => (
                        <tr key={p._id}>
                          <td>{p.effectiveDate}</td>
                          <td>{stamp(p.createdAt)}</td>
                        </tr>
                      ))}
                    </Table>
                  </Panel>
                  <Panel
                    title="Portal activation"
                    description={
                      data.activationDate
                        ? `Active from ${data.activationDate}. Earlier records keep their historical meaning.`
                        : "Opening balances include the activation month’s entitlements. Automatic credits begin the following month. Choose the first of a month for complete payroll locking; partial activation months keep historical records and payroll starts the next full month."
                    }
                  >
                    {!data.activationDate && (
                      <>
                        <Field
                          label="Activation date"
                          type="date"
                          value={activationDate}
                          onChange={setActivationDate}
                        />
                        <Button
                          sx={{ mt: 2 }}
                          variant="contained"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              api("/activate", "POST", { activationDate }),
                            )
                          }
                        >
                          Activate HRM policies
                        </Button>
                      </>
                    )}
                  </Panel>
                </>
              )}

              {page === "reports" && (
                <Panel
                  title="Reports & exports"
                  description="Payroll exports come exclusively from locked monthly snapshots"
                >
                  <div className="hrm-form-grid">
                    <Field
                      label="Report"
                      value={reportType}
                      onChange={setReportType}
                      options={[
                        "attendance",
                        "leave",
                        "wfh",
                        "source",
                        "late",
                        "early",
                        "halfday",
                        "ua",
                        "payroll",
                      ]}
                    />
                  </div>
                  <div className="hrm-actions">
                    <Button
                      variant="contained"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          setReportRows(
                            await api(
                              `/reports?month=${month}&type=${reportType}`,
                            ),
                          );
                        })
                      }
                    >
                      Generate report
                    </Button>
                    <Button
                      disabled={!reportRows.length}
                      onClick={() =>
                        downloadCSV(
                          reportRows,
                          `HRM-${reportType}-${month}.csv`,
                        )
                      }
                    >
                      Download CSV
                    </Button>
                  </div>
                  <p>{reportRows.length} records</p>
                  <Table
                    headers={[
                      "Employee",
                      "Date / from",
                      "Status / kind",
                      "Payable / units",
                      "Detail",
                    ]}
                  >
                    {reportRows.slice(0, 300).map((r, i) => (
                      <tr key={i}>
                        <td>{r.name || nameFor(r.userId)}</td>
                        <td>{r.date || r.from}</td>
                        <td>{r.status || r.kind}</td>
                        <td>
                          {r.payable ??
                            r.days ??
                            r.data?.days?.reduce((n, d) => n + d.units, 0) ??
                            "—"}
                        </td>
                        <td>
                          <Button onClick={() => setDetail(r)}>Inspect</Button>
                        </td>
                      </tr>
                    ))}
                  </Table>
                </Panel>
              )}

              {page === "audit" && (
                <Panel
                  title="Audit trail"
                  description="Before/after records for HR actions"
                >
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(async () => setAuditRows(await api("/audit")))
                    }
                  >
                    Load latest audit records
                  </Button>
                  <Button
                    disabled={!auditRows.length}
                    onClick={() => downloadCSV(auditRows, "HRM-audit.csv")}
                  >
                    Export
                  </Button>
                  <Table
                    headers={[
                      "When",
                      "Employee",
                      "Module",
                      "Action",
                      "Changed by",
                      "Reason",
                      "Detail",
                    ]}
                  >
                    {auditRows.map((r) => (
                      <tr key={r._id}>
                        <td>{stamp(r.createdAt)}</td>
                        <td>{nameFor(r.userId)}</td>
                        <td>{r.module}</td>
                        <td>{r.action}</td>
                        <td>{nameFor(r.actor)}</td>
                        <td>{r.reason || "—"}</td>
                        <td>
                          <Button onClick={() => setDetail(r)}>Inspect</Button>
                        </td>
                      </tr>
                    ))}
                  </Table>
                </Panel>
              )}
              {page === "activity" && (
                <Panel
                  title="CRM login activity"
                  description="Activity tracking is separate from HR-entered attendance"
                >
                  <div className="hrm-form-grid">
                    <Field
                      type="date"
                      label="Activity date"
                      value={date}
                      onChange={setDate}
                    />
                  </div>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(async () =>
                        setActivityRows(await api(`/activities/${date}`)),
                      )
                    }
                  >
                    Load activity
                  </Button>
                  <Table headers={["Employee", "First online", "Last online"]}>
                    {activityRows.map((r) => (
                      <tr key={r._id}>
                        <td>{r.userId?.name || "Unknown"}</td>
                        <td>{stamp(r.firstOnline)}</td>
                        <td>{stamp(r.lastOnline)}</td>
                      </tr>
                    ))}
                  </Table>
                </Panel>
              )}
              {!data.activationDate && page === "attendance" && (
                <Panel title="Historical attendance & leave">
                  <Timecard />
                </Panel>
              )}
            </>
          )}
          <footer className="hrm-footer">
            HRM Portal <span>Part of your CRM workspace · Asia/Kolkata</span>
          </footer>
        </div>
      </main>

      <Dialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Record details</DialogTitle>
        <DialogContent>
          <RecordDetails value={detail} nameFor={nameFor} />
          {detail?.data?.attachment?.url && (
            <Button
              component="a"
              href={detail.data.attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNew />}
            >
              Open proof
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        fullWidth
      >
        <DialogTitle>
          {decisionForm.verify ? "Sales WFH verification" : "Review request"}
        </DialogTitle>
        <DialogContent>
          <div className="hrm-dialog-fields">
            {decisionForm.verify ? (
              <>
                <Field
                  label="Outcome"
                  value={decisionForm.outcome}
                  onChange={(v) =>
                    setDecisionForm({ ...decisionForm, outcome: v })
                  }
                  options={["Present", "Earned Leave", "Unpaid Leave"]}
                />
                <Field
                  label="Payment / verification reference"
                  value={decisionForm.reference}
                  onChange={(v) =>
                    setDecisionForm({ ...decisionForm, reference: v })
                  }
                  required
                />
              </>
            ) : (
              <>
                <Field
                  label="Decision"
                  value={decisionForm.status}
                  onChange={(v) =>
                    setDecisionForm({ ...decisionForm, status: v })
                  }
                  options={
                    decisionForm.status === "cancelled"
                      ? ["cancelled"]
                      : ["approved", "rejected"]
                  }
                />
                <Field
                  label="Normal / Emergency pay treatment"
                  value={decisionForm.payTreatment || ""}
                  onChange={(v) =>
                    setDecisionForm({ ...decisionForm, payTreatment: v })
                  }
                  options={[
                    { value: "", label: "Choose when applicable" },
                    "EL",
                    "UNPAID",
                  ]}
                />
                <Field
                  label="HR exception reason (if required)"
                  value={decisionForm.overrideReason || ""}
                  onChange={(v) =>
                    setDecisionForm({ ...decisionForm, overrideReason: v })
                  }
                />
                {decision?.kind === "REGULARISATION" && (
                  <>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(decisionForm.excusedLate)}
                          onChange={(e) =>
                            setDecisionForm({
                              ...decisionForm,
                              excusedLate: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Excuse late arrival"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(decisionForm.excusedHalfDay)}
                          onChange={(e) =>
                            setDecisionForm({
                              ...decisionForm,
                              excusedHalfDay: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Excuse half-day rule"
                    />
                  </>
                )}
              </>
            )}
            <Field
              label="Remarks"
              value={decisionForm.remarks || ""}
              onChange={(v) => setDecisionForm({ ...decisionForm, remarks: v })}
              multiline
              required
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecision(null)}>Back</Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() =>
              run(async () => {
                if (decision.legacy) {
                  const res = await fetch(`${apiUrl}/leaves/${decision._id}`, {
                    method: "PATCH",
                    headers: {
                      Authorization: session.token,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      ...decisionForm,
                      notes: decisionForm.remarks,
                    }),
                  });
                  const result = await res.json();
                  if (!res.ok) throw new Error(result.message);
                } else
                  await api(
                    decisionForm.verify
                      ? `/requests/${decision._id}/verify`
                      : decision.kind === "REGULARISATION"
                        ? `/regularisations/${decision._id}`
                        : `/requests/${decision._id}`,
                    decisionForm.verify ? "POST" : "PATCH",
                    decisionForm,
                  );
                setDecision(null);
              })
            }
          >
            Save decision
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(editAttendance)}
        onClose={() => setEditAttendance(null)}
        fullWidth
      >
        <DialogTitle>Attendance correction / override</DialogTitle>
        <DialogContent>
          {editAttendance && (
            <div className="hrm-dialog-fields">
              <Field
                label="Date"
                type="date"
                value={editAttendance.date}
                onChange={(v) =>
                  setEditAttendance({ ...editAttendance, date: v })
                }
              />
              <Field
                label="Check-in"
                type="time"
                value={editAttendance.checkIn}
                onChange={(v) =>
                  setEditAttendance({ ...editAttendance, checkIn: v })
                }
              />
              <Field
                label="Check-out (blank = auto at day end)"
                type="time"
                value={editAttendance.checkOut}
                onChange={(v) =>
                  setEditAttendance({ ...editAttendance, checkOut: v })
                }
              />
              <Field
                label="Override status"
                value={editAttendance.override?.status || ""}
                options={[
                  { value: "", label: "Use attendance rules / clear override" },
                  "Present",
                  "Absent",
                  "UA",
                  "Half Day",
                ]}
                onChange={(v) =>
                  setEditAttendance({
                    ...editAttendance,
                    override: v
                      ? {
                          status: v,
                          payable:
                            v === "Present"
                              ? 1
                              : v === "Half Day"
                                ? 0.5
                                : v === "UA"
                                  ? -1
                                  : 0,
                        }
                      : undefined,
                    clearOverride: !v,
                  })
                }
              />
              {editAttendance.override?.status === "UA" && (
                <Field
                  label="UA: EL units allocated (0–2, remainder unpaid)"
                  type="number"
                  inputProps={{ step: "0.5", min: 0, max: 2 }}
                  value={editAttendance.uaEL || 0}
                  onChange={(v) =>
                    setEditAttendance({
                      ...editAttendance,
                      uaEL: Number(v),
                      override: { status: "UA", payable: Number(v) - 1 },
                    })
                  }
                />
              )}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(editAttendance.reviewConfirmed)}
                    onChange={(e) =>
                      setEditAttendance({
                        ...editAttendance,
                        reviewConfirmed: e.target.checked,
                      })
                    }
                  />
                }
                label="I verified CRM, WhatsApp/offline, emergency and WFH records."
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(editAttendance.excusedLate)}
                    onChange={(e) =>
                      setEditAttendance({
                        ...editAttendance,
                        excusedLate: e.target.checked,
                      })
                    }
                  />
                }
                label="Excuse late arrival"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(editAttendance.excusedHalfDay)}
                    onChange={(e) =>
                      setEditAttendance({
                        ...editAttendance,
                        excusedHalfDay: e.target.checked,
                      })
                    }
                  />
                }
                label="Override half-day rule"
              />
              <Field
                label="Required remarks"
                value={editAttendance.remarks}
                onChange={(v) =>
                  setEditAttendance({ ...editAttendance, remarks: v })
                }
                multiline
                required
              />
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAttendance(null)}>Back</Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api("/attendance", "POST", editAttendance);
                setEditAttendance(null);
              })
            }
          >
            Save correction
          </Button>
        </DialogActions>
      </Dialog>
      {busy && (
        <div className="hrm-saving">
          <CircularProgress size={16} color="inherit" /> Saving…
        </div>
      )}
    </div>
  );
}

function AttendanceEntry({ employee, row, onSave, onEdit, busy }) {
  const [checkIn, setCheckIn] = useState(row.checkIn || ""),
    [checkOut, setCheckOut] = useState(
      row.checkOutSource === "AUTO" ? "" : row.checkOut || "",
    ),
    [remarks, setRemarks] = useState("");
  return (
    <tr>
      <td>
        <strong>{employee.name}</strong>
        <small>{employee.department}</small>
      </td>
      <td>
        <TextField
          aria-label={`${employee.name} check-in`}
          size="small"
          type="time"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
        />
      </td>
      <td>
        <TextField
          aria-label={`${employee.name} check-out`}
          size="small"
          type="time"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
        />
        {row.checkOutSource === "AUTO" && <small>AUTO {row.checkOut}</small>}
      </td>
      <td>
        <Status value={row.status} />
      </td>
      <td>{row.earlyGoingMinutes ? `${row.earlyGoingMinutes} min` : "—"}</td>
      <td>
        <TextField
          size="small"
          label="Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        <div>
          <Button
            disabled={busy}
            onClick={() => onSave({ checkIn, checkOut, remarks })}
          >
            Save
          </Button>
          <Button onClick={onEdit}>More</Button>
        </div>
      </td>
    </tr>
  );
}

function RecordDetails({ value, nameFor }) {
  if (!value) return null;
  return (
    <dl className="hrm-record-details">
      {Object.entries(value)
        .filter(([k]) => !["__v", "_id"].includes(k))
        .map(([k, v]) => (
          <React.Fragment key={k}>
            <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
            <dd>
              {v && typeof v === "object" ? (
                <RecordDetails value={v} nameFor={nameFor} />
              ) : typeof v === "boolean" ? (
                v ? (
                  "Yes"
                ) : (
                  "No"
                )
              ) : /userId|actor|enteredBy$|managerId/.test(k) ? (
                nameFor(String(v))
              ) : (
                String(v ?? "—")
              )}
            </dd>
          </React.Fragment>
        ))}
    </dl>
  );
}

function estimateDays(request, employee = {}, policy = {}, holidays = []) {
  const from = new Date(request.from),
    to = new Date(request.to);
  const count = (to - from) / 86400000;
  if (!Number.isFinite(count) || count < 0 || count > 366) return 0;
  let days = 0;
  for (let i = 0; i <= count; i++) {
    const date = new Date(+from + i * 86400000),
      key = date.toISOString().slice(0, 10);
    const off = (
      policy.departmentWeeklyOffs?.[employee.department] ||
      policy.weeklyOffs || [0]
    ).includes(date.getUTCDay());
    const holiday = holidays.some(
      (h) =>
        h.date === key &&
        (!h.department || h.department === employee.department) &&
        (!h.location || h.location === employee.branch),
    );
    if (!off && !holiday) days += request.halfDay ? 0.5 : 1;
  }
  return days;
}

function WeeklyOffEditor({ policy, setPolicy, departments }) {
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const toggle = (days, day, checked) =>
    checked
      ? [...new Set([...days, day])].sort()
      : days.filter((d) => d !== day);
  return (
    <div style={{ marginBottom: 24 }}>
      <h3>Weekly offs</h3>
      <p>Default workweek</p>
      <div className="hrm-actions">
        {weekdays.map((name, day) => (
          <FormControlLabel
            key={name}
            label={name}
            control={
              <Checkbox
                checked={(policy.weeklyOffs || []).includes(day)}
                onChange={(e) =>
                  setPolicy((p) => ({
                    ...p,
                    weeklyOffs: toggle(
                      p.weeklyOffs || [],
                      day,
                      e.target.checked,
                    ),
                  }))
                }
              />
            }
          />
        ))}
      </div>
      <p>Department schedules</p>
      {departments.map((department) => {
        const overrides = policy.departmentWeeklyOffs || {},
          custom = Object.hasOwn(overrides, department);
        return (
          <details className="hrm-employee-detail" key={department}>
            <summary>
              {department} · {custom ? "Custom schedule" : "Uses default"}
            </summary>
            <FormControlLabel
              label="Use default workweek"
              control={
                <Checkbox
                  checked={!custom}
                  onChange={(e) =>
                    setPolicy((p) => {
                      const values = { ...p.departmentWeeklyOffs };
                      if (e.target.checked) delete values[department];
                      else values[department] = [...(p.weeklyOffs || [])];
                      return { ...p, departmentWeeklyOffs: values };
                    })
                  }
                />
              }
            />
            {custom && (
              <div className="hrm-actions">
                {weekdays.map((name, day) => (
                  <FormControlLabel
                    key={name}
                    label={name}
                    control={
                      <Checkbox
                        checked={overrides[department].includes(day)}
                        onChange={(e) =>
                          setPolicy((p) => ({
                            ...p,
                            departmentWeeklyOffs: {
                              ...p.departmentWeeklyOffs,
                              [department]: toggle(
                                p.departmentWeeklyOffs[department],
                                day,
                                e.target.checked,
                              ),
                            },
                          }))
                        }
                      />
                    }
                  />
                ))}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}

function LedgerSummary({ ledger, month, showML }) {
  const [year, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
  return (
    <Table
      headers={[
        "Balance / period",
        "Opening",
        "Credited",
        "Used",
        "Adjust / reverse",
        "Expired",
        "Closing",
      ]}
    >
      {["EL", "WFH", ...(showML ? ["ML"] : [])].map((kind) => {
        const start =
          kind === "EL"
            ? `${m >= 4 ? year : year - 1}-04-01`
            : kind === "WFH"
              ? `${year}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`
              : `${month}-01`;
        const rows = ledger.filter((l) => l.kind === kind && l.date <= end);
        const inPeriod = rows.filter((l) => l.date >= start),
          sum = (entries) => entries.reduce((n, l) => n + l.amount, 0);
        const opening =
          sum(rows.filter((l) => l.date < start)) +
          sum(inPeriod.filter((l) => l.category === "Opening"));
        return (
          <tr key={kind}>
            <td>
              {kind}
              <small>
                {start} – {end}
              </small>
            </td>
            <td>{opening}</td>
            <td>
              {sum(inPeriod.filter((l) => l.category === "Monthly Credit"))}
            </td>
            <td>
              {
                -sum(
                  inPeriod.filter((l) => ["Usage", "UA"].includes(l.category)),
                )
              }
            </td>
            <td>
              {sum(
                inPeriod.filter((l) =>
                  ["Adjustment", "Reversal"].includes(l.category),
                ),
              )}
            </td>
            <td>{-sum(inPeriod.filter((l) => l.category === "Expiry"))}</td>
            <td>{sum(rows)}</td>
          </tr>
        );
      })}
    </Table>
  );
}
