import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "./LoginSignup";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
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
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import BookOnlineOutlinedIcon from "@mui/icons-material/BookOnlineOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import { Chart } from "chart.js/auto";
import Loader from "./Loader";
import PaymentReminders from "./PaymentReminders";
import Popup from "./Popup";
import EditBooking from "./EditBooking";
import { enqueueSnackbar } from "notistack";
import {
  addBookingRevenueToLeaderboard,
  buildServiceDeductionMap,
  getBookingDeductionRowsForUser,
  getBookingRevenueForUser,
} from "../utils/bookingRevenue";

const ACCENT = "#ff3b1f";
const ACCENT_DARK = "#e03118";
const ACCENT_LIGHT = "rgba(255,59,31,0.14)";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const parseDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateKey = (value) => {
  const date = parseDateValue(value);
  return date ? date.toISOString().split("T")[0] : "";
};

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

const roleLabel = (role = "") =>
  role
    .toString()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");

const statCardThemes = [
  { bg: "linear-gradient(180deg, #fff9f5 0%, #ffffff 100%)", iconBg: "rgba(255,59,31,0.12)", iconColor: ACCENT },
  { bg: "linear-gradient(180deg, #f7fbff 0%, #ffffff 100%)", iconBg: "rgba(59,130,246,0.14)", iconColor: "#2563eb" },
  { bg: "linear-gradient(180deg, #faf7ff 0%, #ffffff 100%)", iconBg: "rgba(124,58,237,0.14)", iconColor: "#7c3aed" },
  { bg: "linear-gradient(180deg, #fffaf2 0%, #ffffff 100%)", iconBg: "rgba(245,158,11,0.16)", iconColor: "#d97706" },
  { bg: "linear-gradient(180deg, #f5fbf8 0%, #ffffff 100%)", iconBg: "rgba(16,185,129,0.14)", iconColor: "#059669" },
  { bg: "linear-gradient(180deg, #fff7fb 0%, #ffffff 100%)", iconBg: "rgba(236,72,153,0.14)", iconColor: "#db2777" },
  { bg: "linear-gradient(180deg, #f6fbff 0%, #ffffff 100%)", iconBg: "rgba(6,182,212,0.14)", iconColor: "#0891b2" },
  { bg: "linear-gradient(180deg, #fff8f1 0%, #ffffff 100%)", iconBg: "rgba(234,88,12,0.14)", iconColor: "#ea580c" },
];

