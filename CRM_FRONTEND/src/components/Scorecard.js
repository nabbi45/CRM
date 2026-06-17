import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
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

const Scorecard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const session = JSON.parse(localStorage.getItem("userSession")) || {};
  const isAdmin = adminRoles.includes((session.user_role || "").toLowerCase());

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(session.user_id || "");

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

  useEffect(() => {
    if (!selectedEmployeeId && session.user_id) {
      setSelectedEmployeeId(session.user_id);
    }
  }, [selectedEmployeeId, session.user_id]);

  const selectedEmployeeName = useMemo(() => {
    if (!isAdmin) return session.name || "My Scorecard";
    return users.find((user) => String(user._id) === String(selectedEmployeeId))?.name || "Employee";
  }, [isAdmin, selectedEmployeeId, session.name, users]);

  const scoreRows = useMemo(() => {
    const employeeId = isAdmin ? selectedEmployeeId : session.user_id;
    if (!employeeId) return [];

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

    return rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [bookings, isAdmin, selectedEmployeeId, session.user_id]);

  const totals = useMemo(() => {
    const revenue = scoreRows.filter((row) => row.type === "Revenue").reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const deductions = scoreRows.filter((row) => row.type !== "Revenue").reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const refundable = scoreRows
      .filter((row) => row.type === "Refundable Deduction")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return {
      revenue,
      deductions,
      refundable,
      net: revenue - deductions,
    };
  }, [scoreRows]);

  const statCards = [
    { label: "Net Scorecard", value: totals.net, sub: "Revenue after all reversals", color: "#14b8a6", icon: <InsightsOutlinedIcon fontSize="small" /> },
    { label: "Gross Revenue", value: totals.revenue, sub: "Credited from bookings", color: "#10b981", icon: <CurrencyRupeeOutlinedIcon fontSize="small" /> },
    { label: "Total Deductions", value: totals.deductions, sub: "Service, refundable, refund", color: "#f97316", icon: <PaidOutlinedIcon fontSize="small" /> },
    { label: "Refundable Cuts", value: totals.refundable, sub: "Refundable clause impact", color: "#e11d48", icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
  ];

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
            Transaction-wise employee history with revenue, deductions, refundable cuts, and reversals.
          </Typography>
        </Box>

        {isAdmin && (
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 260 } }}>
            <InputLabel>Employee</InputLabel>
            <Select
              label="Employee"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            >
              {users.map((user) => (
                <MenuItem key={user._id} value={user._id}>
                  {user.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      <Grid container spacing={{ xs: 1.25, sm: 1.5, md: 1.75 }} sx={{ mb: 2.25 }}>
        {statCards.map((card) => (
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

      <Paper sx={{ ...surfaceSx, p: { xs: 1.2, sm: 1.6, md: 1.8 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, mb: 1.75, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {isAdmin ? `${selectedEmployeeName} Ledger` : "My Ledger"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Latest entries first. Revenue rows are green, deductions are highlighted separately.
            </Typography>
          </Box>
          <Chip label={`${scoreRows.length} entries`} sx={{ borderRadius: "8px", fontWeight: 700 }} />
        </Box>

        {isMobile ? (
          <Stack spacing={1.2}>
            {scoreRows.length === 0 && (
              <Paper sx={{ p: 2, borderRadius: "8px", textAlign: "center" }}>
                <Typography color="text.secondary">No scorecard entries found.</Typography>
              </Paper>
            )}
            {scoreRows.map((row, index) => (
              <Paper key={`${row.bookingId}-${row.type}-${index}`} sx={{ p: 1.4, borderRadius: "8px", border: "1px solid", borderColor: "divider", boxShadow: "none" }}>
                <Stack spacing={0.7}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Chip
                      size="small"
                      label={row.type}
                      sx={{
                        borderRadius: "8px",
                        fontWeight: 700,
                        bgcolor: row.tone === "success" ? "rgba(16,185,129,0.12)" : row.tone === "warning" ? "rgba(249,115,22,0.12)" : "rgba(225,29,72,0.12)",
                        color: row.tone === "success" ? "#059669" : row.tone === "warning" ? "#ea580c" : "#e11d48",
                      }}
                    />
                    <Typography sx={{ fontWeight: 800, color: row.tone === "success" ? "#059669" : "#e11d48" }}>
                      {row.type === "Revenue" ? formatCurrency(row.amount) : `- ${formatCurrency(row.amount)}`}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontWeight: 800 }}>{row.companyName}</Typography>
                  <Typography variant="body2" color="text.secondary">{row.clientName}</Typography>
                  <Typography variant="body2"><strong>Service:</strong> {row.service}</Typography>
                  <Typography variant="body2"><strong>Date:</strong> {formatDate(row.date)}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.note}</Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scoreRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      No scorecard entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  scoreRows.map((row, index) => (
                    <TableRow key={`${row.bookingId}-${row.type}-${index}`}>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.type}
                          sx={{
                            borderRadius: "8px",
                            fontWeight: 700,
                            bgcolor: row.tone === "success" ? "rgba(16,185,129,0.12)" : row.tone === "warning" ? "rgba(249,115,22,0.12)" : "rgba(225,29,72,0.12)",
                            color: row.tone === "success" ? "#059669" : row.tone === "warning" ? "#ea580c" : "#e11d48",
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{row.companyName}</TableCell>
                      <TableCell>{row.clientName}</TableCell>
                      <TableCell>{row.service}</TableCell>
                      <TableCell>{row.note}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: row.type === "Revenue" ? "#059669" : "#e11d48" }}>
                        {row.type === "Revenue" ? formatCurrency(row.amount) : `- ${formatCurrency(row.amount)}`}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default Scorecard;
