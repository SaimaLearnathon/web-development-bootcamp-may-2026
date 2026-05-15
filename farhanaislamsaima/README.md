# Chat App

This is a simple MERN chat app. It uses React for the frontend, Express and Socket.IO for the backend, and MongoDB for users and messages.

## Folders

- `client` - React app with Tailwind CSS and DaisyUI
- `server` - Express API and socket server

## Run the project

Install dependencies first:

```bash
npm install
```

Then start the app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

MongoDB should be running locally at:

```text
mongodb://127.0.0.1:27017/chatdb
```

## Run with Docker

Start MongoDB, the backend, and the frontend:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:5173
```

Stop the containers:

```bash
docker compose down
```

## API

- `POST /api/auth/register` - create a user
- `POST /api/auth/login` - login with email and password
- `GET /api/messages` - get old messages
