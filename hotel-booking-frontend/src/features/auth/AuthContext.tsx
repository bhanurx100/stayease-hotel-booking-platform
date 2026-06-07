import React from "react";
import { useQuery } from "react-query";
import { validateToken } from "./services/authApi";

export type AuthContextType = {
  isLoggedIn: boolean;
};

export const AuthContext = React.createContext<AuthContextType | undefined>(
  undefined
);

export const AuthContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const checkStoredAuth = () => {
    const localToken = localStorage.getItem("session_id");
    const userId = localStorage.getItem("user_id");

    const hasToken = !!localToken;
    const hasUserId = !!userId;

    if (hasToken && hasUserId) {
      console.log("JWT authentication detected - token and user ID found");
    }

    return hasToken;
  };

  const { isError, isLoading, data } = useQuery(
    "validateToken",
    validateToken,
    {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      enabled: true,
      onError: (error: any) => {
        const storedToken = localStorage.getItem("session_id");
        const storedUserId = localStorage.getItem("user_id");

        if (storedToken && error.response?.status === 401) {
          console.log(
            "JWT token found but validation failed - possible token expiration"
          );

          if (storedUserId) {
            console.log("JWT session confirmed - using localStorage fallback");
          }
        }
      },
    }
  );

  console.log("Auth Debug:", {
    isLoading,
    isError,
    hasData: !!data,
    hasStoredToken: checkStoredAuth(),
    hasUserId: !!localStorage.getItem("user_id"),
    data,
  });

  const isLoggedIn =
    (!isLoading && !isError && !!data) || (checkStoredAuth() && isError);

  const justLoggedIn = checkStoredAuth() && !isLoading && !data && !isError;

  const isJWTFallback = () => {
    const hasStoredToken = checkStoredAuth();
    const hasUserId = !!localStorage.getItem("user_id");
    const isFallback = hasStoredToken && isError && !data && hasUserId;

    if (isFallback) {
      console.log(
        "JWT fallback mode detected - using localStorage authentication"
      );
    }

    return isFallback;
  };

  const finalIsLoggedIn = isLoggedIn || justLoggedIn || isJWTFallback();

  console.log(
    "Final isLoggedIn:",
    finalIsLoggedIn,
    "JWT Fallback:",
    isJWTFallback()
  );

  return (
    <AuthContext.Provider value={{ isLoggedIn: finalIsLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
};
