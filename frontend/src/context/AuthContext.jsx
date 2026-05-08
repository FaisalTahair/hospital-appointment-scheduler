import { createContext, useContext, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // null = loading, false = logged out, object = logged in
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("meridian_token");
        if (!token) {
            setUser(false);
            setLoading(false);
            return;
        }
        api.get("/auth/me")
            .then((res) => setUser(res.data))
            .catch(() => {
                localStorage.removeItem("meridian_token");
                setUser(false);
            })
            .finally(() => setLoading(false));
    }, []);

    const login = async (email, password) => {
        try {
            const { data } = await api.post("/auth/login", { email, password });
            localStorage.setItem("meridian_token", data.token);
            setUser(data.user);
            return { ok: true };
        } catch (e) {
            return {
                ok: false,
                error: formatApiErrorDetail(e.response?.data?.detail) || e.message,
            };
        }
    };

    const register = async (name, email, password) => {
        try {
            const { data } = await api.post("/auth/register", { name, email, password });
            localStorage.setItem("meridian_token", data.token);
            setUser(data.user);
            return { ok: true };
        } catch (e) {
            return {
                ok: false,
                error: formatApiErrorDetail(e.response?.data?.detail) || e.message,
            };
        }
    };

    const logout = async () => {
        try {
            await api.post("/auth/logout");
        } catch (_) {
            /* ignore */
        }
        localStorage.removeItem("meridian_token");
        setUser(false);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
