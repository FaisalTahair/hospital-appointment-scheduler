import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
    Activity,
    LogOut,
    Stethoscope,
    CalendarDays,
    Clock,
    X,
    CheckCircle2,
} from "lucide-react";

const TIME_SLOTS = [
    "09:00-10:00",
    "10:00-11:00",
    "11:00-12:00",
    "12:00-13:00",
    "13:00-14:00",
    "14:00-15:00",
    "15:00-16:00",
    "16:00-17:00",
];

export default function Dashboard() {
    const { user, logout } = useAuth();

    const [doctors, setDoctors] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [bookedSlots, setBookedSlots] = useState([]);

    const [selectedDoctor, setSelectedDoctor] = useState("");
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedSlot, setSelectedSlot] = useState("");

    const [booking, setBooking] = useState(false);

    const doctor = useMemo(
        () => doctors.find((d) => d.id === selectedDoctor),
        [doctors, selectedDoctor]
    );
    const dateStr = useMemo(
        () => (selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""),
        [selectedDate]
    );

    useEffect(() => {
        loadDoctors();
        loadAppointments();
    }, []);

    useEffect(() => {
        if (!selectedDoctor || !dateStr) {
            setBookedSlots([]);
            return;
        }
        api.get(`/appointments/booked`, { params: { doctor_id: selectedDoctor, date: dateStr } })
            .then((res) => setBookedSlots(res.data.booked || []))
            .catch(() => setBookedSlots([]));
    }, [selectedDoctor, dateStr]);

    const loadDoctors = async () => {
        try {
            const { data } = await api.get("/doctors");
            setDoctors(data);
        } catch (e) {
            toast.error("Failed to load doctors");
        }
    };

    const loadAppointments = async () => {
        try {
            const { data } = await api.get("/appointments");
            setAppointments(data);
        } catch (e) {
            // ignore
        }
    };

    const book = async () => {
        if (!selectedDoctor || !dateStr || !selectedSlot) {
            toast.error("Select doctor, date and a time slot.");
            return;
        }
        setBooking(true);
        try {
            await api.post("/appointments", {
                doctor_id: selectedDoctor,
                date: dateStr,
                time_slot: selectedSlot,
            });
            toast.success("Appointment confirmed.");
            setSelectedSlot("");
            await Promise.all([loadAppointments()]);
            // refresh booked slots
            const { data } = await api.get("/appointments/booked", {
                params: { doctor_id: selectedDoctor, date: dateStr },
            });
            setBookedSlots(data.booked || []);
        } catch (e) {
            toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Booking failed");
        } finally {
            setBooking(false);
        }
    };

    const cancel = async (id) => {
        try {
            await api.delete(`/appointments/${id}`);
            toast.success("Appointment cancelled.");
            setAppointments((prev) => prev.filter((a) => a.id !== id));
        } catch (e) {
            toast.error("Could not cancel");
        }
    };

    const specialties = useMemo(() => {
        const set = new Set(doctors.map((d) => d.specialization));
        return Array.from(set).sort();
    }, [doctors]);

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 grain">
            {/* Header */}
            <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-950/70 border-b hairline">
                <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 border border-blue-500/50 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="font-heading text-sm tracking-[0.25em] font-light">
                                MERIDIAN
                            </div>
                            <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-slate-500">
                                Clinical Appointment System
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:block text-right">
                            <div
                                className="text-sm text-slate-100 font-medium"
                                data-testid="welcome-text"
                            >
                                Welcome, {user?.name}
                            </div>
                            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-500">
                                {user?.email}
                            </div>
                        </div>
                        <Button
                            onClick={logout}
                            variant="outline"
                            className="rounded-sm border-slate-800 bg-transparent hover:bg-slate-900 hover:border-blue-500/40 text-slate-300 font-mono text-[11px] tracking-[0.2em] uppercase"
                            data-testid="logout-button"
                        >
                            <LogOut className="w-3.5 h-3.5 mr-2" />
                            Sign out
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1440px] mx-auto px-6 lg:px-10 py-10 lg:py-14 relative z-10">
                {/* Hero */}
                <section className="mb-12 fade-up">
                    <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-blue-400 mb-4">
                        ▍ Dashboard / Book Appointment
                    </div>
                    <div className="grid lg:grid-cols-[1.2fr_auto] gap-8 items-end">
                        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
                            Hello {user?.name?.split(" ")[0] || "there"},<br />
                            <span className="text-slate-500">which specialist do you need</span>
                            <br />
                            <span className="italic font-thin">today?</span>
                        </h1>
                        <div className="flex gap-8 lg:border-l hairline lg:pl-8">
                            <Stat label="Doctors" value={doctors.length} />
                            <Stat label="Specialties" value={specialties.length} />
                            <Stat label="Your bookings" value={appointments.length} />
                        </div>
                    </div>
                </section>

                {/* Booking grid */}
                <section className="grid lg:grid-cols-12 gap-6 mb-16">
                    {/* Doctor */}
                    <div className="lg:col-span-5 bg-slate-900/60 border hairline p-8 rounded-sm fade-up delay-100 hover:border-blue-500/30 transition-colors">
                        <StepLabel num="01" icon={<Stethoscope className="w-3.5 h-3.5" />}>
                            Select Doctor
                        </StepLabel>
                        <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                            <SelectTrigger
                                className="mt-4 rounded-sm bg-slate-950 border-slate-800 focus:ring-blue-500 py-6 text-slate-100"
                                data-testid="doctor-select-trigger"
                            >
                                <SelectValue placeholder="Choose a specialist…" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-950 border-slate-800 rounded-sm max-h-80">
                                {doctors.map((d) => (
                                    <SelectItem
                                        key={d.id}
                                        value={d.id}
                                        className="rounded-none focus:bg-blue-600/20 focus:text-slate-100"
                                        data-testid={`doctor-option-${d.id}`}
                                    >
                                        <div className="flex flex-col py-0.5">
                                            <span className="text-slate-100">{d.name}</span>
                                            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-500">
                                                {d.specialization} · {d.years_experience}y
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {doctor && (
                            <div className="mt-6 pt-6 border-t hairline space-y-3">
                                <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-blue-400">
                                    {doctor.specialization}
                                </div>
                                <div className="font-heading text-xl font-light text-slate-100">
                                    {doctor.name}
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed">{doctor.bio}</p>
                                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-500">
                                    {doctor.years_experience} years experience
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Date */}
                    <div className="lg:col-span-4 bg-slate-900/60 border hairline p-8 rounded-sm fade-up delay-200 hover:border-blue-500/30 transition-colors">
                        <StepLabel num="02" icon={<CalendarDays className="w-3.5 h-3.5" />}>
                            Select Date
                        </StepLabel>
                        <div className="mt-4 flex justify-center">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                disabled={(d) => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    return d < today;
                                }}
                                className="rounded-sm bg-slate-950 border border-slate-800 p-3"
                                data-testid="appointment-calendar"
                            />
                        </div>
                    </div>

                    {/* Slots + Book */}
                    <div className="lg:col-span-3 bg-slate-900/60 border hairline p-8 rounded-sm fade-up delay-300 hover:border-blue-500/30 transition-colors flex flex-col">
                        <StepLabel num="03" icon={<Clock className="w-3.5 h-3.5" />}>
                            Time Slot
                        </StepLabel>
                        <div
                            className="mt-4 grid grid-cols-1 gap-2"
                            data-testid="time-slot-grid"
                        >
                            {TIME_SLOTS.map((slot) => {
                                const taken = bookedSlots.includes(slot);
                                const selected = selectedSlot === slot;
                                return (
                                    <button
                                        key={slot}
                                        type="button"
                                        disabled={taken}
                                        onClick={() => setSelectedSlot(slot)}
                                        className={[
                                            "rounded-sm text-left px-4 py-3 border font-mono text-xs tracking-[0.15em] transition-all",
                                            taken
                                                ? "bg-slate-950 border-slate-900 text-slate-700 line-through cursor-not-allowed"
                                                : selected
                                                  ? "bg-blue-600 border-blue-500 text-white"
                                                  : "bg-slate-950 border-slate-800 text-slate-300 hover:border-blue-500/50 hover:text-slate-100",
                                        ].join(" ")}
                                        data-testid={`time-slot-${slot}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>{slot}</span>
                                            {taken && <span className="text-[9px]">BOOKED</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <Button
                            onClick={book}
                            disabled={booking || !selectedDoctor || !selectedSlot}
                            className="mt-6 rounded-sm bg-blue-600 hover:bg-blue-500 text-white font-medium py-6 tracking-wide group transition-all active:scale-[0.98] disabled:opacity-40"
                            data-testid="book-appointment-submit"
                        >
                            {booking ? "Confirming…" : "Confirm Appointment"}
                        </Button>
                    </div>
                </section>

                {/* Appointments */}
                <section className="fade-up delay-400">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-blue-400 mb-2">
                                ▍ Your Schedule
                            </div>
                            <h2 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">
                                Upcoming visits
                            </h2>
                        </div>
                        <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-slate-500">
                            {appointments.length} record{appointments.length === 1 ? "" : "s"}
                        </div>
                    </div>

                    {appointments.length === 0 ? (
                        <div className="border hairline p-12 rounded-sm text-center">
                            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-slate-500">
                                No appointments yet.
                            </div>
                            <div className="text-slate-600 text-sm mt-2">
                                Book one above — takes about 10 seconds.
                            </div>
                        </div>
                    ) : (
                        <div
                            className="grid md:grid-cols-2 xl:grid-cols-3 gap-4"
                            data-testid="appointments-list"
                        >
                            {appointments.map((a) => (
                                <div
                                    key={a.id}
                                    className="border hairline rounded-sm p-6 bg-slate-900/40 hover:border-blue-500/40 transition-colors group"
                                    data-testid={`appointment-card-${a.id}`}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-blue-400" />
                                            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-blue-400">
                                                Confirmed
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => cancel(a.id)}
                                            className="text-slate-600 hover:text-red-400 transition-colors"
                                            title="Cancel"
                                            data-testid={`cancel-appointment-${a.id}`}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="font-heading text-lg font-light text-slate-100">
                                        {a.doctor_name}
                                    </div>
                                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-500 mt-1">
                                        {a.doctor_specialization}
                                    </div>
                                    <div className="mt-5 pt-5 border-t hairline flex items-center justify-between">
                                        <div>
                                            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-500">
                                                Date
                                            </div>
                                            <div className="text-sm text-slate-200 mt-1">
                                                {format(new Date(a.date), "MMM dd, yyyy")}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-500">
                                                Slot
                                            </div>
                                            <div className="font-mono text-sm text-blue-400 mt-1">
                                                {a.time_slot}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            <footer className="border-t hairline mt-20">
                <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-6 flex items-center justify-between">
                    <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-slate-600">
                        © Meridian Health · Demo build
                    </div>
                    <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-slate-600">
                        Secure · Encrypted
                    </div>
                </div>
            </footer>
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div>
            <div className="font-heading text-3xl font-light text-slate-100">{value}</div>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-slate-500 mt-1">
                {label}
            </div>
        </div>
    );
}

function StepLabel({ num, icon, children }) {
    return (
        <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.3em] text-blue-400">{num}</span>
            <span className="h-px flex-1 bg-slate-800" />
            <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] uppercase text-slate-300">
                {icon}
                {children}
            </span>
        </div>
    );
}
