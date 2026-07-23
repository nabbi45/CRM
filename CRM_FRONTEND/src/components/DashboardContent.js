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
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
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
  getBookingDeductionRowsForStats,
  getBookingRevenueForUser,
  getBookingRevenueRowsForUser,
} from "../utils/bookingRevenue";

const TERM_KEYS = Array.from({ length: 10 }, (_, index) => `term_${index + 1}`);

const ACCENT = "#ff3b1f";
const ACCENT_DARK = "#e03118";
const ACCENT_LIGHT = "rgba(255,59,31,0.14)";

const statCardThemes = [
  { bg: "linear-gradient(180deg, #fff7f2 0%, #ffffff 100%)", iconBg: "rgba(255,104,47,0.14)", iconColor: "#ff5722" },
  { bg: "linear-gradient(180deg, #f6fbff 0%, #ffffff 100%)", iconBg: "rgba(59,130,246,0.14)", iconColor: "#2563eb" },
  { bg: "linear-gradient(180deg, #faf7ff 0%, #ffffff 100%)", iconBg: "rgba(124,58,237,0.14)", iconColor: "#7c3aed" },
  { bg: "linear-gradient(180deg, #fffaf2 0%, #ffffff 100%)", iconBg: "rgba(245,158,11,0.16)", iconColor: "#d97706" },
  { bg: "linear-gradient(180deg, #f3fcf8 0%, #ffffff 100%)", iconBg: "rgba(16,185,129,0.14)", iconColor: "#059669" },
  { bg: "linear-gradient(180deg, #fff6fb 0%, #ffffff 100%)", iconBg: "rgba(236,72,153,0.14)", iconColor: "#db2777" },
  { bg: "linear-gradient(180deg, #f4fbff 0%, #ffffff 100%)", iconBg: "rgba(6,182,212,0.14)", iconColor: "#0891b2" },
  { bg: "linear-gradient(180deg, #fff8f0 0%, #ffffff 100%)", iconBg: "rgba(234,88,12,0.14)", iconColor: "#ea580c" },
];

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