const DashboardContent = () => {
  const userSession = JSON.parse(localStorage.getItem("userSession"));
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [totalBookings, setTotalBookings] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [bookingsThisMonth, setBookingsThisMonth] = useState(0);
  const [bookingsToday, setBookingsToday] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [recentBookings, setRecentBookings] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardDialogOpen, setLeaderboardDialogOpen] = useState(false);
  const [deductionDialogOpen, setDeductionDialogOpen] = useState(false);
  const [monthlyRevData, setMonthlyRevData] = useState({ labels: [], values: [] });
  const [serviceSoldData, setServiceSoldData] = useState({ labels: [], values: [] });
  const [serviceRevenueData, setServiceRevenueData] = useState({ labels: [], values: [] });
  const [mostSoldService, setMostSoldService] = useState({ name: "-", count: 0 });
  const [mostRevenueService, setMostRevenueService] = useState({ name: "-", revenue: 0 });
  const [personalMostSoldService, setPersonalMostSoldService] = useState({ name: "-", count: 0 });
  const [personalMostRevenueService, setPersonalMostRevenueService] = useState({ name: "-", revenue: 0 });
  const [serviceDeductionCatalog, setServiceDeductionCatalog] = useState([]);
  const [totalServiceDeductions, setTotalServiceDeductions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isBookingPopupOpen, setIsBookingPopupOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [companyBranches, setCompanyBranches] = useState([]);

  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const soldChartRef = useRef(null);
  const soldChartInstance = useRef(null);
  const revenueChartRef = useRef(null);
  const revenueChartInstance = useRef(null);
  const revenuePieChartRef = useRef(null);
  const revenuePieChartInstance = useRef(null);

  const isAdmin = ["admin", "super admin", "director", "dev", "senior admin", "srdev", "sr dev"].includes(
    (userSession?.user_role || "").toLowerCase()
  );

  const getTodayDate = () => new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (userSession?.user_id) {
      fetchDashboardData(userSession);
    } else {
      setLoading(false);
    }

    fetch(`${apiUrl}/company/public`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.branches) {
          setCompanyBranches(
            data.branches
              .split(",")
              .map((branch) => branch.trim())
              .filter(Boolean)
          );
        }
      })
      .catch((err) => console.error("Error fetching branches:", err));

    if (userSession?.token) {
      const pingActivity = () => {
        fetch(`${apiUrl}/user/ping`, {
          method: "POST",
          headers: { Authorization: userSession.token },
        }).catch(() => {});
      };

      pingActivity();
      const interval = setInterval(pingActivity, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (monthlyRevData.labels.length === 0 || !chartRef.current) return;

    const ctx = chartRef.current.getContext("2d");
    if (chartInstance.current) chartInstance.current.destroy();

    const isDark = theme.palette.mode === "dark";
    const tickColor = isDark ? "#cbd5e1" : "#475569";
    const gridColor = isDark ? "rgba(255,255,255,0.14)" : "rgba(148,163,184,0.22)";

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: monthlyRevData.labels,
        datasets: [
          {
            label: "Revenue",
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
              label: (ctx) => formatCurrency(ctx.raw),
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
              callback: (v) => formatCurrency(v),
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
        cutout: "64%",
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
            label: "Bookings",
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
              label: (ctx) => `${Number(ctx.raw || 0).toLocaleString()} bookings`,
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
              callback: (v) => `${Number(v).toLocaleString()}`,
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
                const total = (ctx.dataset.data || []).reduce((sum, item) => sum + Number(item || 0), 0);
                const percent = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
                return `${ctx.label}: ${value.toLocaleString()} bookings (${percent}%)`;
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
      const bookingUrl = isAdmin ? `${apiUrl}/booking/all` : `${apiUrl}/user/bookings/${session.user_id}`;

      const fetches = [
        fetch(bookingUrl, {
          headers: {
            "Content-Type": "application/json",
            authorization: session.token,
          },
        }),
        fetch(`${apiUrl}/user/options`, {
          headers: {
            "Content-Type": "application/json",
            authorization: session.token,
          },
        }),
        fetch(`${apiUrl}/services/api/services`, {
          headers: {
            "Content-Type": "application/json",
            authorization: session.token,
          },
        }),
      ];

      if (!isAdmin) {
        fetches.push(
          fetch(`${apiUrl}/booking/all`, {
            headers: {
              "Content-Type": "application/json",
              authorization: session.token,
            },
          })
        );
      }

      if (isAdmin) {
        fetches.push(
          fetch(`${apiUrl}/user/all`, {
            headers: {
              "Content-Type": "application/json",
              authorization: session.token,
            },
          }),
          fetch(`${apiUrl}/booking-approvals?status=pending`, {
            headers: {
              "Content-Type": "application/json",
              authorization: session.token,
            },
          })
        );
      }

      const results = await Promise.all(fetches);
      const bookingsRes = results[0];
      const usersOptionsRes = results[1];
      const servicesRes = results[2];
      let resultIndex = 3;
      const companyBookingsRes = !isAdmin ? results[resultIndex++] : null;
      const allUsersRes = isAdmin ? results[resultIndex++] : null;
      const approvalsRes = isAdmin ? results[resultIndex++] : null;

      if (!bookingsRes.ok) throw new Error("Failed API call");

      const bookingsData = await bookingsRes.json();
      const bookings = bookingsData.Allbookings || bookingsData;

      let serviceDeductionMap = {};
      let serviceDeductionCatalogRows = [];
      if (servicesRes?.ok) {
        const servicesData = await servicesRes.json();
        const normalizedServices = Array.isArray(servicesData) ? servicesData : [];
        serviceDeductionMap = buildServiceDeductionMap(normalizedServices);
        serviceDeductionCatalogRows = normalizedServices
          .map((service) => ({
            id: service._id || service.name,
            service: service.name || service.value || "SERVICE",
            deduction: Number(service.deduction || 0),
            status: service.status,
          }))
          .sort((a, b) => b.deduction - a.deduction || a.service.localeCompare(b.service));
      }

      const activeUsersMap = {};
      const userDirectoryByName = {};
      if (usersOptionsRes.ok) {
        const usersOptData = await usersOptionsRes.json();
        if (usersOptData?.users) {
          usersOptData.users.forEach((user) => {
            activeUsersMap[user._id] = user.name;
            userDirectoryByName[(user.name || "").trim().toUpperCase()] = {
              name: user.name,
              role: user.user_role,
              profilePicture: user.profilePicture || "",
            };
          });
        }
      }
      const allCompanyBookings = !isAdmin && companyBookingsRes?.ok
        ? ((await companyBookingsRes.json()).Allbookings || [])
        : bookings;

      if (isAdmin && allUsersRes?.ok) {
        const usersData = await allUsersRes.json();
        setTotalUsers(usersData.Users?.length || 0);
      } else if (!isAdmin) {
        setTotalUsers(0);
      }

      if (isAdmin && approvalsRes?.ok) {
        const approvals = await approvalsRes.json();
        setPendingApprovals(Array.isArray(approvals) ? approvals.length : 0);
      } else {
        setPendingApprovals(0);
      }

      const today = getTodayDate();
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      threeMonthsAgo.setHours(0, 0, 0, 0);

      let bookingCount = 0;
      let bookingCountThisMonth = 0;
      let bookingCountToday = 0;
      let currentMonthRevenue = 0;
      let todayRevenueAmt = 0;
      const sortedBookings = [];
      const bdmRevMap = {};
      const monthlyMap = {};
      const serviceSoldMap = {};
      const serviceRevenueMap = {};
      const currentMonthDeductions = [];

      const isCurrentMonthTerm = (termShare) => {
        const termDate = new Date(termShare?.payment_date || "");
        return !Number.isNaN(termDate.getTime()) &&
          termDate.getMonth() === currentMonth &&
          termDate.getFullYear() === currentYear;
      };

      for (const booking of bookings) {
        if (isAdmin || String(booking.user_id) === String(session.user_id)) {
          bookingCount += 1;
        }

        const createdDate = parseDateValue(booking.createdAt || booking.date || booking.payment_date);
        const createdDateKey = getDateKey(booking.createdAt || booking.date || booking.payment_date);
        if (createdDate) {
          if (createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear) {
            bookingCountThisMonth += 1;
          }
          if (createdDateKey === today) {
            bookingCountToday += 1;
          }
        }

        const revenueForAccess = getBookingRevenueForUser(booking, session.user_id, isAdmin, () => true, serviceDeductionMap);
        const currentMonthRev = isAdmin
          ? getBookingRevenueForUser(booking, session.user_id, true, isCurrentMonthTerm, serviceDeductionMap)
          : getBookingRevenueForUser(booking, session.user_id, false, isCurrentMonthTerm, serviceDeductionMap);

        currentMonthRevenue += currentMonthRev;

        if (createdDateKey === today) {
          todayRevenueAmt += revenueForAccess;
        }

        addBookingRevenueToLeaderboard(booking, bdmRevMap, activeUsersMap, isCurrentMonthTerm, serviceDeductionMap);

        currentMonthDeductions.push(
          ...getBookingDeductionRowsForUser(
            booking,
            session.user_id,
            isAdmin,
            isCurrentMonthTerm,
            serviceDeductionMap,
            activeUsersMap
          )
        );

        const paymentDate = new Date(booking.payment_date || booking.date || booking.createdAt);
        if (!Number.isNaN(paymentDate.getTime()) && paymentDate >= threeMonthsAgo) {
          const services = Array.isArray(booking.services)
            ? booking.services.filter((service) => typeof service === "string" && service.trim())
            : [];

          if (services.length > 0) {
            const splitBaseRevenue = Math.max(
              0,
              isAdmin
                ? getBookingRevenueForUser(booking, session.user_id, true, () => true, serviceDeductionMap)
                : revenueForAccess
            );
            const splitRevenue = splitBaseRevenue / services.length;

            services.forEach((serviceNameRaw) => {
              const serviceName = serviceNameRaw.trim();
              serviceSoldMap[serviceName] = (serviceSoldMap[serviceName] || 0) + 1;
              serviceRevenueMap[serviceName] = (serviceRevenueMap[serviceName] || 0) + splitRevenue;
            });
          }
        }

        ["term_1", "term_2", "term_3"].forEach((termKey) => {
          const termAmount = getBookingRevenueForUser(
            booking,
            session.user_id,
            isAdmin,
            (_, key) => key === termKey,
            serviceDeductionMap
          );
          if (!termAmount) return;

          const termDate = new Date(
            booking.term_shares?.[termKey]?.payment_date || booking.payment_date || booking.date || booking.createdAt
          );
          if (Number.isNaN(termDate.getTime())) return;

          const monthKey = `${termDate.getFullYear()}-${String(termDate.getMonth() + 1).padStart(2, "0")}`;
          if (!monthlyMap[monthKey]) monthlyMap[monthKey] = 0;
          monthlyMap[monthKey] += termAmount;
        });

        (booking.refund_adjustments || []).forEach((refund) => {
          const refundDate = new Date(refund.refund_date || refund.created_at);
          if (Number.isNaN(refundDate.getTime())) return;
          const monthKey = `${refundDate.getFullYear()}-${String(refundDate.getMonth() + 1).padStart(2, "0")}`;
          if (!monthlyMap[monthKey]) monthlyMap[monthKey] = 0;
          monthlyMap[monthKey] += getBookingRevenueForUser(
            booking,
            session.user_id,
            isAdmin,
            (_, termKey) => termKey === "refund",
            serviceDeductionMap
          );
        });

        sortedBookings.push(booking);
      }

      const board = Object.entries(bdmRevMap)
        .map(([name, data]) => {
          const profile = userDirectoryByName[(name || "").trim().toUpperCase()] || {};
          return {
            name,
            ...data,
            profilePicture: profile.profilePicture || "",
            role: profile.role || "",
          };
        })
        .sort((a, b) => b.revenue - a.revenue);
      setLeaderboard(board);

      const monthBuckets = [];
      for (let i = 5; i >= 0; i -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        monthBuckets.push({
          label: date.toLocaleString("default", { month: "short" }),
          value: monthlyMap[monthKey] || 0,
        });
      }
      setMonthlyRevData({
        labels: monthBuckets.map((month) => month.label),
        values: monthBuckets.map((month) => month.value),
      });

      if (!isAdmin) {
        const companySoldMap = {};
        const companyRevenueMap = {};

        for (const booking of allCompanyBookings) {
          const paymentDate = new Date(booking.payment_date || booking.date || booking.createdAt);
          if (Number.isNaN(paymentDate.getTime()) || paymentDate < threeMonthsAgo) continue;

          const services = Array.isArray(booking.services)
            ? booking.services.filter((service) => typeof service === "string" && service.trim())
            : [];
          if (!services.length) continue;

          const revenue = Math.max(
            0,
            getBookingRevenueForUser(booking, session.user_id, true, () => true, serviceDeductionMap)
          );
          const splitRevenue = revenue / services.length;

          services.forEach((serviceNameRaw) => {
            const serviceName = serviceNameRaw.trim();
            companySoldMap[serviceName] = (companySoldMap[serviceName] || 0) + 1;
            companyRevenueMap[serviceName] = (companyRevenueMap[serviceName] || 0) + splitRevenue;
          });
        }

        const personalSoldEntries = Object.entries(serviceSoldMap).sort((a, b) => b[1] - a[1]);
        const personalRevenueEntries = Object.entries(companySoldMap).sort((a, b) => b[1] - a[1]);
        const personalSoldTop = personalSoldEntries[0] || ["-", 0];
        const personalRevenueTop = personalRevenueEntries[0] || ["-", 0];
        setPersonalMostSoldService({ name: personalSoldTop[0], count: personalSoldTop[1] });
        setPersonalMostRevenueService({ name: personalRevenueTop[0], revenue: Number(personalRevenueTop[1] || 0) });

        Object.keys(serviceSoldMap).forEach((key) => delete serviceSoldMap[key]);
        Object.assign(serviceSoldMap, companySoldMap);
        Object.keys(serviceRevenueMap).forEach((key) => delete serviceRevenueMap[key]);
        Object.assign(serviceRevenueMap, companyRevenueMap);
      } else {
        setPersonalMostSoldService({ name: "-", count: 0 });
        setPersonalMostRevenueService({ name: "-", revenue: 0 });
      }

      const soldEntries = Object.entries(serviceSoldMap).sort((a, b) => b[1] - a[1]);
      const activityEntries = Object.entries(serviceSoldMap).sort((a, b) => b[1] - a[1]);

      const soldTop = soldEntries[0] || ["-", 0];
      const activityTop = activityEntries[0] || ["-", 0];

      setMostSoldService({ name: soldTop[0], count: soldTop[1] });
      setMostRevenueService({ name: activityTop[0], revenue: Number(activityTop[1] || 0) });

      setServiceSoldData({
        labels: soldEntries.slice(0, 6).map(([service]) => service),
        values: soldEntries.slice(0, 6).map(([, count]) => count),
      });

      setServiceRevenueData({
        labels: activityEntries.slice(0, 6).map(([service]) => service),
        values: activityEntries.slice(0, 6).map(([, count]) => Math.round(count)),
      });

      setServiceDeductionCatalog(serviceDeductionCatalogRows);
      setTotalServiceDeductions(
        currentMonthDeductions.reduce((sum, row) => sum + Number(row.deduction || 0), 0)
      );

      const recent = sortedBookings
        .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
        .slice(0, 6);

      setTotalBookings(bookingCount);
      setTotalRevenue(currentMonthRevenue);
      setTodayRevenue(todayRevenueAmt);
      setBookingsThisMonth(bookingCountThisMonth);
      setBookingsToday(bookingCountToday);
      setRecentBookings(recent);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBooking = async (bookingId) => {
    try {
      const res = await fetch(`${apiUrl}/booking/all`, {
        headers: { authorization: userSession?.token },
      });

      if (!res.ok) {
        enqueueSnackbar("Error opening booking details", { variant: "error" });
        return;
      }

      const data = await res.json();
      const bookings = data.Allbookings || data.bookings || [];
      const booking = bookings.find((item) => item._id === bookingId);

      if (!booking) {
        enqueueSnackbar("Booking not found", { variant: "error" });
        return;
      }

      setSelectedBooking(booking);
      setIsBookingPopupOpen(true);
    } catch (error) {
      console.error("Error fetching booking details:", error);
      enqueueSnackbar("Error opening booking details", { variant: "error" });
    }
  };

  const handleCloseBookingPopup = () => {
    setIsBookingPopupOpen(false);
    setSelectedBooking(null);
  };

  const deductionRows = useMemo(
    () => serviceDeductionCatalog.filter((row) => Number(row.deduction || 0) > 0),
    [serviceDeductionCatalog]
  );

  const statCards = useMemo(() => {
    const adminCards = [
      {
        label: "Bookings",
        value: totalBookings.toLocaleString(),
        sub: "All accessible bookings",
        icon: <BookOnlineOutlinedIcon fontSize="small" />,
      },
      {
        label: "Revenue This Month",
        value: formatCurrency(totalRevenue),
        sub: "After deductions",
        icon: <CurrencyRupeeOutlinedIcon fontSize="small" />,
      },
      {
        label: "Service Deductions",
        value: formatCurrency(Math.round(totalServiceDeductions)),
        sub: "Vendor costs this month",
        icon: <PaidOutlinedIcon fontSize="small" />,
      },
      {
        label: "Today's Revenue",
        value: formatCurrency(todayRevenue),
        sub: "Live today after deductions",
        icon: <TodayOutlinedIcon fontSize="small" />,
      },
      {
        label: "Total Users",
        value: totalUsers.toLocaleString(),
        sub: "Active CRM users",
        icon: <PeopleAltOutlinedIcon fontSize="small" />,
      },
      {
        label: "Bookings This Month",
        value: bookingsThisMonth.toLocaleString(),
        sub: "Created this month",
        icon: <LocalOfferOutlinedIcon fontSize="small" />,
      },
      {
        label: "Bookings Today",
        value: bookingsToday.toLocaleString(),
        sub: "Created today",
        icon: <BookOnlineOutlinedIcon fontSize="small" />,
      },
      {
        label: "Pending Approvals",
        value: pendingApprovals.toLocaleString(),
        sub: "Awaiting review",
        icon: <PendingActionsOutlinedIcon fontSize="small" />,
      },
    ];

    const userCards = [
      {
        label: "Bookings",
        value: totalBookings.toLocaleString(),
        sub: "Your live bookings",
        icon: <BookOnlineOutlinedIcon fontSize="small" />,
      },
      {
        label: "Revenue This Month",
        value: formatCurrency(totalRevenue),
        sub: "After deductions",
        icon: <CurrencyRupeeOutlinedIcon fontSize="small" />,
      },
      {
        label: "Service Deductions",
        value: formatCurrency(Math.round(totalServiceDeductions)),
        sub: "This month",
        icon: <PaidOutlinedIcon fontSize="small" />,
      },
      {
        label: "Today's Revenue",
        value: formatCurrency(todayRevenue),
        sub: "From today's bookings",
        icon: <TodayOutlinedIcon fontSize="small" />,
      },
    ];

    return isAdmin ? adminCards : userCards;
  }, [
    bookingsThisMonth,
    bookingsToday,
    isAdmin,
    pendingApprovals,
    todayRevenue,
    totalBookings,
    totalRevenue,
    totalServiceDeductions,
    totalUsers,
  ]);

  const featuredLeaderboardEntry = leaderboard[0] || null;
  const compactLeaderboardEntries = leaderboard.slice(1, 5);
  const previewDeductionRows = deductionRows.slice(0, isMobile ? 4 : 6);
  const medals = ["1", "2", "3"];

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Loader />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 1, sm: 1.5, md: 2 }, py: { xs: 1, sm: 1.5 }, width: "100%" }}>
      <Box sx={{ width: "100%", maxWidth: { xl: 1680 }, mx: { xl: "auto" } }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: companyBranches.length > 0 ? 1 : 2,
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Dashboard
          </Typography>
        </Box>

        {companyBranches.length > 0 && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: "flex", alignItems: "center", mr: 0.5, fontWeight: 600 }}
            >
              Current Branch:
            </Typography>
            {companyBranches.map((branch, index) => (
              <Chip
                key={index}
                label={branch}
                size="small"
                sx={{
                  bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.04)",
                  color: theme.palette.mode === "dark" ? "#cbd5e1" : "#475569",
                  fontWeight: 600,
                  borderRadius: "8px",
                  border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)"}`,
                }}
              />
            ))}
          </Box>
        )}

        <PaymentReminders onOpenBooking={handleOpenBooking} />

        <Grid container spacing={{ xs: 1.25, sm: 1.5, md: 1.75 }} sx={{ mt: 0.25 }}>
          {statCards.map((card, index) => {
            const palette = statCardThemes[index % statCardThemes.length];
            return (
              <Grid item xs={6} md={3} key={card.label}>
                <Card
                  sx={{
                    height: "100%",
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: "divider",
                    background: palette.bg,
                    boxShadow: theme.palette.mode === "light" ? "0 10px 24px rgba(15,23,42,0.05)" : "none",
                  }}
                >
                  <CardContent sx={{ p: { xs: 1.25, sm: 1.5 }, "&:last-child": { pb: { xs: 1.25, sm: 1.5 } } }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            fontSize: { xs: "0.68rem", sm: "0.72rem" },
                            fontWeight: 700,
                            display: "block",
                            mb: 0.5,
                            textTransform: "uppercase",
                            letterSpacing: 0,
                          }}
                        >
                          {card.label}
                        </Typography>
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: { xs: "0.98rem", sm: "1.2rem", md: "1.28rem" },
                            lineHeight: 1.15,
                            wordBreak: "break-word",
                          }}
                        >
                          {card.value}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            fontSize: { xs: "0.66rem", sm: "0.72rem" },
                            display: "block",
                            mt: 0.5,
                            lineHeight: 1.3,
                          }}
                        >
                          {card.sub}
                        </Typography>
                      </Box>
                      <Avatar
                        sx={{
                          width: { xs: 30, sm: 34 },
                          height: { xs: 30, sm: 34 },
                          bgcolor: palette.iconBg,
                          color: palette.iconColor,
                          borderRadius: "8px",
                          flexShrink: 0,
                        }}
                      >
                        {card.icon}
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        <Grid container spacing={{ xs: 1.25, sm: 1.5, md: 1.75 }} sx={{ mt: 0.5 }}>
          <Grid item xs={12} lg={8}>
            <Card sx={{ borderRadius: "8px", border: "1px solid", borderColor: "divider", height: "100%" }}>
              <CardContent sx={{ p: { xs: 1.25, sm: 1.5, md: 1.75 } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25, gap: 1, flexWrap: "wrap" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TrendingUpOutlinedIcon sx={{ color: ACCENT, fontSize: 20 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Monthly Revenue
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Last 6 months
                  </Typography>
                </Box>
                <Box sx={{ height: { xs: 220, md: 240 } }}>
                  <canvas ref={chartRef} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {isAdmin && (
            <Grid item xs={12} lg={4}>
              <Card sx={{ borderRadius: "8px", border: "1px solid", borderColor: "divider", height: "100%" }}>
                <CardContent sx={{ p: { xs: 1.25, sm: 1.5, md: 1.75 }, height: "100%" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                    <EmojiEventsOutlinedIcon sx={{ color: ACCENT, fontSize: 20 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Top Performers
                    </Typography>
                    <Chip
                      size="small"
                      label={new Date().toLocaleString("default", { month: "short" })}
                      sx={{
                        ml: "auto",
                        bgcolor: ACCENT_LIGHT,
                        color: ACCENT_DARK,
                        borderRadius: "8px",
                        fontWeight: 700,
                      }}
                    />
                  </Box>

                  {featuredLeaderboardEntry ? (
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: "8px",
                        border: "1px solid rgba(255,59,31,0.18)",
                        background: theme.palette.mode === "dark"
                          ? "linear-gradient(180deg, rgba(255,59,31,0.10) 0%, rgba(255,255,255,0.02) 100%)"
                          : "linear-gradient(180deg, rgba(255,59,31,0.08) 0%, rgba(255,255,255,1) 100%)",
                        mb: 1.25,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Avatar
                          src={featuredLeaderboardEntry.profilePicture || ""}
                          sx={{
                            width: 52,
                            height: 52,
                            bgcolor: "rgba(255,59,31,0.16)",
                            color: ACCENT_DARK,
                            fontWeight: 700,
                          }}
                        >
                          {getInitials(featuredLeaderboardEntry.name)}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 700 }} noWrap>
                            {featuredLeaderboardEntry.name}
                          </Typography>
                          {featuredLeaderboardEntry.role ? (
                            <Typography variant="caption" color="text.secondary">
                              {roleLabel(featuredLeaderboardEntry.role)}
                            </Typography>
                          ) : null}
                        </Box>
                        <Chip
                          size="small"
                          label="#1"
                          sx={{ bgcolor: ACCENT, color: "#fff", borderRadius: "8px", fontWeight: 700 }}
                        />
                      </Box>

                      <Grid container spacing={1} sx={{ mt: 1 }}>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">
                            Bookings
                          </Typography>
                          <Typography sx={{ fontWeight: 700, mt: 0.25 }}>
                            {featuredLeaderboardEntry.count}
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">
                            Deduction
                          </Typography>
                          <Typography sx={{ fontWeight: 700, mt: 0.25 }}>
                            {formatCurrency(Math.round(featuredLeaderboardEntry.deduction || 0))}
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">
                            Revenue
                          </Typography>
                          <Typography sx={{ fontWeight: 700, mt: 0.25, color: ACCENT_DARK }}>
                            {formatCurrency(featuredLeaderboardEntry.revenue)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      No leaderboard data this month.
                    </Typography>
                  )}

                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {compactLeaderboardEntries.map((entry, index) => (
                      <Box
                        key={entry.name}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "auto minmax(0,1fr) auto",
                          gap: 1,
                          alignItems: "center",
                          p: 1,
                          borderRadius: "8px",
                          backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.025)",
                        }}
                      >
                        <Avatar
                          src={entry.profilePicture || ""}
                          sx={{
                            width: 34,
                            height: 34,
                            fontSize: "0.8rem",
                            bgcolor: "rgba(59,130,246,0.14)",
                            color: "#2563eb",
                          }}
                        >
                          {getInitials(entry.name)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {entry.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {entry.count} bookings · {formatCurrency(entry.revenue)}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={`#${index + 2}`}
                          sx={{ borderRadius: "8px", fontWeight: 700 }}
                        />
                      </Box>
                    ))}
                  </Box>

                  {leaderboard.length > 4 && (
                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.25 }}>
                      <Button size="small" onClick={() => setLeaderboardDialogOpen(true)}>
                        View All
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        <Grid container spacing={{ xs: 1.25, sm: 1.5, md: 1.75 }} sx={{ mt: 0.5 }}>
          <Grid item xs={12} lg={7}>
            <Card sx={{ borderRadius: "8px", border: "1px solid", borderColor: "divider", height: "100%" }}>
              <CardContent sx={{ p: { xs: 1.25, sm: 1.5, md: 1.75 } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25, gap: 1, flexWrap: "wrap" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <LocalOfferOutlinedIcon sx={{ color: "#3b82f6" }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Most Sold Services
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={`${mostSoldService.name} · ${mostSoldService.count}`}
                    sx={{ bgcolor: "rgba(59,130,246,0.12)", color: "#1d4ed8", borderRadius: "8px", fontWeight: 700 }}
                  />
                </Box>
                {!isAdmin && (
                  <Chip
                    size="small"
                    label={`Mine: ${personalMostSoldService.name} · ${personalMostSoldService.count}`}
                    sx={{ mb: 1.25, bgcolor: "rgba(16,185,129,0.12)", color: "#047857", borderRadius: "8px", fontWeight: 700 }}
                  />
                )}
                <Box sx={{ height: { xs: 220, md: 230 } }}>
                  {serviceSoldData.labels.length > 0 ? (
                    <canvas ref={soldChartRef} />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No service sales in the last 3 months.
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Card sx={{ borderRadius: "8px", border: "1px solid", borderColor: "divider", height: "100%" }}>
              <CardContent sx={{ p: { xs: 1.25, sm: 1.5, md: 1.75 } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25, gap: 1, flexWrap: "wrap" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PaidOutlinedIcon sx={{ color: ACCENT }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Service Activity Range
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={`${mostRevenueService.name} · ${mostRevenueService.revenue.toLocaleString()} bookings`}
                    sx={{ bgcolor: ACCENT_LIGHT, color: ACCENT_DARK, borderRadius: "8px", fontWeight: 700 }}
                  />
                </Box>
                {!isAdmin && (
                  <Chip
                    size="small"
                    label={`Mine: ${personalMostRevenueService.name} · ${personalMostRevenueService.revenue.toLocaleString()} bookings`}
                    sx={{ mb: 1.25, bgcolor: "rgba(16,185,129,0.12)", color: "#047857", borderRadius: "8px", fontWeight: 700 }}
                  />
                )}
                <Box sx={{ height: { xs: 220, md: 230 } }}>
                  {serviceRevenueData.labels.length > 0 ? (
                    <canvas ref={revenueChartRef} />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No service activity in the last 3 months.
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={{ xs: 1.25, sm: 1.5, md: 1.75 }} sx={{ mt: 0.5 }}>
          <Grid item xs={12} xl={7}>
            <Card sx={{ borderRadius: "8px", border: "1px solid", borderColor: "divider", height: "100%" }}>
              <CardContent sx={{ p: { xs: 1.25, sm: 1.5, md: 1.75 } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25, gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Recent Bookings
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Latest live bookings
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {recentBookings.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No recent bookings found.
                    </Typography>
                  )}
                  {recentBookings.map((booking) => (
                    <Paper
                      key={booking._id}
                      variant="outlined"
                      sx={{
                        p: 1.25,
                        borderRadius: "8px",
                        borderColor: "divider",
                        backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#fff",
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {booking.company_name || "Untitled Company"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                            {booking.bdm || "Unknown BDM"} · {new Date(booking.createdAt || booking.date || Date.now()).toLocaleDateString()}
                          </Typography>
                          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 0.9 }}>
                            {(booking.services || []).slice(0, 3).map((service) => (
                              <Chip
                                key={`${booking._id}-${service}`}
                                label={service}
                                size="small"
                                sx={{
                                  borderRadius: "8px",
                                  bgcolor: "rgba(15,23,42,0.05)",
                                  fontWeight: 600,
                                  maxWidth: "100%",
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: { xs: "flex-start", sm: "flex-end" }, gap: 0.6 }}>
                          <Typography sx={{ fontWeight: 800, color: ACCENT_DARK }}>
                            {formatCurrency((booking.term_1 || 0) + (booking.term_2 || 0) + (booking.term_3 || 0))}
                          </Typography>
                          <Button size="small" onClick={() => handleOpenBooking(booking._id)}>
                            Open
                          </Button>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={12} xl={5}>
            <Grid container spacing={{ xs: 1.25, sm: 1.5 }}>
              <Grid item xs={12}>
                <Card sx={{ borderRadius: "8px", border: "1px solid", borderColor: "divider" }}>
                  <CardContent sx={{ p: { xs: 1.25, sm: 1.5, md: 1.75 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25, gap: 1, flexWrap: "wrap" }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Service Deduction Master
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Only services with active deductions
                        </Typography>
                      </Box>
                      {deductionRows.length > previewDeductionRows.length && (
                        <Button size="small" onClick={() => setDeductionDialogOpen(true)}>
                          View All
                        </Button>
                      )}
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.9 }}>
                      {previewDeductionRows.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          No service deductions configured yet.
                        </Typography>
                      )}
                      {previewDeductionRows.map((row) => (
                        <Box
                          key={row.id}
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0,1fr) auto",
                            gap: 1,
                            alignItems: "center",
                            p: 1,
                            borderRadius: "8px",
                            backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(124,58,237,0.05)",
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                              {row.service}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.status ? "Active" : "Inactive"}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontWeight: 800, color: "#7c3aed" }}>
                            {formatCurrency(Math.round(row.deduction))}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card sx={{ borderRadius: "8px", border: "1px solid", borderColor: "divider" }}>
                  <CardContent sx={{ p: { xs: 1.25, sm: 1.5, md: 1.75 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25, gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Service Distribution
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Last 3 months
                      </Typography>
                    </Box>
                    <Box sx={{ height: { xs: 240, md: 260 } }}>
                      {serviceRevenueData.labels.length > 0 ? (
                        <canvas ref={revenuePieChartRef} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No service activity in the last 3 months.
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>

        <Dialog open={leaderboardDialogOpen} onClose={() => setLeaderboardDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Revenue Leaderboard</DialogTitle>
          <DialogContent dividers>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell align="right">Bookings</TableCell>
                    <TableCell align="right">Deduction</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaderboard.map((entry, index) => (
                    <TableRow key={`full-${entry.name}`}>
                      <TableCell sx={{ fontWeight: 700 }}>{index < 3 ? medals[index] : index + 1}</TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Avatar src={entry.profilePicture || ""} sx={{ width: 28, height: 28, fontSize: "0.78rem" }}>
                            {getInitials(entry.name)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {entry.name}
                            </Typography>
                            {entry.role ? (
                              <Typography variant="caption" color="text.secondary">
                                {roleLabel(entry.role)}
                              </Typography>
                            ) : null}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="right">{entry.count}</TableCell>
                      <TableCell align="right">{formatCurrency(Math.round(entry.deduction || 0))}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(entry.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLeaderboardDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deductionDialogOpen} onClose={() => setDeductionDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Service Deduction Master</DialogTitle>
          <DialogContent dividers>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Service</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Deduction</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deductionRows.map((row) => (
                    <TableRow key={`deduction-${row.id}`}>
                      <TableCell>{row.service}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.status ? "Active" : "Inactive"}
                          sx={{
                            borderRadius: "8px",
                            bgcolor: row.status ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.16)",
                            color: row.status ? "#047857" : "#475569",
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: "#7c3aed" }}>
                        {formatCurrency(Math.round(row.deduction))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeductionDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {isBookingPopupOpen && (
          <Popup isOpen={isBookingPopupOpen} onClose={handleCloseBookingPopup}>
            <EditBooking initialData={selectedBooking} onClose={handleCloseBookingPopup} />
          </Popup>
        )}
      </Box>
    </Box>
  );
};

export default DashboardContent;
