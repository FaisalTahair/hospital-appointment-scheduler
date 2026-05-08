import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Activity, ArrowRight } from "lucide-react";

export default function AuthPage() {
    const { login, register } = useAuth();
    const [tab, setTab] = useState("login");
    const [loading, setLoading] = useState(false);

    // Login state
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    // Register state
    const [regName, setRegName] = useState("");
    const [regEmail, setRegEmail] = useState("");
    const [regPassword, setRegPassword] = useState("");

    const onLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        const r = await login(loginEmail, loginPassword);
        setLoading(false);
        if (!r.ok) toast.error(r.error);
        else toast.success("Welcome back.");
    };

    const onRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        const r = await register(regName, regEmail, regPassword);
        setLoading(false);
        if (!r.ok) toast.error(r.error);
        else toast.success("Account created. Welcome to Meridian.");
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-[#020617] grain relative overflow-hidden">
            {/* LEFT: Brand panel */}
            <div className="relative hidden lg:flex flex-col justify-between p-12 border-r hairline overflow-hidden">
                <div className="absolute inset-0 glow-cobalt" />
                <div
                    className="absolute inset-0 opacity-[0.18]"
                    style={{
                        backgroundImage:
                            "url('https://images.unsplash.com/photo-1771774982253-adcc7715b8f6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG1lZGljYWwlMjBiYWNrZ3JvdW5kJTIwZGFya3xlbnwwfHx8fDE3Nzc3OTE0NjF8MA&ixlib=rb-4.1.0&q=85')",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        filter: "grayscale(0.6) contrast(1.1)",
                    }}
                />
                <div className="absolute inset-0 bg-[#020617]/80" />

                <div className="relative z-10 flex items-center gap-3 fade-up">
                    <div className="w-10 h-10 border border-blue-500/50 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="font-heading text-lg tracking-[0.2em] font-light">
                            MERIDIAN
                        </div>
                        <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-slate-500">
                            Clinical Appointment System
                        </div>
                    </div>
                </div>

                <div className="relative z-10 space-y-6 fade-up delay-200">
                    <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-blue-400">
                        ▍ 001 / Admissions
                    </div>
                    <h1 className="font-heading text-5xl xl:text-6xl font-light leading-[1.05] tracking-tight">
                        Book time with a<br />
                        <span className="text-blue-400">specialist</span>,<br />
                        <span className="italic font-thin">not a queue.</span>
                    </h1>
                    <p className="text-slate-400 text-base max-w-md leading-relaxed">
                        26 attending physicians across 14 specialties. Single-slot
                        reservations, zero overlap, confirmed the moment you click.
                    </p>
                </div>

                <div className="relative z-10 grid grid-cols-3 gap-8 fade-up delay-300">
                    {[
                        { k: "Physicians", v: "26" },
                        { k: "Specialties", v: "14" },
                        { k: "Avg. Response", v: "< 2m" },
                    ].map((s) => (
                        <div key={s.k}>
                            <div className="font-heading text-3xl font-light text-slate-100">
                                {s.v}
                            </div>
                            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-slate-500 mt-1">
                                {s.k}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: Form panel */}
            <div className="relative flex items-center justify-center p-6 sm:p-12 z-10">
                <div className="w-full max-w-md fade-up delay-100">
                    <div className="lg:hidden flex items-center gap-3 mb-10">
                        <div className="w-9 h-9 border border-blue-500/50 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="font-heading text-base tracking-[0.2em] font-light">
                                MERIDIAN
                            </div>
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-blue-400 mb-3">
                            ▍ Access
                        </div>
                        <h2 className="font-heading text-3xl sm:text-4xl font-light tracking-tight">
                            {tab === "login" ? "Sign in to continue." : "Create your file."}
                        </h2>
                        <p className="text-slate-500 text-sm mt-3">
                            {tab === "login"
                                ? "Returning patients, please authenticate."
                                : "New patients start here — no paperwork."}
                        </p>
                    </div>

                    <Tabs value={tab} onValueChange={setTab} className="w-full">
                        <TabsList
                            className="grid grid-cols-2 bg-transparent p-0 h-auto rounded-none border-b border-slate-800 gap-0 mb-8"
                            data-testid="auth-tabs"
                        >
                            <TabsTrigger
                                value="login"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-slate-500 data-[state=active]:text-slate-100 font-mono tracking-[0.2em] uppercase text-[11px] py-3"
                                data-testid="login-tab"
                            >
                                Sign in
                            </TabsTrigger>
                            <TabsTrigger
                                value="register"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-slate-500 data-[state=active]:text-slate-100 font-mono tracking-[0.2em] uppercase text-[11px] py-3"
                                data-testid="register-tab"
                            >
                                Register
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="login" className="mt-0">
                            <form onSubmit={onLogin} className="space-y-5" data-testid="login-form">
                                <Field
                                    label="Email"
                                    id="login-email"
                                    type="email"
                                    value={loginEmail}
                                    onChange={setLoginEmail}
                                    placeholder="you@domain.com"
                                    testid="login-email-input"
                                />
                                <Field
                                    label="Password"
                                    id="login-password"
                                    type="password"
                                    value={loginPassword}
                                    onChange={setLoginPassword}
                                    placeholder="••••••••"
                                    testid="login-password-input"
                                />
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full rounded-sm bg-blue-600 hover:bg-blue-500 text-white font-medium tracking-wide py-6 group transition-all active:scale-[0.98]"
                                    data-testid="login-submit-button"
                                >
                                    {loading ? "Authenticating…" : "Sign in"}
                                    <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="register" className="mt-0">
                            <form
                                onSubmit={onRegister}
                                className="space-y-5"
                                data-testid="register-form"
                            >
                                <Field
                                    label="Full name"
                                    id="reg-name"
                                    value={regName}
                                    onChange={setRegName}
                                    placeholder="Jane Doe"
                                    testid="register-name-input"
                                />
                                <Field
                                    label="Email"
                                    id="reg-email"
                                    type="email"
                                    value={regEmail}
                                    onChange={setRegEmail}
                                    placeholder="you@domain.com"
                                    testid="register-email-input"
                                />
                                <Field
                                    label="Password (min 6)"
                                    id="reg-password"
                                    type="password"
                                    value={regPassword}
                                    onChange={setRegPassword}
                                    placeholder="••••••••"
                                    testid="register-password-input"
                                />
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full rounded-sm bg-blue-600 hover:bg-blue-500 text-white font-medium tracking-wide py-6 group transition-all active:scale-[0.98]"
                                    data-testid="register-submit-button"
                                >
                                    {loading ? "Creating…" : "Create account"}
                                    <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>

                    <div className="mt-10 pt-6 border-t hairline">
                        <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-slate-600">
                            End-to-end encrypted · HIPAA-aligned demo
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, id, type = "text", value, onChange, placeholder, testid }) {
    return (
        <div className="space-y-2">
            <Label
                htmlFor={id}
                className="font-mono text-[10px] tracking-[0.3em] uppercase text-slate-400"
            >
                {label}
            </Label>
            <Input
                id={id}
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                required
                className="bg-slate-950 border-slate-800 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 rounded-sm text-slate-100 placeholder:text-slate-600 py-6"
                data-testid={testid}
            />
        </div>
    );
}
