# LoanFlow CRM

## Project Overview

LoanFlow CRM is a full-stack Loan Management Customer Relationship Management (CRM) web application developed using the MERN stack.

The application provides separate Admin and Staff portals with role-based access control to manage loan-related operations efficiently. It also includes a responsive, mobile-style Admin Portal accessible through a separate URL.

## Tech Stack

### Frontend
- JavaScript
- React.js
- Vite
- CSS3
- React Router DOM

### Backend
- JavaScript (Node.js)
- Express.js
- REST APIs

### Database
- MongoDB
- Mongoose

### Authentication & Security
- JSON Web Tokens (JWT)
- bcrypt Password Hashing
- Role-Based Access Control
- Protected Routes
- Environment Variables

## Local Setup

### Prerequisites
- Node.js and npm
- MongoDB

### Backend Setup

```bash
cd backend
npm install
```

Configure the required environment variables in `backend/.env` and start the backend using the script defined in `backend/package.json`.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```