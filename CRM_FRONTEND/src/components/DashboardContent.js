import React, { useEffect, useState, useRef } from "react";
import { apiUrl } from "./LoginSignup";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import BookOnlineOutlinedIcon from "@mui/icons-material/BookOnlineOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import { Chart } from "chart.js/auto";
import Loader from "./Loader";
import PaymentReminders from "./PaymentReminders";
import Popup from "./Popup";
import EditBooking from "./EditBooking";
import { enqueueSnackbar } from "notistack";

const ACCENT = "#ff3b1f";
const ACCENT_DARK = "#e03118";
const ACCENT_LIGHT = "rgba(255,59,31,0.14)";
const ACCENT_SOFT = "rgba(255,59,31,0.08)";

const DashboardContent = () => {
  const userSession = JSON.parse(localStorage.getItem("userSession"));

  const [totalBookings, setTotalBookings] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [recentBookings, setRecentBookings] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [monthlyRevData, setMonthlyRevData] = useState({ labels: [], values: [] });
  const [serviceSoldData, setServiceSoldData] = useState({ labels: [], values: [] });
  const [serviceRevenueData, setServiceRevenueData] = useState({ labels: [], values: [] });
  const [mostSoldService, setMostSoldService] = useState({ name: "-", count: 0 });
  const [mostRevenueService, setMostRevenueService] = useState({ name: "-", revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [isBookingPopupOpen, setIsBookingPopupOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [companyBranches, setCompanyBranches] = useState([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const soldChartRef = useRef(null);
  const soldChartInstance = useRef(null);
  const revenueChartRef = useRef(null);
  const revenueChartInstance = useRef(null);
  const revenuePieChartRef = useRef(null);
  const revenuePieChartInstance = useRef(null);

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

    // Fetch company branches
    fetch(`${apiUrl}/company/public`)
      .then(res => res.json())
      .then(data => {
        if (data && data.branches) {
          const branchesArray = data.branches.split(',').map(b => b.trim()).filter(Boolean);
          setCompanyBranches(branchesArray);
        }
      })
      .catch(err => console.error("Error fetching branches:", err));

    // Ping activity for realistic "Last Online"
    if (userSession?.token) {
      const pingActivity = () => {
        fetch(`${apiUrl}/user/ping`, {
          method: 'POST',
          headers: { 'Authorization': userSession.token }
        }).catch(() => { });
      };
      pingActivity(); // initial ping
      const interval = setInterval(pingActivity, 5 * 60 * 1000); // 5 mins
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw chart after data arrives
  useEffect(() => {
    if (monthlyRevData.labels.length === 0 || !chartRef.current) return;
    const ctx = chartRef.current.getContext("2d");
    if (chartInstance.current) chartInstance.current.destroy();

    const isDark = theme.palette.mode === "dark";
    const tickColor = isDark ? "#cbd5e1" : "#475569";
    const gridColor = isDark
      ? "rgba(255,255,255,0.14)"
      : "rgba(148,163,184,0.22)";

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: monthlyRevData.labels,
        datasets: [
          {
            label: "Revenue (₹)",
            data: monthlyRevData.values,
            backgroundColor: monthlyRevData.values.map((_, idx, arr) =>
              idx === arr.length - 1 ? ACCENT : "rgba(255,90,31,0.78)"
            ),
            borderColor: ACCENT_DARK,
            borderWidth: 1,
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
            backgroundColor: isDark ? "#111827" : "#ffffff",
            borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(255,59,31,0.25)",
            borderWidth: 1,
            titleColor: isDark ? "#f8fafc" : "#0f172a",
            bodyColor: isDark ? "#e2e8f0" : "#0f172a",
            displayColors: false,
            callbacks: {
              label: (ctx) => `₹${ctx.raw.toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: tickColor },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => `₹${(v / 1000).toFixed(0)}k`,
              font: { size: 11 },
              color: tickColor,
            },
            grid: { color: gridColor },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyRevData, theme.palette.mode]);

  useEffect(() => {
    if (serviceSoldData.labels.length === 0 || !soldChartRef.current) return;
    const ctx = soldChartRef.current.getContext("2d");
    if (soldChartInstance.current) soldChartInstance.current.destroy();

    const palette = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];
    const isDark = theme.palette.mode === "dark";

    soldChartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: serviceSoldData.labels,
        datasets: [
          {
            data: serviceSoldData.values,
            backgroundColor: serviceSoldData.labels.map((_, idx) => palette[idx % palette.length]),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: isDark ? "#cbd5e1" : "#334155",
              boxWidth: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.raw} bookings`,
            },
          },
        },
      },
    });

    return () => {
      if (soldChartInstance.current) soldChartInstance.current.destroy();
    };
  }, [serviceSoldData, theme.palette.mode]);

  useEffect(() => {
    if (serviceRevenueData.labels.length === 0 || !revenueChartRef.current) return;
    const ctx = revenueChartRef.current.getContext("2d");
    if (revenueChartInstance.current) revenueChartInstance.current.destroy();

    const palette = ["#ff3b1f", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1"];
    const isDark = theme.palette.mode === "dark";

    revenueChartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: serviceRevenueData.labels,
        datasets: [
          {
            label: "Revenue (₹)",
            data: serviceRevenueData.values,
            backgroundColor: serviceRevenueData.labels.map((_, idx) => palette[idx % palette.length]),
            borderRadius: 8,
            borderWidth: 0,
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
              label: (ctx) => `₹${Number(ctx.raw || 0).toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: isDark ? "#cbd5e1" : "#334155", font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: isDark ? "#cbd5e1" : "#334155",
              callback: (v) => `₹${(Number(v) / 1000).toFixed(0)}k`,
            },
            grid: { color: isDark ? "rgba(255,255,255,0.14)" : "rgba(148,163,184,0.22)" },
          },
        },
      },
    });

    return () => {
      if (revenueChartInstance.current) revenueChartInstance.current.destroy();
    };
  }, [serviceRevenueData, theme.palette.mode]);

  useEffect(() => {
    if (serviceRevenueData.labels.length === 0 || !revenuePieChartRef.current) return;
    const ctx = revenuePieChartRef.current.getContext("2d");
    if (revenuePieChartInstance.current) revenuePieChartInstance.current.destroy();

    const palette = ["#ff3b1f", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1"];
    const isDark = theme.palette.mode === "dark";

    revenuePieChartInstance.current = new Chart(ctx, {
      type: "pie",
      data: {
        labels: serviceRevenueData.labels,
        datasets: [
          {
            data: serviceRevenueData.values,
            backgroundColor: serviceRevenueData.labels.map((_, idx) => palette[idx % palette.length]),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: isDark ? "#cbd5e1" : "#334155",
              boxWidth: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.raw || 0);
                const total = (ctx.dataset.data || []).reduce((sum, v) => sum + Number(v || 0), 0);
                const percent = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
                return `${ctx.label}: ₹${value.toLocaleString()} (${percent}%)`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (revenuePieChartInstance.current) revenuePieChartInstance.current.destroy();
    };
  }, [serviceRevenueData, theme.palette.mode]);

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
      const serviceSoldMap = {}; // { serviceName: soldCount }
      const serviceRevenueMap = {}; // { serviceName: revenueShare }

      for (const booking of bookings) {
        bookingCount++;
        const rawRev = Number(
          (booking.term_1 || 0) +
          (booking.term_2 || 0) +
          (booking.term_3 || 0)
        );

        let userSpecificRev = rawRev;
        if (!isAdmin) {
          if (String(booking.user_id) === String(session.user_id)) {
            const sharedTotal = (booking.shared_with || []).reduce((sum, sw) => sum + (Number(sw.percentage) || 0), 0);
            userSpecificRev = rawRev * ((100 - sharedTotal) / 100);
          } else {
            const sharedData = (booking.shared_with || []).find(sw => String(sw.user_id) === String(session.user_id));
            const percentage = sharedData ? (Number(sharedData.percentage) || 0) : 0;
            userSpecificRev = rawRev * (percentage / 100);
          }
        }

        const rev = userSpecificRev;

        const bookingDate = new Date(booking.date || booking.createdAt || booking.payment_date);
        const paymentDate = new Date(booking.payment_date || booking.date || booking.createdAt);
        const bookingTotalAmount = Number(booking.total_amount || 0);

        const isCurrentMonthBooking =
          !Number.isNaN(bookingDate.getTime()) &&
          bookingDate.getMonth() === currentMonth &&
          bookingDate.getFullYear() === currentYear;

        if (
          !Number.isNaN(paymentDate.getTime()) &&
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
          !Number.isNaN(paymentDate.getTime()) &&
          paymentDate.getMonth() === currentMonth &&
          paymentDate.getFullYear() === currentYear
        ) {
          let creatorRev = rawRev;
          if (booking.shared_with && booking.shared_with.length > 0) {
            let sharedTotalRev = 0;
            let shareFractionCount = 0;
            for (const sw of booking.shared_with) {
              const sharedAmt = rawRev * ((Number(sw.percentage) || 0) / 100);
              sharedTotalRev += sharedAmt;
              shareFractionCount += 1;
              const sharedBdmName = sw.user_name || "Coworker";
              if (!bdmRevMap[sharedBdmName]) bdmRevMap[sharedBdmName] = { revenue: 0, count: 0 };
              bdmRevMap[sharedBdmName].revenue += sharedAmt;
              bdmRevMap[sharedBdmName].count += 1; 
            }
            creatorRev = rawRev - sharedTotalRev;
          }

          const bdm = booking.bdm || "Unknown";
          if (!bdmRevMap[bdm]) bdmRevMap[bdm] = { revenue: 0, count: 0 };
          bdmRevMap[bdm].revenue += creatorRev;
          bdmRevMap[bdm].count += 1;
        }

        if (isCurrentMonthBooking) {
          const services = Array.isArray(booking.services)
            ? booking.services.filter((s) => typeof s === "string" && s.trim())
            : [];

          if (services.length > 0) {
            const splitBaseRevenue = bookingTotalAmount > 0 ? bookingTotalAmount : rev;
            const splitRevenue = splitBaseRevenue / services.length;

            services.forEach((serviceNameRaw) => {
              const serviceName = serviceNameRaw.trim();
              serviceSoldMap[serviceName] = (serviceSoldMap[serviceName] || 0) + 1;
              serviceRevenueMap[serviceName] =
                (serviceRevenueMap[serviceName] || 0) + splitRevenue;
            });
          }
        }

        // Monthly revenue (last 6 months)
        if (!Number.isNaN(paymentDate.getTime())) {
          const key = `${paymentDate.getFullYear()}-${String(
            paymentDate.getMonth() + 1
          ).padStart(2, "0")}`;
          if (!monthlyMap[key]) monthlyMap[key] = 0;
          monthlyMap[key] += rev;
        }

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

      const soldEntries = Object.entries(serviceSoldMap).sort((a, b) => b[1] - a[1]);
      const revenueEntries = Object.entries(serviceRevenueMap).sort((a, b) => b[1] - a[1]);

      const soldTop = soldEntries[0] || ["-", 0];
      const revenueTop = revenueEntries[0] || ["-", 0];

      setMostSoldService({ name: soldTop[0], count: soldTop[1] });
      setMostRevenueService({ name: revenueTop[0], revenue: Number(revenueTop[1] || 0) });

      setServiceSoldData({
        labels: soldEntries.slice(0, 6).map(([service]) => service),
        values: soldEntries.slice(0, 6).map(([, count]) => count),
      });

      setServiceRevenueData({
        labels: revenueEntries.slice(0, 6).map(([service]) => service),
        values: revenueEntries.slice(0, 6).map(([, revenue]) => Math.round(revenue)),
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

  const handleOpenBooking = async (bookingId) => {
    try {
      // Fetch full booking details
      const res = await fetch(`${apiUrl}/booking/all`, {
        headers: { authorization: userSession?.token }
      });

      if (res.ok) {
        const data = await res.json();
        const bookings = data.Allbookings || data.bookings || [];
        const booking = bookings.find(b => b._id === bookingId);

        if (booking) {
          setSelectedBooking(booking);
          setIsBookingPopupOpen(true);
        } else {
          enqueueSnackbar('Booking not found', { variant: 'error' });
        }
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
      enqueueSnackbar('Error opening booking details', { variant: 'error' });
    }
  };

  const handleCloseBookingPopup = () => {
    setIsBookingPopupOpen(false);
    setSelectedBooking(null);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, animation: "fadeSlideIn 320ms ease" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          mb: companyBranches.length > 0 ? 1 : 2,
          alignItems: "center",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Dashboard
        </Typography>
      </Box>

      {/* ── Branches Display ── */}
      {companyBranches.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mr: 1, fontWeight: 600 }}>
            Current Branch:
          </Typography>
          {companyBranches.map((branch, idx) => (
            <Chip
              key={idx}
              label={branch}
              size="small"
              sx={{
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                fontWeight: 600,
                border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
              }}
            />
          ))}
        </Box>
      )}

      {/* ── Payment Reminders Banner ── */}
      <PaymentReminders onOpenBooking={handleOpenBooking} />

      {/* ── Stat Cards ── */}
      <Grid container spacing={2.5}>
        {[
          {
            label: "Bookings",
            value: totalBookings,
            sub: isAdmin ? "Total Bookings" : "Your Bookings",
            icon: <BookOnlineOutlinedIcon />,
            color: ACCENT,
          },
          ...(isAdmin
            ? [
              {
                label: "Total Users",
                value: totalUsers,
                sub: "CRM users",
                icon: <PeopleAltOutlinedIcon />,
                color: "#ff5a1f",
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
            color: "#ff7a1f",
          },
        ].map((c, i) => (
          <Grid item xs={12} sm={6} md={isAdmin ? 3 : 4} key={i}>
            <Card
              sx={{
                position: "relative",
                overflow: "visible",
                border: "1px solid",
                borderColor: "divider",
                background:
                  theme.palette.mode === "light"
                    ? "linear-gradient(160deg, rgba(255,255,255,1) 0%, rgba(255,248,246,1) 100%)"
                    : "linear-gradient(160deg, rgba(18,23,34,1) 0%, rgba(31,17,14,1) 100%)",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: 3,
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  background: `linear-gradient(90deg, ${c.color} 0%, ${ACCENT_DARK} 100%)`,
                },
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow:
                    theme.palette.mode === "light"
                      ? "0 12px 24px rgba(255,59,31,0.14)"
                      : "0 12px 24px rgba(255,59,31,0.2)",
                },
              }}
            >
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
          <Card>
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
                      color: ACCENT_DARK,
                      border: "1px solid rgba(255,59,31,0.35)",
                      fontWeight: 600,
                      fontSize: "0.7rem",
                    }}
                  />
                </Box>
                <TableContainer sx={{ overflowX: "auto" }}>
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
                              idx === 0 ? ACCENT_SOFT : "inherit",
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
                            <Box component="span" sx={{ color: ACCENT_DARK }}>
                              ₹{entry.revenue.toLocaleString()}
                            </Box>
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

      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <LocalOfferOutlinedIcon sx={{ color: "#3b82f6" }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Most Sold Service (MTD)
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={`${mostSoldService.name} • ${mostSoldService.count}`}
                  sx={{ bgcolor: "rgba(59,130,246,0.14)", color: "#1d4ed8", fontWeight: 700 }}
                />
              </Box>
              <Box sx={{ height: 250 }}>
                {serviceSoldData.labels.length > 0 ? (
                  <canvas ref={soldChartRef} />
                ) : (
                  <Typography variant="body2" color="text.secondary">No service sales this month yet.</Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PaidOutlinedIcon sx={{ color: ACCENT }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Most Revenue Service (MTD)
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={`${mostRevenueService.name} • ₹${mostRevenueService.revenue.toLocaleString()}`}
                  sx={{ bgcolor: ACCENT_LIGHT, color: ACCENT_DARK, fontWeight: 700 }}
                />
              </Box>
              <Box sx={{ height: 250 }}>
                {serviceRevenueData.labels.length > 0 ? (
                  <canvas ref={revenueChartRef} />
                ) : (
                  <Typography variant="body2" color="text.secondary">No service revenue this month yet.</Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PaidOutlinedIcon sx={{ color: "#6366f1" }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Service Revenue Distribution (MTD)
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Amount + percentage per service
                </Typography>
              </Box>
              <Box sx={{ height: 320 }}>
                {serviceRevenueData.labels.length > 0 ? (
                  <canvas ref={revenuePieChartRef} />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No service revenue this month yet.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Recent Bookings ── */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Recent Bookings
        </Typography>
        <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
          <Table size={isMobile ? "small" : "medium"}>
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
                    <Box component="span" sx={{ color: ACCENT_DARK }}>
                      ₹
                      {(
                        (booking.term_1 || 0) +
                        (booking.term_2 || 0) +
                        (booking.term_3 || 0)
                      ).toLocaleString()}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* ── Booking Edit Popup ── */}
      {isBookingPopupOpen && (
        <Popup isOpen={isBookingPopupOpen} onClose={handleCloseBookingPopup}>
          <EditBooking
            initialData={selectedBooking}
            onClose={handleCloseBookingPopup}
          />
        </Popup>
      )}
    </Box>
  );
};

export default DashboardContent;
