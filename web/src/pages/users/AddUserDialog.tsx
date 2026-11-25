import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { usersService } from "@/services/users";
import { plansService } from "@/services/plans";

/** Shape of the error body the API returns on a rejected request. */
type ApiError = { response?: { data?: { error?: string } } };

/**
 * The "Add User" modal.
 *
 * Two steps: fill in the account details, then confirm the email address with
 * the six-digit code sent to it. The account is created the moment the code
 * verifies, so there is no separate submit — that is why handleVerifyOtp ends
 * in createMut.mutate rather than just flipping a flag.
 *
 * All twelve fields live here and are cleared on close, so re-opening never
 * shows the previous attempt.
 */
export function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();

  const [addStep, setAddStep] = useState<"form" | "otp">("form");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFreePlanId, setNewFreePlanId] = useState("");
  const [newFreePlanDays, setNewFreePlanDays] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: plansService.list,
  });
  const plans = plansData ?? [];

  const close = () => {
    onClose();
    setAddStep("form"); setNewName(""); setNewEmail(""); setNewPhone("");
    setNewPassword(""); setNewFreePlanId(""); setNewFreePlanDays("");
    setOtpValue(""); setOtpVerified(false);
  };

  const createMut = useMutation({
    mutationFn: (data: Parameters<typeof usersService.create>[0]) => usersService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      close();
      toast.success("User added successfully.");
    },
    onError: (err: ApiError) => toast.error(err?.response?.data?.error ?? "Failed to add user."),
  });

  const handleSendOtp = async () => {
    if (!newName.trim() || !newPhone.trim() || !newEmail.trim()) { toast.error("Name, phone and email are required."); return; }
    if (newPassword && newPassword.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setOtpSending(true);
    try {
      await usersService.sendOtp(newEmail.trim(), newName.trim());
      setAddStep("otp");
      toast.success(`OTP sent to ${newEmail}.`);
    } catch (err) {
      toast.error((err as ApiError)?.response?.data?.error ?? "Failed to send OTP.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) { toast.error("Enter the 6-digit OTP."); return; }
    setOtpVerifying(true);
    try {
      await usersService.verifyOtp(newEmail.trim(), otpValue.trim());
      setOtpVerified(true);
      // The account is created as soon as the address is proven, so the admin
      // does not have to press anything else.
      createMut.mutate({
        name: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim() || undefined,
        password: newPassword || undefined,
        free_plan_id: newFreePlanId || undefined,
        duration_days: parseInt(newFreePlanDays) || undefined,
      });
    } catch (err) {
      toast.error((err as ApiError)?.response?.data?.error ?? "Invalid OTP.");
    } finally {
      setOtpVerifying(false);
    }
  };

  if (!open) return null;

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40">
        <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-section-title">Add New User</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {addStep === "form" ? "Step 1 of 2 — Fill in details" : "Step 2 of 2 — Verify email"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { close(); }}><X className="h-4 w-4" /></Button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${addStep === "form" ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"}`}>
              {addStep === "otp" ? <CheckCircle2 className="h-3.5 w-3.5" /> : "1"}
            </div>
            <div className={`flex-1 h-px ${addStep === "otp" ? "bg-primary" : "bg-border"}`} />
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${addStep === "otp" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              2
            </div>
          </div>

          {addStep === "form" ? (
            /* ── Step 1: User details ── */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">Full Name *</label>
                  <Input className="mt-1"  value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Phone *</label>
                  <Input className="mt-1" type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Email Address *</label>
                <Input className="mt-1" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Password <span className="text-muted-foreground font-normal">— optional, min 6 chars</span></label>
                <Input className="mt-1" type="password"  value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Free Plan <span className="text-muted-foreground font-normal">— optional</span></label>
                <select className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" value={newFreePlanId} onChange={e => setNewFreePlanId(e.target.value)}>
                  <option value="">— No plan —</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {newFreePlanId && (
                <div>
                  <label className="text-sm font-medium text-foreground">Plan Duration (days) <span className="text-muted-foreground font-normal">— leave blank for plan default</span></label>
                  <Input className="mt-1" type="number" min={1} placeholder="e.g. 30" value={newFreePlanDays} onChange={e => setNewFreePlanDays(e.target.value)} />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => { close(); }}>Cancel</Button>
                <Button onClick={handleSendOtp} disabled={otpSending} className="gap-1.5">
                  <Mail className="h-4 w-4" />
                  {otpSending ? "Sending OTP…" : "Send OTP & Continue"}
                </Button>
              </div>
            </div>
          ) : (
            /* ── Step 2: OTP verification ── */
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 border border-border p-4 flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">OTP sent to</p>
                  <p className="text-sm text-muted-foreground">{newEmail}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Enter 6-digit OTP *</label>
                <Input
                  className="mt-1 text-center tracking-[0.4em] text-lg font-semibold"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otpValue}
                  onChange={e => setOtpValue(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Didn't receive it?{" "}
                <button
                  className="text-primary underline underline-offset-2 hover:no-underline"
                  onClick={() => { setOtpValue(""); handleSendOtp(); }}
                  disabled={otpSending}
                >
                  Resend OTP
                </button>
              </p>
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={() => setAddStep("form")}>← Back</Button>
                <Button onClick={handleVerifyOtp} disabled={otpVerifying || createMut.isPending || otpValue.length !== 6} className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  {otpVerifying || createMut.isPending ? "Verifying…" : "Verify & Create User"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
