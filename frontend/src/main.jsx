import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BadgeIndianRupee,
  CalendarDays,
  Car,
  CircleParking,
  Clock,
  CreditCard,
  Gauge,
  LogIn,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  User,
  UserCog
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { api } from "./api.js";
import "./styles.css";

const colors = ["#2f6f73", "#d9893d", "#6b77b8", "#a84f57"];

const vehicleOptions = [
  { value: "two_wheeler", label: "Two Wheeler" },
  { value: "three_wheeler", label: "Three Wheeler" },
  { value: "four_wheeler", label: "Four Wheeler" }
];

function vehicleLabel(value) {
  const legacyMap = {
    bike: "Two Wheeler",
    car: "Four Wheeler",
    ev: "Four Wheeler",
    accessible: "Four Wheeler"
  };
  if (legacyMap[value]) return legacyMap[value];
  return vehicleOptions.find((item) => item.value === value)?.label || value;
}

function formatDateTime(value) {
  if (!value) return "Not checked out";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(value);
}

function titleCase(value) {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const numericMetricOptions = [
  {
    value: "durationHours",
    label: "Duration (Hours)",
    shortLabel: "Duration",
    formatter: (value) => `${formatNumber(value)} hr`,
    axisFormatter: (value) => `${formatNumber(value)}h`
  },
  {
    value: "amountPaid",
    label: "Amount Paid (Rs)",
    shortLabel: "Amount Paid",
    formatter: (value) => `Rs ${formatNumber(value)}`,
    axisFormatter: (value) => `Rs ${formatNumber(value, 0)}`
  },
  {
    value: "slotNumber",
    label: "Slot Number",
    shortLabel: "Slot Number",
    formatter: (value) => formatNumber(value, 0),
    axisFormatter: (value) => formatNumber(value, 0)
  },
  {
    value: "hourlyRate",
    label: "Hourly Rate (Rs/hr)",
    shortLabel: "Hourly Rate",
    formatter: (value) => `Rs ${formatNumber(value)}`,
    axisFormatter: (value) => `Rs ${formatNumber(value, 0)}`
  },
  {
    value: "lotCapacity",
    label: "Lot Capacity",
    shortLabel: "Lot Capacity",
    formatter: (value) => formatNumber(value, 0),
    axisFormatter: (value) => formatNumber(value, 0)
  },
  {
    value: "entryHour",
    label: "Entry Hour",
    shortLabel: "Entry Hour",
    formatter: (value) => `${String(Math.round(value)).padStart(2, "0")}:00`,
    axisFormatter: (value) => `${String(Math.round(value)).padStart(2, "0")}:00`
  }
];

const boxGroupOptions = [
  { value: "vehicleType", label: "Vehicle Type", formatter: vehicleLabel },
  { value: "paymentStatus", label: "Payment Status", formatter: titleCase },
  { value: "sessionState", label: "Session State", formatter: (value) => value || "Unknown" },
  { value: "zone", label: "Zone", formatter: (value) => value || "Unknown" }
];

const numericMetricMap = Object.fromEntries(
  numericMetricOptions.map((option) => [option.value, option])
);
const boxGroupMap = Object.fromEntries(
  boxGroupOptions.map((option) => [option.value, option])
);

function formatMetricValue(metric, value) {
  if (!Number.isFinite(value)) return "-";
  return metric?.formatter ? metric.formatter(value) : formatNumber(value);
}

function formatMetricAxis(metric, value) {
  if (!Number.isFinite(value)) return "-";
  return metric?.axisFormatter ? metric.axisFormatter(value) : formatMetricValue(metric, value);
}

function createAnalyticsRows(sessions) {
  return sessions.map((session) => {
    const entryTime = new Date(session.entryTime);
    const exitTime = session.exitTime ? new Date(session.exitTime) : new Date();
    const durationHours = Math.max((exitTime.getTime() - entryTime.getTime()) / 36e5, 0);

    return {
      vehicleNumber: session.vehicleNumber,
      lotName: session.lot?.name || "Unknown",
      zone: session.lot?.zone || "Unknown",
      vehicleType: session.vehicleType,
      paymentStatus: session.paymentStatus,
      sessionState: session.exitTime ? "Completed" : "Active",
      durationHours,
      amountPaid: Number(session.amountPaid || 0),
      slotNumber: Number(session.slotNumber || 0),
      hourlyRate: Number(session.lot?.hourlyRate || 0),
      lotCapacity: Number(session.lot?.capacity || 0),
      entryHour: entryTime.getHours()
    };
  });
}

function computePearsonCorrelation(points) {
  if (points.length < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  points.forEach(({ x, y }) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  });

  const denominator = Math.sqrt(
    (points.length * sumX2 - sumX * sumX) * (points.length * sumY2 - sumY * sumY)
  );

  if (!denominator) return null;
  return (points.length * sumXY - sumX * sumY) / denominator;
}

function describeCorrelation(value) {
  const strength = Math.abs(value);
  if (strength >= 0.8) return "strong";
  if (strength >= 0.5) return "moderate";
  if (strength >= 0.25) return "light";
  return "weak";
}

function getStandardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  );
}

