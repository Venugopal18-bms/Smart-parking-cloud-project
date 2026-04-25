# Cloud Deployment Guide

This guide uses Render for the frontend/backend and MongoDB Atlas for the cloud NoSQL database. You can also use AWS App Runner, ECS, Elastic Beanstalk, or Google Cloud Run with the same Docker images.

## Option A: Render + MongoDB Atlas

### 1. Create MongoDB Atlas Database

1. Go to MongoDB Atlas.
2. Create a free cluster.
3. Create a database user.
4. Allow network access from `0.0.0.0/0` for student/demo deployment.
5. Copy the connection string:

```text
mongodb+srv://USERNAME:PASSWORD@cluster-url/smart_parking
```

### 2. Push Code to GitHub

```bash
git init
git add .
git commit -m "Smart parking cloud project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-parking-cloud.git
git push -u origin main
```

### 3. Deploy Backend on Render

1. Create a new Web Service.
2. Connect the GitHub repository.
3. Root directory: `backend`
4. Build command:

```bash
npm install
```

5. Start command:

```bash
npm start
```

6. Add environment variables:

```text
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster-url/smart_parking
NODE_ENV=production
PORT=5000
```

7. Deploy and verify:

```text
https://YOUR_BACKEND.onrender.com/api/health
```

### 4. Seed Cloud Database

Temporarily set local `.env` in `backend` to the Atlas URI:

```text
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster-url/smart_parking
```

Then run:

```bash
cd backend
npm install
npm run seed
```

### 5. Deploy Frontend on Render

1. Create a new Static Site.
2. Root directory: `frontend`
3. Build command:

```bash
npm install && npm run build
```

4. Publish directory:

```text
dist
```

5. Add environment variable:

```text
VITE_API_URL=https://YOUR_BACKEND.onrender.com/api
```

6. Deploy and open the frontend URL.

## Option B: Docker Deployment on AWS

Recommended services:

- MongoDB Atlas for database.
- AWS App Runner or ECS Fargate for backend container.
- AWS S3 + CloudFront for frontend static hosting.

### Backend Container

1. Build backend image:

```bash
docker build -t smart-parking-backend ./backend
```

2. Push it to Amazon ECR.
3. Create an App Runner service from the ECR image.
4. Add environment variables:

```text
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster-url/smart_parking
NODE_ENV=production
PORT=5000
```

### Frontend Static Hosting

1. Set frontend API URL:

```text
VITE_API_URL=https://YOUR_AWS_BACKEND_URL/api
```

2. Build:

```bash
cd frontend
npm install
npm run build
```

3. Upload `dist` to S3.
4. Enable static website hosting or use CloudFront.

## Deployment Verification Checklist

- Backend health endpoint returns `{ "status": "ok" }`.
- Frontend opens without console API errors.
- Dashboard displays seeded analytics.
- Check-in creates an active session.
- Check-out calculates payment.
- Charts update after refresh.
- MongoDB Atlas contains `parkinglots` and `parkingsessions` collections.
