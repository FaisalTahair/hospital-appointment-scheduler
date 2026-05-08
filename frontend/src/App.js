import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";

function Protected({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#020617] text-slate-400">
                <div className="font-mono text-xs tracking-[0.3em] uppercase">Authenticating…</div>
            </div>
        );
    }
    if (!user) return <Navigate to="/auth" replace />;
    return children;
}

function AuthOnly({ children }) {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user) return <Navigate to="/" replace />;
    return children;
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/auth"
                        element={
                            <AuthOnly>
                                <AuthPage />
                            </AuthOnly>
                        }
                    />
                    <Route
                        path="/"
                        element={
                            <Protected>
                                <Dashboard />
                            </Protected>
                        }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
            <Toaster theme="dark" position="bottom-right" richColors />
        </AuthProvider>
    );
}

export default App;