function buildDensitySeries(values, steps = 32) {
  if (!values.length) return [];

  const sorted = [...values].sort((a, b) => a - b);
  let min = sorted[0];
  let max = sorted[sorted.length - 1];

  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.1, 1);
    min -= padding;
    max += padding;
  }

  const standardDeviation = getStandardDeviation(sorted);
  const rawBandwidth = 1.06 * standardDeviation * Math.pow(sorted.length, -0.2);
  const bandwidth =
    Number.isFinite(rawBandwidth) && rawBandwidth > 0
      ? rawBandwidth
      : Math.max((max - min) / 12, 0.75);

  const series = Array.from({ length: steps }, (_, index) => {
    const value = min + ((max - min) * index) / (steps - 1);
    const density =
      sorted.reduce((sum, point) => {
        const scaledDistance = (value - point) / bandwidth;
        return sum + Math.exp(-0.5 * scaledDistance * scaledDistance);
      }, 0) /
      (sorted.length * bandwidth * Math.sqrt(2 * Math.PI));

    return { value, density };
  });

  const peakDensity = Math.max(...series.map((point) => point.density), 1);

  return series.map((point) => ({
    value: Number(point.value.toFixed(2)),
    density: Number((point.density / peakDensity).toFixed(4))
  }));
}

function quantileSorted(sortedValues, ratio) {
  if (!sortedValues.length) return null;
  const index = (sortedValues.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function computeBoxPlotStats(values) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25);
  const median = quantileSorted(sorted, 0.5);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - iqr * 1.5;
  const upperFence = q3 + iqr * 1.5;
  const nonOutliers = sorted.filter((value) => value >= lowerFence && value <= upperFence);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1,
    median,
    q3,
    whiskerMin: nonOutliers[0] ?? sorted[0],
    whiskerMax: nonOutliers[nonOutliers.length - 1] ?? sorted[sorted.length - 1],
    outliers: sorted.filter((value) => value < lowerFence || value > upperFence),
    count: sorted.length
  };
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <section className="stat-card">
      <div className="stat-icon">
        <Icon size={20} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{hint}</span>
      </div>
    </section>
  );
}

function EmptyAnalyticsState({ message }) {
  return <div className="chart-empty">{message}</div>;
}