const DashboardContent = () => {
  const userSession = JSON.parse(localStorage.getItem("userSession"));
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [totalBookings, setTotalBookings] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [bookingsThisMonth, setBookingsThisMonth] = useState(0);
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
  const [totalManualRefunds, setTotalManualRefunds] = useState(0);
  const [totalRefundableCuts, setTotalRefundableCuts] = useState(0);
  const [deductionTransactions, setDeductionTransactions] = useState([]);
  const [manualRefundTransactions, setManualRefundTransactions] = useState([]);
  const [refundableTransactions, setRefundableTransactions] = useState([]);
  const [deductionBreakdownDialog, setDeductionBreakdownDialog] = useState({ open: false, type: "vendor" });
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
    const gridColor = isDark ? "rgba(255,255,255,0.14)" : "rgba(148,163,184,0.18)";

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: monthlyRevData.labels,
        datasets: [
          {
            label: "Revenue",
            data: monthlyRevData.values,
            backgroundColor: (context) => {
              const { chart } = context;
              const { ctx: chartCtx, chartArea } = chart;
              if (!chartArea) return "rgba(255,132,53,0.92)";
              const gradient = chartCtx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
              gradient.addColorStop(0, "rgba(255,205,158,1)");
              gradient.addColorStop(1, "rgba(255,120,36,1)");
              return gradient;
            },
            hoverBackgroundColor: "rgba(255,120,36,0.92)",
            borderSkipped: false,
            borderWidth: 0,
            borderRadius: 10,
            barPercentage: 0.42,
            categoryPercentage: 0.58,
            maxBarThickness: 30,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 900,
          easing: "easeOutQuart",
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? "#111827" : "#ffffff",
            borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(255,59,31,0.2)",
            borderWidth: 1,
            titleColor: isDark ? "#f8fafc" : "#0f172a",
            bodyColor: isDark ? "#e2e8f0" : "#0f172a",
            displayColors: false,
            callbacks: {
              label: () => "Monthly revenue trend",
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
              callback: () => "",
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
              label: (ctxLabel) => `${ctxLabel.label}: ${ctxLabel.raw} bookings`,
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
              label: (tooltipItem) => `${Number(tooltipItem.raw || 0).toLocaleString()} bookings`,
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
              callback: (value) => `${Number(value).toLocaleString()}`,
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
              label: (ctxLabel) => {
                const value = Number(ctxLabel.raw || 0);
                const total = (ctxLabel.dataset.data || []).reduce((sum, item) => sum + Number(item || 0), 0);
                const percent = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
                return `${ctxLabel.label}: ${value.toLocaleString()} bookings (${percent}%)`;
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
      } else {
        setTotalUsers(0);
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
      let currentMonthRevenue = 0;
      let todayRevenueAmt = 0;
      const sortedBookings = [];
      const bdmRevMap = {};
      const monthlyMap = {};
      const serviceSoldMap = {};
      const serviceRevenueMap = {};
      const currentMonthDeductions = [];

      const isCurrentMonthTerm = (termShare) => {
        const termDate = new Date(termShare?.payment_date || termShare?.date || "");
        return !Number.isNaN(termDate.getTime()) &&
          termDate.getMonth() === currentMonth &&
          termDate.getFullYear() === currentYear;
      };

      const isTodayTerm = (termShare) => getDateKey(termShare?.payment_date) === today;

      for (const booking of bookings) {
        bookingCount += 1;

        const currentMonthParticipationRows = getBookingRevenueRowsForUser(
          booking,
          session.user_id,
          isAdmin,
          (termShare, termKey) => termKey !== "refund" && isCurrentMonthTerm(termShare)
        );
        if (currentMonthParticipationRows.length > 0) {
          bookingCountThisMonth += 1;
        }

        const revenueForAccess = getBookingRevenueForUser(booking, session.user_id, isAdmin, () => true, serviceDeductionMap);
        const currentMonthRev = isAdmin
          ? getBookingRevenueForUser(booking, session.user_id, true, isCurrentMonthTerm, serviceDeductionMap)
          : getBookingRevenueForUser(booking, session.user_id, false, isCurrentMonthTerm, serviceDeductionMap);

        currentMonthRevenue += currentMonthRev;

        todayRevenueAmt += isAdmin
          ? getBookingRevenueForUser(booking, session.user_id, true, isTodayTerm, serviceDeductionMap)
          : getBookingRevenueForUser(booking, session.user_id, false, isTodayTerm, serviceDeductionMap);

        addBookingRevenueToLeaderboard(booking, bdmRevMap, activeUsersMap, isCurrentMonthTerm, serviceDeductionMap);

        currentMonthDeductions.push(
          ...(isAdmin
            ? getBookingDeductionRowsForStats(
                booking,
                isCurrentMonthTerm,
                activeUsersMap
              )
            : getBookingDeductionRowsForUser(
                booking,
                session.user_id,
                false,
                isCurrentMonthTerm,
                serviceDeductionMap,
                activeUsersMap
              ))
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

        TERM_KEYS.forEach((termKey) => {
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
      const serviceDeductionRows = currentMonthDeductions.filter((row) => row.type === "Service Deduction");
      const manualRefundRows = currentMonthDeductions.filter((row) => row.type === "Manual Refund Adjustment");
      const refundableDeductionRows = currentMonthDeductions.filter((row) => row.type === "Refundable Clause Deduction");
      setDeductionTransactions(serviceDeductionRows);
      setManualRefundTransactions(manualRefundRows);
      setRefundableTransactions(refundableDeductionRows);
      setTotalServiceDeductions(
        serviceDeductionRows.reduce((sum, row) => sum + Number(row.deduction || 0), 0)
      );
      setTotalManualRefunds(
        manualRefundRows.reduce((sum, row) => sum + Number(row.deduction || 0), 0)
      );
      setTotalRefundableCuts(
        refundableDeductionRows.reduce((sum, row) => sum + Number(row.deduction || 0), 0)
      );

      const recent = sortedBookings
        .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
        .slice(0, 6);

      setTotalBookings(bookingCount);
      setTotalRevenue(currentMonthRevenue);
      setTodayRevenue(todayRevenueAmt);
      setBookingsThisMonth(bookingCountThisMonth);
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
      { label: "Bookings", value: totalBookings.toLocaleString(), sub: "All accessible bookings", icon: <BookOnlineOutlinedIcon fontSize="small" /> },
      { label: "Revenue This Month", value: formatCurrency(totalRevenue), sub: "After deductions", icon: <CurrencyRupeeOutlinedIcon fontSize="small" /> },
      { label: "Service Deductions", value: formatCurrency(Math.round(totalServiceDeductions)), sub: "Vendor costs this month", icon: <PaidOutlinedIcon fontSize="small" />, detailType: "vendor" },
      { label: "Refund Adjustments", value: formatCurrency(Math.round(totalManualRefunds)), sub: "Manual refunds this month", icon: <ReceiptLongOutlinedIcon fontSize="small" />, detailType: "manualRefund" },
      { label: "Refundable Cuts", value: formatCurrency(Math.round(totalRefundableCuts)), sub: "Refundable clause this month", icon: <ReceiptLongOutlinedIcon fontSize="small" />, detailType: "refundable" },
      { label: "Today's Revenue", value: formatCurrency(todayRevenue), sub: "Live today after deductions", icon: <TodayOutlinedIcon fontSize="small" /> },
      { label: "Total Users", value: totalUsers.toLocaleString(), sub: "Active CRM users", icon: <PeopleAltOutlinedIcon fontSize="small" /> },
      { label: "Bookings This Month", value: bookingsThisMonth.toLocaleString(), sub: "Created this month", icon: <LocalOfferOutlinedIcon fontSize="small" /> },
    ];

    const userCards = [
      { label: "Bookings", value: totalBookings.toLocaleString(), sub: "Your live bookings", icon: <BookOnlineOutlinedIcon fontSize="small" /> },
      { label: "Revenue This Month", value: formatCurrency(totalRevenue), sub: "After deductions", icon: <CurrencyRupeeOutlinedIcon fontSize="small" /> },
      { label: "Service Deductions", value: formatCurrency(Math.round(totalServiceDeductions)), sub: "Vendor costs this month", icon: <PaidOutlinedIcon fontSize="small" />, detailType: "vendor" },
      { label: "Refund Adjustments", value: formatCurrency(Math.round(totalManualRefunds)), sub: "Manual refunds this month", icon: <ReceiptLongOutlinedIcon fontSize="small" />, detailType: "manualRefund" },
      { label: "Refundable Cuts", value: formatCurrency(Math.round(totalRefundableCuts)), sub: "This month", icon: <ReceiptLongOutlinedIcon fontSize="small" />, detailType: "refundable" },
      { label: "Today's Revenue", value: formatCurrency(todayRevenue), sub: "From today's bookings", icon: <TodayOutlinedIcon fontSize="small" /> },
    ];

    return isAdmin ? adminCards : userCards;
  }, [
    bookingsThisMonth,
    isAdmin,
    todayRevenue,
    totalBookings,
    totalRevenue,
    totalManualRefunds,
    totalServiceDeductions,
    totalRefundableCuts,
    totalUsers,
  ]);

  const featuredLeaderboardEntry = leaderboard[0] || null;
  const compactLeaderboardEntries = leaderboard.slice(1, 5);
  const previewDeductionRows = deductionRows.slice(0, 8);
  const medals = ["1", "2", "3"];
  const sectionSpacing = { xs: 1.5, sm: 2.25, md: 2.75 };
  const pageShellSx = {
    width: { xs: "92%", sm: "100%" },
    maxWidth: { xl: 1680 },
    mx: "auto",
    overflowX: "clip",
  };
  const cardSurfaceSx = {
    borderRadius: "8px",
    border: "1px solid",
    borderColor: "divider",
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.palette.mode === "light" ? "0 14px 34px rgba(15,23,42,0.07)" : "0 10px 24px rgba(2,6,23,0.26)",
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Loader />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 0, sm: 1.5, md: 2 }, py: { xs: 0.75, sm: 1.5 }, width: "100%", overflowX: "hidden" }}>
      <Box sx={pageShellSx}>
        {!isMobile && (
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
        )}

        {companyBranches.length > 0 && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: isMobile ? 1.25 : 2, mt: isMobile ? 0.25 : 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", mr: 0.5, fontWeight: 600 }}>
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

        <Grid container spacing={{ xs: 1, sm: 1.5, md: 1.75 }} sx={{ mt: sectionSpacing, overflowX: "hidden" }}>
          {statCards.map((card, index) => {
            const palette = statCardThemes[index % statCardThemes.length];
            const tileTitleColor = theme.palette.mode === "dark" ? "#cbd5e1" : "#64748b";
            const tileValueColor = theme.palette.mode === "dark" ? "#f8fafc" : "#0f172a";
            const tileSubColor = "#94a3b8";
            const tileBorderColor = theme.palette.mode === "dark" ? "rgba(148,163,184,0.18)" : `${palette.iconColor}26`;
            const tileShadow = theme.palette.mode === "dark"
              ? "0 16px 32px rgba(2,6,23,0.28)"
              : `0 16px 30px ${palette.iconColor}12`;
            return (
              <Grid item xs={6} md={3} key={card.label} sx={{ minWidth: 0 }}>
                <Card
                  sx={{
                    ...cardSurfaceSx,
                    height: "100%",
                    width: "100%",
                    minHeight: { xs: 74, sm: 138, md: 132 },
                    aspectRatio: { xs: "1.55 / 1", sm: "1.18 / 1", md: "auto" },
                    background: theme.palette.mode === "dark"
                      ? "linear-gradient(180deg, rgba(30,41,59,0.96) 0%, rgba(15,23,42,0.98) 100%)"
                      : palette.bg,
                    overflow: "hidden",
                    position: "relative",
                    borderColor: tileBorderColor,
                    boxShadow: tileShadow,
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      inset: 0,
                      background: theme.palette.mode === "dark"
                        ? "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 42%)"
                        : "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 38%)",
                      pointerEvents: "none",
                    },
                    cursor: card.detailType ? "pointer" : "default",
                    transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: theme.palette.mode === "dark"
                        ? "0 18px 34px rgba(2,6,23,0.34)"
                        : `0 18px 34px ${palette.iconColor}18`,
                    },
                  }}
                  onClick={() => {
                    if (card.detailType) {
                      setDeductionBreakdownDialog({ open: true, type: card.detailType });
                    }
                  }}
                >
                  <CardContent
                    sx={{
                      p: { xs: 0.9, sm: 1.25 },
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      "&:last-child": { pb: { xs: 0.9, sm: 1.25 } },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                      <Box sx={{ minWidth: 0, pr: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            color: tileTitleColor,
                            fontSize: { xs: "0.5rem", sm: "0.72rem" },
                            fontWeight: 700,
                            display: "block",
                            mb: 0.18,
                            textTransform: "uppercase",
                            lineHeight: 1.15,
                          }}
                        >
                          {card.label}
                        </Typography>
                        <Typography
                          sx={{
                            color: tileValueColor,
                            fontWeight: 800,
                            fontSize: { xs: "0.82rem", sm: "1.18rem", md: "1.2rem" },
                            lineHeight: 1.1,
                            wordBreak: "break-word",
                            mt: 0.15,
                          }}
                        >
                          {card.value}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: tileSubColor,
                            fontSize: { xs: "0.45rem", sm: "0.68rem" },
                            mt: 0.12,
                            lineHeight: 1.12,
                            display: "-webkit-box",
                            WebkitLineClamp: { xs: 2, sm: "unset" },
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {card.sub}
                        </Typography>
                      </Box>

                      <Avatar
                        sx={{
                          width: { xs: 24, sm: 34 },
                          height: { xs: 24, sm: 34 },
                          bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : palette.iconBg,
                          color: palette.iconColor,
                          borderRadius: "8px",
                          flexShrink: 0,
                          boxShadow: theme.palette.mode === "dark"
                            ? "inset 0 0 0 1px rgba(148,163,184,0.18)"
                            : "inset 0 0 0 1px rgba(255,255,255,0.24)",
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

        <Grid container spacing={{ xs: 1, sm: 1.5, md: 1.75 }} sx={{ mt: sectionSpacing, overflowX: "hidden" }}>
          {isAdmin && (
            <Grid item xs={12} lg={4} order={{ xs: 1, lg: 2 }} sx={{ minWidth: 0 }}>
            <Card sx={{ ...cardSurfaceSx, height: "100%", minHeight: { xs: 0, md: 380, lg: 430 }, width: "100%", overflow: "hidden" }}>
                <CardContent sx={{ p: { xs: 1.25, sm: 1.5, md: 1.75 }, height: "100%", display: "flex", flexDirection: "column" }}>
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
                          p: { xs: 1.1, sm: 1.5 },
                          borderRadius: "8px",
                        border: "1px solid rgba(255,59,31,0.16)",
                        background: theme.palette.mode === "dark"
                          ? "linear-gradient(180deg, rgba(255,59,31,0.10) 0%, rgba(255,255,255,0.02) 100%)"
                          : "linear-gradient(180deg, rgba(255,244,237,1) 0%, rgba(255,255,255,1) 100%)",
                        mb: 1.25,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Avatar
                          src={featuredLeaderboardEntry.profilePicture || ""}
                          sx={{
                            width: { xs: 44, sm: 54 },
                            height: { xs: 44, sm: 54 },
                            bgcolor: "rgba(255,59,31,0.16)",
                            color: ACCENT_DARK,
                            fontWeight: 700,
                          }}
                        >
                          {getInitials(featuredLeaderboardEntry.name)}
                        </Avatar>

                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, fontSize: { xs: "0.9rem", sm: "1rem" } }} noWrap>
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
                          <Typography sx={{ fontWeight: 700, mt: 0.25, fontSize: { xs: "0.8rem", sm: "1rem" } }}>
                            {featuredLeaderboardEntry.count}
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">
                            Deduction
                          </Typography>
                          <Typography sx={{ fontWeight: 700, mt: 0.25, fontSize: { xs: "0.74rem", sm: "1rem" } }}>
                            {formatCurrency(Math.round(featuredLeaderboardEntry.deduction || 0))}
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">
                            Revenue
                          </Typography>
                          <Typography sx={{ fontWeight: 700, mt: 0.25, color: ACCENT_DARK, fontSize: { xs: "0.74rem", sm: "1rem" } }}>
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
                            width: { xs: 30, sm: 34 },
                            height: { xs: 30, sm: 34 },
                            fontSize: "0.8rem",
                            bgcolor: "rgba(59,130,246,0.14)",
                            color: "#2563eb",
                          }}
                        >
                          {getInitials(entry.name)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: { xs: "0.82rem", sm: "0.875rem" } }} noWrap>
                            {entry.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {entry.count} bookings · {formatCurrency(entry.revenue)}
                          </Typography>
                        </Box>
                        <Chip size="small" label={`#${index + 2}`} sx={{ borderRadius: "8px", fontWeight: 700 }} />
                      </Box>
                    ))}
                  </Box>

                  {leaderboard.length > 4 && (
                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: "auto", pt: 1.25 }}>
                      <Button size="small" onClick={() => setLeaderboardDialogOpen(true)}>
                        View All
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}

          <Grid item xs={12} lg={8} order={{ xs: isAdmin ? 2 : 1, lg: 1 }} sx={{ minWidth: 0 }}>
            <Card sx={{ ...cardSurfaceSx, height: "100%", minHeight: { xs: 0, md: 380, lg: 430 }, width: "100%", overflow: "hidden" }}>
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

                <Box sx={{ height: { xs: 210, md: 320, lg: 350 } }}>
                  <canvas ref={chartRef} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={{ xs: 1, sm: 1.5, md: 1.75 }} sx={{ mt: sectionSpacing, overflowX: "hidden" }}>
          <Grid item xs={12} xl={7} sx={{ minWidth: 0 }}>
            <Card sx={{ ...cardSurfaceSx, height: "100%", width: "100%", overflow: "hidden" }}>
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
                          <Typography variant="body2" sx={{ fontWeight: 700, pr: 0.5, lineHeight: 1.3 }} noWrap={!isMobile}>
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
                                  "& .MuiChip-label": {
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: { xs: 120, sm: "100%" },
                                    display: "block",
                                  },
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: { xs: "stretch", sm: "flex-end" }, gap: 0.6, width: { xs: "100%", sm: "auto" } }}>
                          <Typography sx={{ fontWeight: 800, color: ACCENT_DARK, textAlign: { xs: "left", sm: "right" } }}>
                            {formatCurrency(TERM_KEYS.reduce((sum, termKey) => sum + Number(booking?.[termKey] || 0), 0))}
                          </Typography>
                          <Button size="small" fullWidth={isMobile} onClick={() => handleOpenBooking(booking._id)}>
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

          <Grid item xs={12} xl={5} sx={{ minWidth: 0 }}>
            <Card sx={{ ...cardSurfaceSx, width: "100%", overflow: "hidden" }}>
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
                  {deductionRows.length > previewDeductionRows.length && (
                    <Button
                      size="small"
                      onClick={() => setDeductionDialogOpen(true)}
                      sx={{ mt: 0.25, alignSelf: "stretch" }}
                    >
                      View More
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={{ xs: 1, sm: 1.5, md: 1.75 }} sx={{ mt: sectionSpacing, overflowX: "hidden" }}>
          <Grid item xs={12} lg={7} sx={{ minWidth: 0 }}>
            <Card sx={{ ...cardSurfaceSx, height: "100%", width: "100%", overflow: "hidden" }}>
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

                <Box sx={{ height: { xs: 190, md: 230 } }}>
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

          <Grid item xs={12} lg={5} sx={{ minWidth: 0 }}>
            <Card sx={{ ...cardSurfaceSx, height: "100%", width: "100%", overflow: "hidden" }}>
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

                <Box sx={{ height: { xs: 190, md: 230 } }}>
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

        <Grid container spacing={{ xs: 1, sm: 1.5, md: 1.75 }} sx={{ mt: sectionSpacing, overflowX: "hidden" }}>
          <Grid item xs={12} sx={{ minWidth: 0 }}>
            <Card sx={{ ...cardSurfaceSx, width: "100%", overflow: "hidden" }}>
              <CardContent sx={{ p: { xs: 1.25, sm: 1.5, md: 1.75 } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25, gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Service Distribution
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last 3 months
                  </Typography>
                </Box>

                <Box sx={{ height: { xs: 220, md: 280 } }}>
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

        <Dialog
          open={deductionBreakdownDialog.open}
          onClose={() => setDeductionBreakdownDialog({ open: false, type: "vendor" })}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {deductionBreakdownDialog.type === "refundable"
              ? "Refundable Cuts"
              : deductionBreakdownDialog.type === "manualRefund"
                ? "Refund Adjustments"
                : "Service Deductions"}
          </DialogTitle>
          <DialogContent dividers>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Service</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Booking</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(
                    deductionBreakdownDialog.type === "refundable"
                      ? refundableTransactions
                      : deductionBreakdownDialog.type === "manualRefund"
                        ? manualRefundTransactions
                        : deductionTransactions
                  ).map((row, index) => (
                    <TableRow key={`${row.bookingId}-${row.type}-${index}`}>
                      <TableCell>{row.date ? new Date(row.date).toLocaleDateString("en-GB") : "-"}</TableCell>
                      <TableCell>{row.employeeName || "-"}</TableCell>
                      <TableCell>{row.companyName || "-"}</TableCell>
                      <TableCell>{row.service || "-"}</TableCell>
                      <TableCell>{row.type || "-"}</TableCell>
                      <TableCell>{row.bookingId || "-"}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(row.deduction || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(
                    deductionBreakdownDialog.type === "refundable"
                      ? refundableTransactions
                      : deductionBreakdownDialog.type === "manualRefund"
                        ? manualRefundTransactions
                        : deductionTransactions
                  ).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">No rows found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeductionBreakdownDialog({ open: false, type: "vendor" })}>Close</Button>
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
