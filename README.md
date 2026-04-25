# Cloud-Based Smart Parking Management and Analytics System

This project is a complete full-stack implementation for the Cloud Computing AAT problem statement:

> Create an application for data analysis using a frontend tool and NoSQL database as backend, Dockerize it, and host it on a chosen cloud.

## Features

- Live parking lot dashboard with availability and occupancy rate.
- Vehicle check-in and check-out workflow.
- Automated parking fee calculation.
- MongoDB NoSQL backend with parking lots and parking sessions.
- Analytics for total capacity, active sessions, revenue, violations, sensor health, peak hours, lot performance, and vehicle mix.
- Dockerized frontend, backend, and MongoDB services.
- Cloud deployment guide for Render plus MongoDB Atlas, and AWS notes.

## Tech Stack

- Frontend: React, Vite, Recharts, Lucide icons.
- Backend: Node.js, Express.js, Mongoose.
- Database: MongoDB NoSQL.
- Containerization: Docker and Docker Compose.
- Cloud-ready deployment: Render, MongoDB Atlas, or AWS App Runner/ECS.

## Folder Structure

```text
smart-parking-cloud/
  backend/
    src/
      models/
      routes/
      seed/
      db.js
      server.js
  frontend/
    src/
      api.js
      main.jsx
      styles.css
  docs/
    ANALYTICS.md
    DEPLOYMENT.md
    IMPLEMENTATION_STEPS.md
    REPORT.md
  docker-compose.yml
```

## Local Implementation Steps

1. Install Node.js 22+, Docker Desktop, and Git.
2. Open a terminal in this folder.
3. Install dependencies:

```bash
npm run install:all
```

4. Start MongoDB with Docker:

```bash
docker compose up mongo
```

5. In a new terminal, seed sample data:

```bash
cd backend
copy ..\.env.example .env
npm run seed
```

6. Start the backend:

```bash
npm run dev
```

7. In another terminal, start the frontend:

```bash
cd ../frontend
npm run dev
```

8. Open the frontend URL shown by Vite, usually `http://localhost:5173`.

## Login and Registration

The website has two separate portals:

- User portal: register a new user account, then log in with that account.
- Admin portal: log in with the configured admin account.

User portal features:

- User registration.
- Book parking slot.
- Select a specific free slot from a pictorial slot map.
- Select vehicle type: Two Wheeler, Three Wheeler, or Four Wheeler.
- Only slots reserved for that vehicle type can be selected.
- View selected parking place and reduced hourly price.
- Pay and check out active booking.
- View personal parking history by vehicle number.

Admin portal features:

- View all user activities.
- View the same live slot map with occupied/free slots.
- Monitor active and completed sessions.
- Force checkout active sessions.
- View analytics, revenue, occupancy, vehicle mix, lot utilization, payment status, duration distribution, revenue by vehicle type, daily trend, and turnover rate.
- Filter analytics by full month or by a selected date inside that month.
- View check-in and check-out date/time in user history and admin activities.
- Compare current-hour demand with historical check-in hour demand.

## Data Persistence

MongoDB data is stored in the Docker volume `mongo_data`. If you check out all vehicles and stop the project, the next run keeps that updated state.

Use this for normal runs:

```bash
docker compose up --build
```

Only run the seed command when you intentionally want to reset the database back to sample data.

## Reduced Parking Rates

The seeded hourly rates were reduced:

- Metro Gate A: Rs 20/hr
- Tech Park East: Rs 25/hr
- Airport Express: Rs 30/hr
- Mall Basement: Rs 22/hr
- Hospital Block: Rs 15/hr

If you intentionally want fresh sample lots and sessions, reseed MongoDB:

```bash
docker compose exec backend node src/seed/seed.js
```

## One-Command Docker Run

From the project root:

```bash
docker compose up --build
```

Then open:

- Frontend: `http://localhost:8080`
- Backend health check: `http://localhost:5000/api/health`

Seed data after containers are running:

```bash
docker compose exec backend node src/seed/seed.js
```

## API Endpoints

- `GET /api/health`
- `GET /api/lots`
- `POST /api/lots`
- `GET /api/sessions`
- `POST /api/sessions/check-in`
- `POST /api/sessions/:id/check-out`
- `GET /api/analytics/summary`
- `GET /api/analytics/peak-hours`
- `GET /api/analytics/lot-performance`
- `GET /api/analytics/vehicle-mix`
- `GET /api/analytics/vehicle-type-utilization`
- `GET /api/analytics/revenue-by-vehicle-type`
- `GET /api/analytics/daily-trend`
- `GET /api/analytics/turnover`

## AAT Rubric Alignment

- Problem statement selection: Smart parking has strong data analytics potential because it produces occupancy, revenue, peak demand, slot availability, violation, vehicle category, and sensor health data.
- Report: A ready-to-submit report draft is included in `docs/REPORT.md`.
- Execution and implementation: The project includes frontend, backend, NoSQL database models, analytics APIs, Dockerfiles, Docker Compose, seed data, and cloud deployment steps.
"# Smart-parking-cloud-project" 
