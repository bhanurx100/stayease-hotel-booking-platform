import { useContext } from "react";
import { AuthContext } from "../AuthContext";
import type { AuthContextType } from "../AuthContext";

const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthContextProvider");
  }
  return context;
};

export default useAuth;
