import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, addDays, isBefore, startOfDay, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, CheckCircle2, Loader2, User, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Step = "date" | "time" | "confirm" | "success";

export default function Agenda() {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get("lead_id") || "";

  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form fields for when no lead_id
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  // Generate next 14 available weekdays
  const availableDates = (() => {
    const dates: string[] = [];
    let day = startOfDay(new Date());
    // Start from tomorrow
    day = addDays(day, 1);
    while (dates.length < 14) {
      if (!isWeekend(day)) {
        dates.push(format(day, "yyyy-MM-dd"));
      }
      day = addDays(day, 1);
    }
    return dates;
  })();

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setAvailableSlots([]);
    setError(null);

    fetch(`${SUPABASE_URL}/functions/v1/calendar-availability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ date: selectedDate }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setAvailableSlots(data.available_slots || []);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate]);

  const handleBook = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    setError(null);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/calendar-book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          lead_id: leadId,
          slot_start: selectedSlot,
          nome,
          email,
          telefone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMeetingLink(data.meeting_link);
        setStep("success");
      } else {
        setError(data.error || "Erro ao agendar. Tente novamente.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBooking(false);
    }
  };

  const formatSlotTime = (slot: string) => {
    const d = new Date(slot);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const formatDateLabel = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return format(date, "EEE, dd 'de' MMM", { locale: ptBR });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-500/20">
            <CalendarDays className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Diagnóstico Comercial</h1>
          <p className="text-slate-400 text-sm">Aceleradora MX3 — Fábio Furtado</p>
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>45 minutos • Online</span>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-6 shadow-2xl">
          {/* Step: Date */}
          {step === "date" && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Selecione uma data</h2>
              <div className="grid grid-cols-2 gap-2">
                {availableDates.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setSelectedDate(d);
                      setSelectedSlot(null);
                      setStep("time");
                    }}
                    className="text-left px-4 py-3 rounded-xl border border-slate-700/50 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-sm text-slate-200 capitalize"
                  >
                    {formatDateLabel(d)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Time */}
          {step === "time" && selectedDate && (
            <div className="space-y-4">
              <button onClick={() => setStep("date")} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                ← Voltar
              </button>
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">
                Horários — <span className="capitalize text-white">{formatDateLabel(selectedDate)}</span>
              </h2>

              {loadingSlots && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
              )}

              {!loadingSlots && availableSlots.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-6">Nenhum horário disponível neste dia.</p>
              )}

              {!loadingSlots && availableSlots.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setStep("confirm");
                      }}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        selectedSlot === slot
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-slate-700/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                      }`}
                    >
                      {formatSlotTime(slot)}
                    </button>
                  ))}
                </div>
              )}

              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
          )}

          {/* Step: Confirm */}
          {step === "confirm" && selectedSlot && selectedDate && (
            <div className="space-y-5">
              <button onClick={() => setStep("time")} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                ← Voltar
              </button>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Sua reunião</p>
                <p className="text-white font-semibold capitalize">{formatDateLabel(selectedDate)}</p>
                <p className="text-emerald-400 font-medium">
                  {formatSlotTime(selectedSlot)} — {(() => {
                    const d = new Date(selectedSlot);
                    d.setMinutes(d.getMinutes() + 45);
                    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                  })()}
                </p>
              </div>

              {!leadId && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-400 text-xs">Nome</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="pl-9 bg-slate-800/50 border-slate-700 text-white" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" type="email" className="pl-9 bg-slate-800/50 border-slate-700 text-white" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" className="pl-9 bg-slate-800/50 border-slate-700 text-white" />
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleBook}
                disabled={booking}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-6 rounded-xl shadow-lg shadow-emerald-500/20"
              >
                {booking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirmar Agendamento
              </Button>

              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            </div>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Agendado com sucesso!</h2>
              <p className="text-slate-400 text-sm">
                Sua reunião de diagnóstico foi confirmada para{" "}
                <span className="text-white capitalize">{selectedDate && formatDateLabel(selectedDate)}</span>{" "}
                às <span className="text-emerald-400 font-medium">{selectedSlot && formatSlotTime(selectedSlot)}</span>.
              </p>
              {meetingLink && (
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                >
                  Acessar link da reunião
                </a>
              )}
              <p className="text-xs text-slate-500 mt-4">Você receberá uma confirmação por email.</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Aceleradora MX3 © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
