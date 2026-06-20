import { Outlet, Navigate } from "react-router-dom";
import useAuth from "./hooks/useAuth";

const ProtectedRoutes = () => {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoutes;
