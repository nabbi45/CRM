import React, { useEffect, useState, useRef } from "react";
import { apiUrl } from "./LoginSignup";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
} from "@mui/material";
import { Brightness4, Brightness7 } from "@mui/icons-material";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import BookOnlineOutlinedIcon from "@mui/icons-material/BookOnlineOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import { Chart } from "chart.js/auto";
import Loader from "./Loader";
import { useColorMode } from "../context/AppThemeProvider";

const ACCENT = "#e87c2a";
const ACCENT_LIGHT = "rgba(232,124,42,0.12)";

const DashboardContent = () => {
  const userSession = JSON.parse(localStorage.getItem("userSession"));

  const [totalBookings, setTotalBookings] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [recentBookings, setRecentBookings] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [monthlyRevData, setMonthlyRevData] = useState({ labels: [], values: [] });
  const [loading, setLoading] = useState(true);
  const { mode, toggleColorMode } = useColorMode();

  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const isAdmin = ["admin", "dev", "senior admin", "srdev"].includes(
    userSession?.user_role
  );

  const getTodayDate = () => new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (userSession?.user_id) {
      fetchDashboardData(userSession);
    } else {
      console.error("User session not found.");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw chart after data arrives
  useEffect(() => {
    if (monthlyRevData.labels.length === 0 || !chartRef.current) return;
    const ctx = chartRef.current.getContext("2d");
    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: monthlyRevData.labels,
        datasets: [
          {
            label: "Revenue (₹)",
            data: monthlyRevData.values,
            backgroundColor: ACCENT,
            borderRadius: 6,
            barPercentage: 0.55,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `₹${ctx.raw.toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => `₹${(v / 1000).toFixed(0)}k`,
              font: { size: 11 },
            },
            grid: { color: "rgba(148,163,184,0.15)" },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyRevData]);

  const fetchDashboardData = async (session) => {
    try {
      const bookingUrl = isAdmin
        ? `${apiUrl}/booking/all`
        : `${apiUrl}/user/bookings/${session.user_id}`;

      const fetches = [
        fetch(bookingUrl, {
          headers: {
            "Content-Type": "application/json",
            authorization: session.token,
          },
        }),
      ];

      if (isAdmin) {
        fetches.push(
          fetch(`${apiUrl}/user/all`, {
            headers: {
              "Content-Type": "application/json",
              authorization: session.token,
            },
          })
        );
      }

      const results = await Promise.all(fetches);
      const bookingsRes = results[0];
      if (!bookingsRes.ok) throw new Error("Failed API call");

      const bookingsData = await bookingsRes.json();
      const bookings = bookingsData.Allbookings || bookingsData;

      if (isAdmin && results[1]) {
        const usersData = await results[1].json();
        setTotalUsers(usersData.Users?.length || 0);
      }

      const today = getTodayDate();
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      let bookingCount = 0;
      let currentMonthRevenue = 0;
      let todayRevenueAmt = 0;
      const sortedBookings = [];
      const bdmRevMap = {}; // { bdmName: {revenue, count} }
      const monthlyMap = {}; // { "YYYY-MM": revenue }

      for (const booking of bookings) {
        bookingCount++;
        const rev =
          (booking.term_1 || 0) +
          (booking.term_2 || 0) +
          (booking.term_3 || 0);

        const paymentDate = new Date(booking.payment_date);

        if (
          paymentDate.getMonth() === currentMonth &&
          paymentDate.getFullYear() === currentYear
        ) {
          currentMonthRevenue += rev;
        }

        if (booking.createdAt?.split("T")[0] === today) {
          todayRevenueAmt += rev;
        }

        // Leaderboard aggregation (current month)
        if (
          paymentDate.getMonth() === currentMonth &&
          paymentDate.getFullYear() === currentYear
        ) {
          const bdm = booking.bdm || "Unknown";
          if (!bdmRevMap[bdm]) bdmRevMap[bdm] = { revenue: 0, count: 0 };
          bdmRevMap[bdm].revenue += rev;
          bdmRevMap[bdm].count += 1;
        }

        // Monthly revenue (last 6 months)
        const key = `${paymentDate.getFullYear()}-${String(
          paymentDate.getMonth() + 1
        ).padStart(2, "0")}`;
        if (!monthlyMap[key]) monthlyMap[key] = 0;
        monthlyMap[key] += rev;

        sortedBookings.push(booking);
      }

      // Build leaderboard sorted by revenue desc
      const board = Object.entries(bdmRevMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue);
      setLeaderboard(board);

      // Build last 6 months chart data
      const months = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        months.push({
          label: d.toLocaleString("default", { month: "short" }),
          value: monthlyMap[key] || 0,
        });
      }
      setMonthlyRevData({
        labels: months.map((m) => m.label),
        values: months.map((m) => m.value),
      });

      const recent = sortedBookings
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 7);

      setTotalBookings(bookingCount);
      setTotalRevenue(currentMonthRevenue);
      setTodayRevenue(todayRevenueAmt);
      setRecentBookings(recent);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Loader />
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <Box sx={{ p: 2, animation: 'fadeIn 0.5s ease-out', '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          mb: 3,
          alignItems: "center",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Dashboard
        </Typography>
      </Box>

      {/* ── Stat Cards ── */}
      <Grid container spacing={2.5}>
        {[
          {
            label: "Bookings",
            value: totalBookings,
            sub: isAdmin ? "Total Bookings" : "Your Bookings",
            icon: <BookOnlineOutlinedIcon />,
            color: "#3b82f6",
          },
          ...(isAdmin
            ? [
              {
                label: "Total Users",
                value: totalUsers,
                sub: "CRM users",
                icon: <PeopleAltOutlinedIcon />,
                color: "#8b5cf6",
              },
            ]
            : []),
          {
            label: `Revenue ${new Date().toLocaleString("default", {
              month: "short",
            })}`,
            value: `₹${totalRevenue.toLocaleString()}`,
            sub: "This month",
            icon: <CurrencyRupeeOutlinedIcon />,
            color: ACCENT,
          },
          {
            label: "Today's Revenue",
            value: `₹${todayRevenue.toLocaleString()}`,
            sub: "From today's bookings",
            icon: <TodayOutlinedIcon />,
            color: "#10b981",
          },
        ].map((c, i) => (
          <Grid item xs={12} sm={6} md={isAdmin ? 3 : 4} key={i}>
            <Card sx={{ 
              position: "relative", overflow: "visible",
              animation: 'slideUp 0.4s ease-out both',
              animationDelay: `${i * 0.08}s`,
              '@keyframes slideUp': {
                from: { opacity: 0, transform: 'translateY(20px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
            }}>
              <CardContent sx={{ pb: '16px !important' }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: "0.78rem", mb: 0.5 }}
                    >
                      {c.label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {c.value}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      {c.sub}
                    </Typography>
                  </Box>
                  <Avatar
                    sx={{
                      bgcolor: `${c.color}18`,
                      color: c.color,
                      width: 42,
                      height: 42,
                    }}
                  >
                    {c.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Charts + Leaderboard Row ── */}
      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        {/* Monthly Revenue Chart */}
        <Grid item xs={12} md={isAdmin ? 7 : 12}>
          <Card sx={{ animation: 'slideUp 0.5s ease-out 0.3s both', '@keyframes slideUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <TrendingUpOutlinedIcon
                    sx={{ color: ACCENT, fontSize: 20 }}
                  />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Monthly Revenue
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Last 6 months
                </Typography>
              </Box>
              <Box sx={{ height: 260 }}>
                <canvas ref={chartRef} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Leaderboard — only for admin */}
        {isAdmin && (
          <Grid item xs={12} md={5}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <EmojiEventsOutlinedIcon
                    sx={{ color: ACCENT, fontSize: 20 }}
                  />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Revenue Leaderboard
                  </Typography>
                  <Chip
                    size="small"
                    label={new Date().toLocaleString("default", {
                      month: "short",
                    })}
                    sx={{
                      ml: "auto",
                      bgcolor: ACCENT_LIGHT,
                      color: ACCENT,
                      fontWeight: 600,
                      fontSize: "0.7rem",
                    }}
                  />
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Employee</TableCell>
                        <TableCell align="right">Bookings</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leaderboard.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No data this month
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {leaderboard.map((entry, idx) => (
                        <TableRow
                          key={entry.name}
                          sx={{
                            bgcolor:
                              idx === 0 ? "rgba(232,124,42,0.06)" : "inherit",
                          }}
                        >
                          <TableCell sx={{ fontWeight: 700 }}>
                            {idx < 3 ? medals[idx] : idx + 1}
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: idx < 3 ? 600 : 400,
                              }}
                            >
                              {entry.name}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{entry.count}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            ₹{entry.revenue.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* ── Recent Bookings ── */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Recent Bookings
        </Typography>
        <TableContainer component={Paper} sx={{ animation: 'slideUp 0.5s ease-out 0.4s both', '@keyframes slideUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Company Name</TableCell>
                <TableCell>BDM Name</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentBookings.map((booking) => (
                <TableRow key={booking._id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {booking.company_name}
                    </Typography>
                  </TableCell>
                  <TableCell>{booking.bdm}</TableCell>
                  <TableCell>
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    ₹
                    {(
                      (booking.term_1 || 0) +
                      (booking.term_2 || 0) +
                      (booking.term_3 || 0)
                    ).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default DashboardContent;