function BoxPlotChart({ groups, metric }) {
  if (!groups.length) {
    return <EmptyAnalyticsState message="No data available for the selected box plot." />;
  }

  const width = 820;
  const height = Math.max(260, 92 + groups.length * 56);
  const padding = { top: 26, right: 26, bottom: 40, left: 150 };
  const values = groups.flatMap((group) => [group.stats.min, group.stats.max]);
  let domainMin = Math.min(...values);
  let domainMax = Math.max(...values);

  if (domainMin === domainMax) {
    const paddingAmount = Math.max(Math.abs(domainMin) * 0.1, 1);
    domainMin -= paddingAmount;
    domainMax += paddingAmount;
  }

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const rowHeight = plotHeight / groups.length;
  const scaleX = (value) =>
    padding.left + ((value - domainMin) / (domainMax - domainMin)) * plotWidth;
  const ticks = Array.from({ length: 5 }, (_, index) =>
    domainMin + ((domainMax - domainMin) * index) / 4
  );

  return (
    <div className="boxplot-wrap">
      <svg
        className="boxplot-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${metric.label} box plot`}
      >
        <g className="boxplot-grid">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={scaleX(tick)}
                x2={scaleX(tick)}
                y1={padding.top}
                y2={height - padding.bottom}
              />
              <text x={scaleX(tick)} y={height - 12} textAnchor="middle">
                {formatMetricAxis(metric, tick)}
              </text>
            </g>
          ))}
        </g>

        {groups.map((group, index) => {
          const centerY = padding.top + rowHeight * index + rowHeight / 2;
          const boxHeight = Math.min(28, rowHeight * 0.52);
          const { whiskerMin, whiskerMax, q1, median, q3, outliers } = group.stats;

          return (
            <g key={group.key}>
              <text className="boxplot-label" x={padding.left - 16} y={centerY + 4} textAnchor="end">
                {group.label}
              </text>
              <text className="boxplot-count" x={padding.left - 16} y={centerY + 20} textAnchor="end">
                n={group.count}
              </text>

              <line
                className="boxplot-whisker"
                x1={scaleX(whiskerMin)}
                x2={scaleX(whiskerMax)}
                y1={centerY}
                y2={centerY}
              />
              <line
                className="boxplot-cap"
                x1={scaleX(whiskerMin)}
                x2={scaleX(whiskerMin)}
                y1={centerY - boxHeight / 2}
                y2={centerY + boxHeight / 2}
              />
              <line
                className="boxplot-cap"
                x1={scaleX(whiskerMax)}
                x2={scaleX(whiskerMax)}
                y1={centerY - boxHeight / 2}
                y2={centerY + boxHeight / 2}
              />
              <rect
                className="boxplot-box"
                x={scaleX(q1)}
                y={centerY - boxHeight / 2}
                width={Math.max(scaleX(q3) - scaleX(q1), 2)}
                height={boxHeight}
                rx={6}
              />
              <line
                className="boxplot-median"
                x1={scaleX(median)}
                x2={scaleX(median)}
                y1={centerY - boxHeight / 2}
                y2={centerY + boxHeight / 2}
              />
              {outliers.map((value, pointIndex) => (
                <circle
                  className="boxplot-outlier"
                  cx={scaleX(value)}
                  cy={centerY}
                  key={`${group.key}-${value}-${pointIndex}`}
                  r={3.5}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SlotGrid({ lot, selectedSlot, selectedVehicleType, onSelect, readOnly = false }) {
  if (!lot) return <p className="empty">Select a parking place to view slots.</p>;

  return (
    <div className="slot-map-wrap">
      <div className="slot-legend">
        <span><i className="free-dot" /> Free</span>
        <span><i className="selected-dot" /> Selected</span>
        <span><i className="occupied-dot" /> Occupied</span>
        <span><i className="wrong-type-dot" /> Reserved for other type</span>
      </div>
      <div className="slot-sections">
        {(lot.slotAllocation || []).map((section) => (
          <span key={section.type}>
            {section.label}: {section.start}-{section.end}
          </span>
        ))}
      </div>
      <div className="slot-map">
        {(lot.slots || []).map((slot) => {
          const isSelected = Number(selectedSlot) === slot.slotNumber;
          const wrongType = selectedVehicleType && slot.reservedFor !== selectedVehicleType;
          const disabled = readOnly || slot.occupied || wrongType;
          return (
            <button
              className={`slot ${slot.occupied ? "occupied" : ""} ${isSelected ? "selected" : ""} ${wrongType ? "wrong-type" : ""}`}
              disabled={disabled}
              key={slot.slotNumber}
              onClick={() => onSelect?.(slot.slotNumber)}
              title={
                slot.occupied
                  ? `${slot.occupant.vehicleNumber} in slot ${slot.slotNumber}`
                  : `${slot.reservedLabel} slot ${slot.slotNumber}`
              }
              type="button"
            >
              {slot.slotNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [role, setRole] = useState("user");
  const [mode, setMode] = useState("login");
  const [credentials, setCredentials] = useState({
    name: "",
    username: "",
    password: "",
    phone: ""
  });
  const [error, setError] = useState("");

  function chooseRole(nextRole) {
    setRole(nextRole);
    setMode("login");
    setCredentials({ name: "", username: "", password: "", phone: "" });
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      if (mode === "register") {
        const response = await api.register(credentials);
        onLogin(response.user);
        return;
      }
      const response = await api.login({ ...credentials, role });
      onLogin(response.user);
    } catch (loginError) {
      setError(loginError.message);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-hero">
        <p className="eyebrow">Cloud-Based Smart Parking</p>
        <h1>Separate user and admin portals</h1>
        <p>
          Users book reserved vehicle-type slots and pay at checkout. Admins see the
          same live occupancy, user activity, and analytics from the backend.
        </p>
      </section>

      <section className="login-panel">
        <div className="role-switch">
          <button className={role === "user" ? "active" : ""} onClick={() => chooseRole("user")}>
            <User size={18} /> User Login
          </button>
          <button className={role === "admin" ? "active" : ""} onClick={() => chooseRole("admin")}>
            <UserCog size={18} /> Admin Login
          </button>
        </div>

        {role === "user" && (
          <div className="auth-mode">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
              Login
            </button>
            <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">
              Register
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === "register" && role === "user" && (
            <>
              <label>
                Full Name
                <input
                  value={credentials.name}
                  onChange={(event) => setCredentials({ ...credentials, name: event.target.value })}
                  required
                />
              </label>
              <label>
                Phone
                <input
                  value={credentials.phone}
                  onChange={(event) => setCredentials({ ...credentials, phone: event.target.value })}
                />
              </label>
            </>
          )}
          <label>
            Username
            <input
              value={credentials.username}
              onChange={(event) => setCredentials({ ...credentials, username: event.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
              required
            />
          </label>
          <button className="primary-button" type="submit">
            <LogIn size={18} /> {mode === "register" ? "Create User Account" : `Login as ${role === "admin" ? "Admin" : "User"}`}
          </button>
        </form>

        {error && <div className="message">{error}</div>}
      </section>
    </main>
  );
}

function UserPortal({ auth, lots, sessions, form, setForm, onCheckIn, onCheckOut, loading }) {
  const userSessions = useMemo(() => {
    if (!auth?.id) return sessions;
    return sessions.filter(
      (session) => String(session.user?._id || session.user || "") === String(auth.id)
    );
  }, [auth?.id, sessions]);

  const activeUserSession = userSessions.find((session) => !session.exitTime);
  const selectedLot = lots.find((lot) => lot._id === form.lotId);

  function updateVehicleType(vehicleType) {
    setForm({ ...form, vehicleType, slotNumber: "" });
  }

  return (
    <>
      <section className="user-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Book Reserved Slot</h2>
            <CircleParking size={18} />
          </div>
          <form onSubmit={onCheckIn}>
            <label>
              Vehicle Type
              <select
                value={form.vehicleType}
                onChange={(event) => updateVehicleType(event.target.value)}
              >
                {vehicleOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Select Parking Place
              <select
                value={form.lotId}
                onChange={(event) => setForm({ ...form, lotId: event.target.value, slotNumber: "" })}
              >
                {lots.map((lot) => (
                  <option key={lot._id} value={lot._id}>
                    {lot.name} - {lot.available} free - Rs {lot.hourlyRate}/hr
                  </option>
                ))}
              </select>
            </label>
            <label>
              Selected Slot
              <input
                value={form.slotNumber || ""}
                placeholder="Choose from pictorial slot map"
                readOnly
                required
              />
            </label>
            <SlotGrid
              lot={selectedLot}
              selectedSlot={form.slotNumber}
              selectedVehicleType={form.vehicleType}
              onSelect={(slotNumber) => setForm({ ...form, slotNumber })}
            />
            <label>
              Vehicle Number
              <input
                value={form.vehicleNumber}
                onChange={(event) =>
                  setForm({ ...form, vehicleNumber: event.target.value.toUpperCase() })
                }
                placeholder="KA05AB1234"
                required
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={loading || Boolean(activeUserSession) || !form.slotNumber}
            >
              <Car size={18} /> Book Slot
            </button>
          </form>
          {selectedLot && (
            <div className="price-box">
              <span>Selected place</span>
              <strong>{selectedLot.name}</strong>
              <p>Lowered price: Rs {selectedLot.hourlyRate} per hour</p>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Payment and Checkout</h2>
            <CreditCard size={18} />
          </div>
          {activeUserSession ? (
            <div className="payment-card">
              <p>Active booking</p>
              <h3>{activeUserSession.vehicleNumber}</h3>
              <span>{activeUserSession.lot?.name || "Selected parking lot"}</span>
              <span>{vehicleLabel(activeUserSession.vehicleType)} | Slot {activeUserSession.slotNumber}</span>
              <span>Checked in: {formatDateTime(activeUserSession.entryTime)}</span>
              <span>Payment status: {activeUserSession.paymentStatus}</span>
              <button className="primary-button" onClick={() => onCheckOut(activeUserSession._id)}>
                <CreditCard size={18} /> Pay and Check Out
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <Clock size={28} />
              <p>Your active booking and recent parking activity will appear here after you reserve a slot.</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>My Parking Activity</h2>
          <Activity size={18} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Vehicle</th>
                <th>Lot</th>
                <th>Slot</th>
                <th>Type</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {userSessions.map((session) => (
                <tr key={session._id}>
                  <td>{session.exitTime ? "Checked Out" : "Active Booking"}</td>
                  <td>{session.vehicleNumber}</td>
                  <td>{session.lot?.name || "Unknown"}</td>
                  <td>{session.slotNumber}</td>
                  <td>{vehicleLabel(session.vehicleType)}</td>
                  <td>{formatDateTime(session.entryTime)}</td>
                  <td>{formatDateTime(session.exitTime)}</td>
                  <td>{session.exitTime ? "Completed" : "Active"}</td>
                  <td>{session.paymentStatus}</td>
                  <td>Rs {session.amountPaid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {userSessions.length === 0 && <p className="empty">No parking activity found for this user account yet.</p>}
      </section>
    </>
  );
}

function AdminPortal({
  lots,
  sessions,
  summary,
  peakHours,
  lotPerformance,
  vehicleMix,
  paymentStatus,
  durationBuckets,
  revenueByVehicleType,
  turnover,
  analyticsFilter,
  setAnalyticsFilter,
  loading,
  onCheckOut
}) {
  const [correlationX, setCorrelationX] = useState("durationHours");
  const [correlationY, setCorrelationY] = useState("amountPaid");
  const [densityFeature, setDensityFeature] = useState("durationHours");
  const [boxFeature, setBoxFeature] = useState("durationHours");
  const [boxGroupBy, setBoxGroupBy] = useState("vehicleType");

  const analyticsRows = useMemo(() => createAnalyticsRows(sessions), [sessions]);
  const correlationMetricX = numericMetricMap[correlationX];
  const correlationMetricY = numericMetricMap[correlationY];
  const densityMetric = numericMetricMap[densityFeature];
  const boxMetric = numericMetricMap[boxFeature];
  const boxGroup = boxGroupMap[boxGroupBy];
  const currentFilterLabel = analyticsFilter.date || analyticsFilter.month || "All sessions";

  const correlationData = useMemo(
    () =>
      analyticsRows
        .map((row) => ({
          x: row[correlationX],
          y: row[correlationY],
          vehicleNumber: row.vehicleNumber,
          lotName: row.lotName
        }))
        .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y)),
    [analyticsRows, correlationX, correlationY]
  );

  const correlationCoefficient = useMemo(
    () => computePearsonCorrelation(correlationData),
    [correlationData]
  );

  const densityValues = useMemo(
    () => analyticsRows.map((row) => row[densityFeature]).filter(Number.isFinite),
    [analyticsRows, densityFeature]
  );
  const densitySeries = useMemo(() => buildDensitySeries(densityValues), [densityValues]);
  const densityStats = useMemo(() => computeBoxPlotStats(densityValues), [densityValues]);

  const boxGroups = useMemo(() => {
    const groupedValues = new Map();

    analyticsRows.forEach((row) => {
      const metricValue = row[boxFeature];
      const groupKey = row[boxGroupBy] || "Unknown";
      if (!Number.isFinite(metricValue)) return;

      const existing = groupedValues.get(groupKey) || [];
      existing.push(metricValue);
      groupedValues.set(groupKey, existing);
    });

    return Array.from(groupedValues.entries())
      .map(([groupKey, values]) => ({
        key: `${boxGroupBy}-${groupKey}`,
        label: boxGroup.formatter(groupKey),
        count: values.length,
        stats: computeBoxPlotStats(values)
      }))
      .filter((group) => group.stats)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [analyticsRows, boxFeature, boxGroupBy, boxGroup]);

  const currentHourDemand = peakHours.find((row) => row.isCurrentHour);
  const topDemandHour = peakHours.reduce(
    (top, row) => (row.checkIns > (top?.checkIns || 0) ? row : top),
    peakHours[0]
  );

  return (
    <>
      <section className="panel filter-panel">
        <div className="panel-heading">
          <h2>Analytics Time Filter</h2>
          <CalendarDays size={18} />
        </div>
        <div className="filter-grid">
          <label>
            Month
            <input
              type="month"
              value={analyticsFilter.month}
              onChange={(event) => setAnalyticsFilter({ month: event.target.value, date: "" })}
            />
          </label>
          <label>
            Specific Date
            <input
              type="date"
              value={analyticsFilter.date}
              min={analyticsFilter.month ? `${analyticsFilter.month}-01` : undefined}
              max={analyticsFilter.month ? `${analyticsFilter.month}-31` : undefined}
              onChange={(event) => setAnalyticsFilter({ ...analyticsFilter, date: event.target.value })}
            />
          </label>
          <button className="small-button" type="button" onClick={() => setAnalyticsFilter({ month: "", date: "" })}>
            Clear Filter
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard icon={CircleParking} label="Available Slots" value={summary ? summary.availableSlots : "-"} hint={`${summary?.totalCapacity || 0} total capacity`} />
        <StatCard icon={Gauge} label="Occupancy" value={`${summary?.occupancyRate || 0}%`} hint={`${summary?.activeSessions || 0} active vehicles`} />
        <StatCard icon={BadgeIndianRupee} label="Revenue" value={`Rs ${summary?.revenue || 0}`} hint={`${summary?.completedSessions || 0} paid sessions`} />
        <StatCard icon={ShieldCheck} label="Sensor Health" value={`${summary?.sensorHealthRate || 0}%`} hint={`${summary?.violations || 0} flagged violations`} />
        <StatCard icon={TrendingUp} label="Current Hour Demand" value={currentHourDemand?.checkIns || 0} hint={`Peak: ${topDemandHour?.label || "No data"} with ${topDemandHour?.checkIns || 0} check-ins`} />
      </section>

      <section className="analytics-grid">
        <div className="panel chart-panel">
          <div className="panel-heading">
            <h2>Hourly Demand Analytics</h2>
            <span>{loading ? "Loading" : "Live"}</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="checkIns" stroke="#2f6f73" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Correlation Explorer</h2>
            <Activity size={18} />
          </div>
          <div className="chart-controls">
            <label>
              X Axis
              <select value={correlationX} onChange={(event) => setCorrelationX(event.target.value)}>
                {numericMetricOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Y Axis
              <select value={correlationY} onChange={(event) => setCorrelationY(event.target.value)}>
                {numericMetricOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {correlationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  tickFormatter={(value) => formatMetricAxis(correlationMetricX, value)}
                  type="number"
                />
                <YAxis
                  dataKey="y"
                  tickFormatter={(value) => formatMetricAxis(correlationMetricY, value)}
                  type="number"
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatMetricValue(name === "x" ? correlationMetricX : correlationMetricY, Number(value)),
                    name === "x" ? correlationMetricX.shortLabel : correlationMetricY.shortLabel
                  ]}
                />
                <Scatter data={correlationData} fill="#2f6f73" />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <EmptyAnalyticsState message="No filtered sessions are available for the selected correlation." />
          )}
          <p className="analytics-note">
            {correlationData.length < 2
              ? `At least two filtered sessions are needed to compare ${correlationMetricX.shortLabel.toLowerCase()} and ${correlationMetricY.shortLabel.toLowerCase()}.`
              : correlationCoefficient == null
                ? "The selected features do not vary enough to compute a stable Pearson correlation."
                : `Pearson r = ${correlationCoefficient.toFixed(2)} with a ${describeCorrelation(correlationCoefficient)} ${correlationCoefficient >= 0 ? "positive" : "negative"} relationship across ${correlationData.length} filtered sessions.`}
          </p>
        </div>
      </section>

      <section className="analytics-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Density Plot</h2>
            <Gauge size={18} />
          </div>
          <div className="chart-controls chart-controls-single">
            <label>
              Feature
              <select value={densityFeature} onChange={(event) => setDensityFeature(event.target.value)}>
                {numericMetricOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {densitySeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={densitySeries} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="value"
                  tickFormatter={(value) => formatMetricAxis(densityMetric, value)}
                  type="number"
                />
                <YAxis tickFormatter={(value) => `${Math.round(value * 100)}%`} />
                <Tooltip
                  formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Relative Density"]}
                  labelFormatter={(value) => formatMetricValue(densityMetric, Number(value))}
                />
                <Area
                  dataKey="density"
                  fill="#6b77b8"
                  fillOpacity={0.3}
                  stroke="#6b77b8"
                  strokeWidth={3}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyAnalyticsState message="No filtered sessions are available for the selected density plot." />
          )}
          <p className="analytics-note">
            {densityStats
              ? `Median ${formatMetricValue(densityMetric, densityStats.median)} with a range from ${formatMetricValue(densityMetric, densityStats.min)} to ${formatMetricValue(densityMetric, densityStats.max)} across ${densityStats.count} filtered sessions.`
              : "No density summary is available for the selected feature."}
          </p>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Box Plot Explorer</h2>
            <Activity size={18} />
          </div>
          <div className="chart-controls">
            <label>
              Metric
              <select value={boxFeature} onChange={(event) => setBoxFeature(event.target.value)}>
                {numericMetricOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Group By
              <select value={boxGroupBy} onChange={(event) => setBoxGroupBy(event.target.value)}>
                {boxGroupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <BoxPlotChart groups={boxGroups} metric={boxMetric} />
          <p className="analytics-note">
            Grouped by {boxGroup.label.toLowerCase()}. Boxes show Q1 to Q3, the center line marks the median, whiskers extend to 1.5x IQR, and dots mark outliers.
          </p>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Parking Duration Distribution</h2>
            <Clock size={18} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={durationBuckets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="sessions" fill="#d9893d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="analytics-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Revenue by Vehicle Type</h2>
            <BadgeIndianRupee size={18} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueByVehicleType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#d9893d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Lot Revenue and Usage</h2>
            <BadgeIndianRupee size={18} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={lotPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#a84f57" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Turnover Rate</h2>
            <TrendingUp size={18} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={turnover}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="turnoverRate" fill="#6b77b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="analytics-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Payment Status</h2>
            <CreditCard size={18} />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={paymentStatus} dataKey="value" nameKey="status" outerRadius={85} label>
                {paymentStatus.map((entry, index) => <Cell key={entry.status} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Vehicle Mix</h2>
            <Car size={18} />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={vehicleMix.map((row) => ({ ...row, label: vehicleLabel(row.type) }))} dataKey="value" nameKey="label" outerRadius={85} label>
                {vehicleMix.map((entry, index) => <Cell key={entry.type} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Parking Lots and Live Slots</h2>
          <CircleParking size={18} />
        </div>
        <div className="lot-grid compact">
          {lots.map((lot) => (
            <article className="lot-card" key={lot._id}>
              <div>
                <h3>{lot.name}</h3>
                <p>{lot.location} | {lot.zone}</p>
              </div>
              <strong>{lot.occupancyRate}%</strong>
              <progress value={lot.occupied} max={lot.capacity} />
              <span>{lot.occupied}/{lot.capacity} occupied | Rs {lot.hourlyRate}/hr</span>
              <SlotGrid lot={lot} readOnly />
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>User Activities</h2>
          <span>{currentFilterLabel}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Lot</th>
                <th>Slot</th>
                <th>Type</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session._id}>
                  <td>{session.vehicleNumber}</td>
                  <td>{session.lot?.name || "Unknown"}</td>
                  <td>{session.slotNumber}</td>
                  <td>{vehicleLabel(session.vehicleType)}</td>
                  <td>{formatDateTime(session.entryTime)}</td>
                  <td>{formatDateTime(session.exitTime)}</td>
                  <td>{session.exitTime ? "Completed" : "Active"}</td>
                  <td>{session.paymentStatus}</td>
                  <td>Rs {session.amountPaid}</td>
                  <td>
                    {!session.exitTime ? (
                      <button className="small-button" onClick={() => onCheckOut(session._id)}>
                        Force Checkout
                      </button>
                    ) : (
                      "Paid"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sessions.length === 0 && <p className="empty">No user activity found for the selected time filter.</p>}
      </section>
    </>
  );
}

function App() {
  const [auth, setAuth] = useState(null);
  const [lots, setLots] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [peakHours, setPeakHours] = useState([]);
  const [lotPerformance, setLotPerformance] = useState([]);
  const [vehicleMix, setVehicleMix] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState([]);
  const [durationBuckets, setDurationBuckets] = useState([]);
  const [revenueByVehicleType, setRevenueByVehicleType] = useState([]);
  const [turnover, setTurnover] = useState([]);
  const [analyticsFilter, setAnalyticsFilter] = useState({ month: "", date: "" });
  const [form, setForm] = useState({
    lotId: "",
    vehicleNumber: "",
    vehicleType: "four_wheeler",
    slotNumber: ""
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const filterParams = analyticsFilter.date
        ? { date: analyticsFilter.date }
        : analyticsFilter.month
          ? { month: analyticsFilter.month }
          : {};
      const sessionParams =
        auth?.role === "user" && auth?.id
          ? { ...filterParams, userId: auth.id }
          : filterParams;
      const [
        lotsData,
        sessionsData,
        summaryData,
          peakData,
          performanceData,
          mixData,
          paymentData,
          durationData,
          revenueTypeData,
        turnoverData
      ] = await Promise.all([
        api.lots(),
        api.sessions(sessionParams),
        api.summary(filterParams),
        api.peakHours(filterParams),
        api.lotPerformance(filterParams),
          api.vehicleMix(filterParams),
          api.paymentStatus(filterParams),
          api.durationBuckets(filterParams),
          api.revenueByVehicleType(filterParams),
          api.turnover(filterParams)
        ]);

      setLots(lotsData);
      setSessions(sessionsData);
      setSummary(summaryData);
      setPeakHours(peakData);
        setLotPerformance(performanceData);
        setVehicleMix(mixData);
        setPaymentStatus(paymentData);
        setDurationBuckets(durationData);
        setRevenueByVehicleType(revenueTypeData);
        setTurnover(turnoverData);
        setForm((current) => ({
          ...current,
          lotId: current.lotId || lotsData[0]?._id || "",
        slotNumber: lotsData.some((lot) => lot._id === current.lotId) ? current.slotNumber : ""
      }));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (auth) loadData();
  }, [auth, analyticsFilter.month, analyticsFilter.date]);

  async function handleCheckIn(event) {
    event.preventDefault();
    try {
      await api.checkIn({ ...form, userId: auth?.role === "user" ? auth.id : undefined });
      setMessage("Slot booked successfully. User activity, slot map, and available count are synced.");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleCheckOut(id) {
    try {
      await api.checkOut(id);
      setForm((current) => ({ ...current, slotNumber: "" }));
      setMessage("Payment completed and vehicle checked out. Slot is available again.");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!auth) return <LoginScreen onLogin={setAuth} />;

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Cloud-Based Smart Parking</p>
          <h1>{auth.role === "admin" ? "Admin Activity Dashboard" : "User Booking Portal"}</h1>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={loadData} title="Refresh dashboard">
            <RefreshCcw size={18} />
          </button>
          <button className="logout-button" onClick={() => setAuth(null)}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      {message && <div className="message">{message}</div>}

      {auth.role === "admin" ? (
        <AdminPortal
          lots={lots}
          sessions={sessions}
          summary={summary}
          peakHours={peakHours}
          lotPerformance={lotPerformance}
            vehicleMix={vehicleMix}
            paymentStatus={paymentStatus}
            durationBuckets={durationBuckets}
            revenueByVehicleType={revenueByVehicleType}
            turnover={turnover}
            analyticsFilter={analyticsFilter}
            setAnalyticsFilter={setAnalyticsFilter}
            loading={loading}
          onCheckOut={handleCheckOut}
        />
        ) : (
          <UserPortal
            auth={auth}
            lots={lots}
            sessions={sessions}
            form={form}
          setForm={setForm}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          loading={loading}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
