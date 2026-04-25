# Data Analytics Plan

## Data Collected

The application collects the following data:

- Parking lot name, location, zone, capacity, hourly rate, and sensor health.
- Vehicle number, vehicle type, entry time, exit time, payment status, amount paid, and violation status.

## Analytics Performed

### 1. Occupancy Analytics

Formula:

```text
occupancy rate = active sessions / total capacity * 100
```

Use:

- Helps admins understand current parking pressure.
- Helps users identify slot availability.

### 2. Revenue Analytics

Formula:

```text
revenue = sum(amountPaid)
```

Use:

- Identifies high-revenue lots.
- Supports pricing decisions.

### 3. Peak Hour Analytics

MongoDB groups parking sessions by entry hour.

Use:

- Finds busiest hours.
- Helps plan staff allocation and dynamic pricing.

### 4. Lot Performance Analytics

Metrics:

- Sessions per lot.
- Revenue per lot.
- Average parking duration.
- Violations per lot.

Use:

- Compares different parking locations.
- Finds underused and overloaded lots.

### 5. Vehicle Mix Analytics

Groups sessions by vehicle type:

- car
- bike
- ev
- accessible

Use:

- Supports EV bay planning.
- Helps allocate two-wheeler and accessible parking spaces.

### 6. Violation Analytics

Tracks sessions that exceed allowed duration or have abnormal payment behavior.

Use:

- Supports enforcement.
- Reduces revenue leakage.

## MongoDB Aggregation Examples

Peak hour grouping:

```js
ParkingSession.aggregate([
  {
    $group: {
      _id: { $hour: "$entryTime" },
      checkIns: { $sum: 1 },
      revenue: { $sum: "$amountPaid" }
    }
  },
  { $sort: { _id: 1 } }
]);
```

Lot performance grouping:

```js
ParkingSession.aggregate([
  {
    $group: {
      _id: "$lot",
      sessions: { $sum: 1 },
      revenue: { $sum: "$amountPaid" },
      violations: { $sum: { $cond: ["$isViolation", 1, 0] } }
    }
  }
]);
```

## Possible Extensions

- Predict next-hour occupancy with machine learning.
- Add IoT sensor event ingestion.
- Add dynamic pricing during peak hours.
- Add user mobile booking.
- Add admin authentication and role-based access.
