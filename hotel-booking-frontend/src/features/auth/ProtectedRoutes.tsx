import { Route } from "react-router-dom";
import Layout from "../../layouts/Layout";
import AddHotel from "../../pages/AddHotel";
import EditHotel from "../../pages/EditHotel";
import useAuth from "./hooks/useAuth";

const ProtectedRoutes = () => {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) return null;

  return (
    <>
      <Route
        path="/add-hotel"
        element={
          <Layout>
            <AddHotel />
          </Layout>
        }
      />
      <Route
        path="/edit-hotel/:hotelId"
        element={
          <Layout>
            <EditHotel />
          </Layout>
        }
      />
    </>
  );
};

export default ProtectedRoutes;
