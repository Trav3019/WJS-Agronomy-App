# WJS Agronomy App

## Run Locally

1. Install dependencies:
   `npm install`
2. Start the auth API (new terminal):
   `npm run dev:api`
3. Start the Vite app:
   `npm run dev -- --host localhost --port 5175 --strictPort`

The app will be available at `http://localhost:5175`.

## Auth API Configuration

Copy `.env.api.example` values into your `.env.local` (or environment) and set secure values:

- `AUTH_API_PORT` (default `8787`)
- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `AUTH_JWT_SECRET`

## Auth Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
