# AAT Report: Cloud-Based Smart Parking Management and Analytics System

## 1. Title

Cloud-Based Smart Parking Management and Analytics System

## 2. Problem Statement

Urban parking areas often suffer from poor slot visibility, long search time, inefficient manual monitoring, revenue leakage, and lack of data-driven decision-making. This project implements a cloud-based smart parking system that manages parking lots, vehicle check-in/check-out, payment calculation, and analytics using a frontend application, backend APIs, and a NoSQL database.

## 3. Objectives

- Build a working cloud-ready smart parking management system.
- Use a NoSQL backend for flexible parking and session data.
- Provide real-time availability and occupancy status.
- Perform analytics on occupancy, revenue, peak hours, lot performance, violations, and vehicle mix.
- Dockerize the application.
- Provide steps to deploy the application to cloud.

## 4. Technologies Used

- React and Vite for frontend.
- Node.js and Express.js for backend.
- MongoDB for NoSQL database.
- Mongoose for object modeling.
- Recharts for data visualization.
- Docker and Docker Compose for containerization.
- Render/MongoDB Atlas or AWS for cloud deployment.

## 5. System Architecture

The admin accesses a React dashboard. The dashboard calls Express REST APIs. The backend stores and analyzes data in MongoDB. Analytics APIs use MongoDB aggregation to calculate useful metrics. Docker containers package frontend, backend, and database services.

## 6. Modules

### Parking Lot Management

Stores lot name, location, zone, capacity, hourly rate, and sensor health.

### Parking Session Management

Stores vehicle number, type, entry time, exit time, payment status, amount paid, and violation flag.

### Check-In Module

Validates availability and creates an active parking session.

### Check-Out Module

Calculates duration, computes fee, marks payment status, and closes the session.

### Analytics Module

Displays occupancy rate, revenue, available slots, active vehicles, sensor health, peak hour demand, lot revenue, vehicle mix, and violation count.

## 7. Data Analytics

The project performs:

- Occupancy analytics to identify live demand.
- Revenue analytics to compare income across parking lots.
- Peak hour analytics to find high-demand periods.
- Lot performance analytics to compare sessions, revenue, violations, and average duration.
- Vehicle mix analytics to plan EV, bike, car, and accessible parking areas.

## 8. Cloud and Docker

The application includes Dockerfiles for frontend and backend plus a Docker Compose file. For cloud hosting, MongoDB Atlas is used as the managed NoSQL database. The backend can be deployed to Render, AWS App Runner, or ECS. The frontend can be deployed as a Render Static Site, S3/CloudFront, Netlify, or Vercel.

## 9. Results

The implemented system provides a working dashboard where administrators can:

- View available and occupied slots.
- Check in vehicles.
- Check out vehicles and calculate payment.
- Monitor parking revenue.
- Analyze busiest hours.
- Compare lot performance.
- View vehicle category distribution.

## 10. Rubric Mapping

| Rubric Criterion | Project Evidence |
| --- | --- |
| Problem statement selection | Smart parking is complex and has strong analytics potential. |
| Report | This report and implementation/deployment documentation are included. |
| Execution and implementation | Full frontend, backend, MongoDB database, analytics APIs, Docker setup, and cloud deployment guide are included. |

## 11. Conclusion

The Cloud-Based Smart Parking Management and Analytics System successfully demonstrates a data-driven cloud application using a frontend, NoSQL backend, Dockerization, and analytics. It meets the AAT requirement of building a working data analysis application and preparing it for cloud deployment.
