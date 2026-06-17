import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import Loader from "./Loader";
import { apiUrl } from "./LoginSignup";
import {
  getBookingDeductionRowsForUser,
  getBookingRevenueForUser,
} from "../utils/bookingRevenue";

const adminRoles = ["admin", "senior admin", "super admin", "director", "dev", "srdev", "sr dev"];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
};

const getInitials = (name = "") =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase() || "NA";

const summaryCardPalette = [
  { bg: "linear-gradient(180deg, rgba(20,184,166,0.14) 0%, rgba(255,255,255,0.98) 100%)", color: "#0f766e" },
  { bg: "linear-gradient(180deg, rgba(59,130,246,0.12) 0%, rgba(255,255,255,0.98) 100%)", color: "#2563eb" },
  { bg: "linear-gradient(180deg, rgba(249,115,22,0.12) 0%, rgba(255,255,255,0.98) 100%)", color: "#ea580c" },
  { bg: "linear-gradient(180deg, rgba(236,72,153,0.12) 0%, rgba(255,255,255,0.98) 100%)", color: "#db2777" },
];

const Scorecard = () => {
  const theme = useTheme();
  const session = JSON.parse(localStorage.getItem("userSession")) || {};
  const isAdmin = adminRoles.includes((session.user_role || "").toLowerCase());

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [expandedEmployee, setExpandedEmployee] = useState(session.user_id || "");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = { authorization: session.token || "" };
        const bookingsUrl = isAdmin ? `${apiUrl}/booking/all` : `${apiUrl}/user/bookings/${session.user_id}`;
        const [bookingsRes, usersRes] = await Promise.all([
          fetch(bookingsUrl, { headers }),
          isAdmin ? fetch(`${apiUrl}/user/options`, { headers }) : Promise.resolve(null),
        ]);

        const bookingsData = await bookingsRes.json().catch(() => ({}));
        setBookings(bookingsData.Allbookings || bookingsData.bookings || bookingsData || []);

        if (isAdmin && usersRes?.ok) {
          const usersData = await usersRes.json().catch(() => ({}));
          setUsers(Array.isArray(usersData.users) ? usersData.users : []);
        } else {
          setUsers([]);
        }
      } catch (error) {
        setBookings([]);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin, session.token, session.user_id]);

  const employeeCards = useMemo(() => {
    const employeePool = isAdmin
      ? users
      : [{
          _id: session.user_id,
          name: session.name || "My Scorecard",
          role: session.user_role || "",
          profilePicture: session.profilePicture || "",
        }];

    return employeePool
      .map((employee) => {
        const employeeId = employee._id;
        const rows = [];

        bookings.forEach((booking) => {
          const revenue = getBookingRevenueForUser(booking, employeeId, false, () => true);
          if (revenue > 0) {
            rows.push({
              type: "Revenue",
              date: booking.payment_date || booking.date || booking.createdAt,
              bookingId: booking._id,
              companyName: booking.company_name || "-",
              clientName: booking.contact_person || "-",
              service: Array.isArray(booking.services) ? booking.services.join(", ") : booking.services || "-",
              amount: revenue,
              tone: "success",
              note: "Net credited after GST and deductions",
            });
          }

          getBookingDeductionRowsForUser(booking, employeeId, false, () => true).forEach((row) => {
            rows.push({
              type: row.type,
              date: row.date,
              bookingId: row.bookingId,
              companyName: row.companyName || "-",
              clientName: row.clientName || "-",
              service: row.service || "-",
              amount: row.deduction || 0,
              tone: row.type === "Refundable Deduction" ? "warning" : "error",
              note: row.type,
            });
          });
        });

        if (!isAdmin && String(employeeId) !== String(session.user_id)) return null;

        const sortedRows = rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        const revenue = sortedRows.filter((row) => row.type === "Revenue").reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const deductions = sortedRows.filter((row) => row.type !== "Revenue").reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const refundable = sortedRows.filter((row) => row.type === "Refundable Deduction").reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const bookingCount = new Set(sortedRows.map((row) => row.bookingId).filter(Boolean)).size;
        const net = revenue - deductions;

        return {
          ...employee,
          rows: sortedRows,
          revenue,
          deductions,
          refundable,
          net,
          bookingCount,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.net - a.net);
  }, [bookings, isAdmin, session.name, session.profilePicture, session.user_id, session.user_role, users]);

  useEffect(() => {
    if (!expandedEmployee && employeeCards[0]?._id) {
      setExpandedEmployee(employeeCards[0]._id);
    }
  }, [employeeCards, expandedEmployee]);

  const dashboardStats = useMemo(() => {
    const totals = employeeCards.reduce((acc, item) => {
      acc.revenue += item.revenue;
      acc.deductions += item.deductions;
      acc.refundable += item.refundable;
      acc.net += item.net;
      return acc;
    }, { revenue: 0, deductions: 0, refundable: 0, net: 0 });

    return [
      { label: "Net Revenue", value: totals.net, sub: "After all cuts", icon: <InsightsOutlinedIcon fontSize="small" />, color: "#0f766e" },
      { label: "Gross Revenue", value: totals.revenue, sub: "Before reversals", icon: <CurrencyRupeeOutlinedIcon fontSize="small" />, color: "#2563eb" },
      { label: "Total Deductions", value: totals.deductions, sub: "Vendor + refund + refundable", icon: <PaidOutlinedIcon fontSize="small" />, color: "#ea580c" },
      { label: "Refundable Cuts", value: totals.refundable, sub: "Refundable clause only", icon: <ReceiptLongOutlinedIcon fontSize="small" />, color: "#db2777" },
    ];
  }, [employeeCards]);

  const surfaceSx = {
    borderRadius: "8px",
    border: "1px solid",
    borderColor: "divider",
    boxShadow: theme.palette.mode === "dark" ? "0 14px 30px rgba(2,6,23,0.3)" : "0 14px 34px rgba(15,23,42,0.06)",
    background: theme.palette.mode === "dark"
      ? "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.94) 100%)"
      : "#ffffff",
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <Loader />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1560, mx: "auto", width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <InsightsOutlinedIcon sx={{ color: "#14b8a6" }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Scorecard
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Employee-wise revenue history with deductions, refundable cuts, and booking-wise ledger.
          </Typography>
        </Box>
        <Chip
          label={isAdmin ? `${employeeCards.length} employees` : "My scorecard"}
          sx={{ borderRadius: "999px", fontWeight: 800 }}
        />
      </Box>

      <Grid container spacing={{ xs: 1.25, sm: 1.5, md: 1.75 }} sx={{ mb: 2.25 }}>
        {dashboardStats.map((card, index) => (
          <Grid item xs={6} md={3} key={card.label}>
            <Card sx={{ ...surfaceSx, height: "100%" }}>
              <CardContent sx={{ p: { xs: 1.3, sm: 1.5 } }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                      {card.label}
                    </Typography>
                    <Typography sx={{ mt: 0.45, fontWeight: 800, color: card.color, fontSize: { xs: "0.95rem", sm: "1.25rem" } }}>
                      {formatCurrency(card.value)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {card.sub}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 36, height: 36, borderRadius: "8px", display: "grid", placeItems: "center", bgcolor: `${card.color}18`, color: card.color }}>
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ ...surfaceSx, p: { xs: 1.2, sm: 1.5, md: 1.8 } }}>
        <Box sx={{ mb: 1.6 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Employee Scorecards
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tap or click an employee row to expand the latest transaction history.
          </Typography>
        </Box>

        <Stack spacing={1.25}>
          {employeeCards.length === 0 && (
            <Paper sx={{ p: 2, borderRadius: "8px", textAlign: "center" }}>
              <Typography color="text.secondary">No scorecard entries found.</Typography>
            </Paper>
          )}

          {employeeCards.map((employee, index) => {
            const palette = summaryCardPalette[index % summaryCardPalette.length];
            const isExpanded = String(expandedEmployee) === String(employee._id);

            return (
              <Accordion
                key={employee._id || employee.name}
                expanded={isExpanded}
                onChange={(_, expanded) => setExpandedEmployee(expanded ? employee._id : "")}
                disableGutters
                sx={{
                  borderRadius: "8px !important",
                  border: "1px solid",
                  borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.16)",
                  boxShadow: "none",
                  overflow: "hidden",
                  background: theme.palette.mode === "dark" ? "rgba(15,23,42,0.9)" : palette.bg,
                  "&:before": { display: "none" },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreRoundedIcon />}
                  sx={{
                    px: { xs: 1.2, sm: 1.5 },
                    py: 0.4,
                    "& .MuiAccordionSummary-content": { my: 1.1 },
                  }}
                >
                  <Box sx={{ width: "100%" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                      <Avatar src={employee.profilePicture || ""} sx={{ width: 44, height: 44, bgcolor: `${palette.color}20`, color: palette.color, fontWeight: 800 }}>
                        {getInitials(employee.name)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: { xs: "0.96rem", sm: "1rem" } }} noWrap>
                          {employee.name || "Employee"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {(employee.role || "").toUpperCase() || "TEAM MEMBER"}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
                          gap: 1,
                          width: { xs: "100%", md: "auto" },
                          minWidth: { md: 560 },
                        }}
                      >
                        {[
                          { label: "Bookings", value: employee.bookingCount, color: palette.color },
                          { label: "Revenue", value: formatCurrency(employee.revenue), color: "#059669" },
                          { label: "Deductions", value: formatCurrency(employee.deductions), color: "#ea580c" },
                          { label: "Net", value: formatCurrency(employee.net), color: "#2563eb" },
                        ].map((item) => (
                          <Box
                            key={item.label}
                            sx={{
                              borderRadius: "8px",
                              px: 1.1,
                              py: 0.9,
                              bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.86)",
                              border: "1px solid",
                              borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.14)" : "rgba(148,163,184,0.12)",
                            }}
                          >
                            <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                              {item.label}
                            </Typography>
                            <Typography sx={{ fontWeight: 800, color: item.color, fontSize: { xs: "0.82rem", sm: "0.9rem" } }}>
                              {item.value}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ px: { xs: 1.2, sm: 1.5 }, pb: { xs: 1.3, sm: 1.5 } }}>
                  <Divider sx={{ mb: 1.3 }} />
                  <Stack spacing={1}>
                    {employee.rows.length === 0 && (
                      <Typography color="text.secondary">No scorecard entries found for this employee.</Typography>
                    )}

                    {employee.rows.map((row, rowIndex) => (
                      <Paper
                        key={`${employee._id}-${row.bookingId}-${row.type}-${rowIndex}`}
                        variant="outlined"
                        sx={{
                          p: 1.25,
                          borderRadius: "8px",
                          borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.16)" : "rgba(148,163,184,0.14)",
                          boxShadow: "none",
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 0.8, flexWrap: "wrap", alignItems: "center" }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Chip
                              size="small"
                              label={row.type}
                              sx={{
                                borderRadius: "999px",
                                fontWeight: 800,
                                bgcolor: row.tone === "success" ? "rgba(16,185,129,0.12)" : row.tone === "warning" ? "rgba(249,115,22,0.12)" : "rgba(225,29,72,0.12)",
                                color: row.tone === "success" ? "#059669" : row.tone === "warning" ? "#ea580c" : "#e11d48",
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                              {formatDate(row.date)}
                            </Typography>
                          </Stack>
                          <Typography sx={{ fontWeight: 900, color: row.type === "Revenue" ? "#059669" : "#e11d48" }}>
                            {row.type === "Revenue" ? formatCurrency(row.amount) : `- ${formatCurrency(row.amount)}`}
                          </Typography>
                        </Box>

                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr)" },
                            gap: 1,
                          }}
                        >
                          <Box>
                            <Typography sx={{ fontWeight: 800 }}>{row.companyName}</Typography>
                            <Typography variant="body2" color="text.secondary">{row.clientName}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", fontWeight: 700 }}>Service</Typography>
                            <Typography variant="body2">{row.service}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", fontWeight: 700 }}>Note</Typography>
                            <Typography variant="body2">{row.note}</Typography>
                          </Box>
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>
      </Paper>
    </Box>
  );
};

export default Scorecard;
