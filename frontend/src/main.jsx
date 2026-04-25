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
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
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

function UserPortal({ lots, sessions, form, setForm, onCheckIn, onCheckOut, loading }) {
  const userSessions = useMemo(() => {
    const vehicle = form.vehicleNumber.trim().toUpperCase();
    if (!vehicle) return [];
    return sessions.filter((session) => session.vehicleNumber === vehicle);
  }, [form.vehicleNumber, sessions]);

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
              <p>Enter your vehicle number and book a slot. Your active booking will appear here for payment and checkout.</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>My Parking History</h2>
          <Activity size={18} />
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
              </tr>
            </thead>
            <tbody>
              {userSessions.map((session) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {userSessions.length === 0 && <p className="empty">No bookings found for this vehicle number.</p>}
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
  dailyTrend,
  turnover,
  analyticsFilter,
  setAnalyticsFilter,
  loading,
  onCheckOut
}) {
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
            <h2>Daily Check-In Trend</h2>
            <Activity size={18} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="checkIns" stroke="#6b77b8" strokeWidth={3} />
            </LineChart>
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
          <h2>All User Activities</h2>
          <Activity size={18} />
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
  const [dailyTrend, setDailyTrend] = useState([]);
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
        dailyData,
        turnoverData
      ] = await Promise.all([
        api.lots(),
        api.sessions(),
        api.summary(filterParams),
        api.peakHours(filterParams),
        api.lotPerformance(filterParams),
        api.vehicleMix(filterParams),
        api.paymentStatus(filterParams),
        api.durationBuckets(filterParams),
        api.revenueByVehicleType(filterParams),
        api.dailyTrend(filterParams),
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
      setDailyTrend(dailyData);
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
      await api.checkIn(form);
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
          dailyTrend={dailyTrend}
          turnover={turnover}
          analyticsFilter={analyticsFilter}
          setAnalyticsFilter={setAnalyticsFilter}
          loading={loading}
          onCheckOut={handleCheckOut}
        />
      ) : (
        <UserPortal
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
