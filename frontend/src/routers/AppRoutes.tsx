import { Navigate, Route, Routes } from "react-router-dom";
import { Class } from "../pages/Class";
import { Dashboard } from "../pages/Dashboard";
import { Login } from "../pages/Login";
import ProtectedRoute from "./ProtectedRoute";


const AppRoutes: React.FC = () => {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/class/:id"
          element={
            <ProtectedRoute>
              <Class />
            </ProtectedRoute>
          }
        />
      </Routes>
    );
  };

  export default AppRoutes;