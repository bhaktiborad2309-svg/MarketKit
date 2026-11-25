import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, MoreHorizontal, X, Copy, UserX, Eye, UserCheck, ShieldOff, CreditCard, Gift, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { usersService } from "@/services/users";
import { plansService } from "@/services/plans";
import { AddUserDialog } from "./users/AddUserDialog";
import type { User } from "@/services/users";
import { activePlan, isFreePlan, activeExpiry, formatDate, plural, walletTxLabel } from "./users/planDisplay";
import { walletService, type WalletTransaction } from "@/services/wallet";
import { formatMoney } from "@/lib/currency";
import { TableFooterPagination } from "@/components/TableFooterPagination";

interface Plan {
  id: string;
  name: string;
  is_active: boolean;
}

const statusVariant = (s: string) =>
  s === "ACTIVE" ? "success" as const : s === "SUSPENDED" ? "danger" as const : "warning" as const;

const statusLabel = (s: string) =>
  s === "ACTIVE" ? "Active" : s === "SUSPENDED" ? "Suspended" : "Expired";

const appModeLabel = (u: User) =>
  u.current_app_mode === "market" ? "Product Market" : u.current_app_mode === "learning" ? "Learning" : "Not chosen";

const appModeVariant = (u: User) =>
  u.current_app_mode === "market" ? "brand" as const : u.current_app_mode === "learning" ? "success" as const : "neutral" as const;

export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appModeFilter, setAppModeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [drawerUser, setDrawerUser] = useState<User | null>(null);
  const [walletTxPage, setWalletTxPage] = useState(1);

  useEffect(() => {
    setWalletTxPage(1);
  }, [drawerUser?.id]);

  // ── Add User multi-step ───────────────────────────────────────────────────
  const [showAddUser, setShowAddUser] = useState(false);

  // ── Change Plan ───────────────────────────────────────────────────────────
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  // ── Free Plan (single user) ───────────────────────────────────────────────
  const [showFreePlan, setShowFreePlan] = useState(false);
  const [freePlanId, setFreePlanId] = useState("");
  const [freePlanDays, setFreePlanDays] = useState("");

  // ── Bulk ──────────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkChangePlan, setBulkChangePlan] = useState(false);
  const [bulkPlanId, setBulkPlanId] = useState("");
  const [bulkFreePlan, setBulkFreePlan] = useState(false);
  const [bulkFreePlanId, setBulkFreePlanId] = useState("");
  const [bulkFreePlanDays, setBulkFreePlanDays] = useState("");
  const [bulkPending, setBulkPending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["users", page, search, statusFilter, appModeFilter],
    queryFn: () => usersService.list({ page, limit: 10, search: search || undefined, status: statusFilter || undefined, app_mode: appModeFilter || undefined }),
  });

  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: plansService.list,
  });

  const { data: walletTxData, isLoading: walletTxLoading } = useQuery({
    queryKey: ["user-wallet-txs", drawerUser?.id, walletTxPage],
    queryFn: () => walletService.listUserTransactions(drawerUser!.id, { page: walletTxPage, limit: 10 }),
    enabled: !!drawerUser?.id,
  });

  const users: User[] = data?.data ?? [];
  const meta = data?.meta;
  const plans: Plan[] = (plansData ?? []).filter((p: Plan) => p.is_active);
  const walletTxs: WalletTransaction[] = walletTxData?.data ?? [];
  const walletTxMeta = walletTxData?.meta;

  // Select-all helpers (current page only)
  const allSelected = users.length > 0 && users.every(u => selected.has(u.id));
  const someSelected = users.some(u => selected.has(u.id));

  const toggleOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(users.map(u => u.id)));
  };

  const clearSelection = () => setSelected(new Set());

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const handleBulkSuspend = async () => {
    setBulkPending(true);
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => usersService.update(id, { status: "SUSPENDED" })));
      qc.invalidateQueries({ queryKey: ["users"] });
      clearSelection();
      toast.success(`${plural(ids.length, "user")} suspended.`);
    } catch { toast.error("Some updates failed."); }
    finally { setBulkPending(false); }
  };

  const handleBulkReactivate = async () => {
    setBulkPending(true);
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => usersService.update(id, { status: "ACTIVE" })));
      qc.invalidateQueries({ queryKey: ["users"] });
      clearSelection();
      toast.success(`${plural(ids.length, "user")} reactivated.`);
    } catch { toast.error("Some updates failed."); }
    finally { setBulkPending(false); }
  };

  const handleBulkChangePlan = async () => {
    if (!bulkPlanId) { toast.error("Select a plan."); return; }
    setBulkPending(true);
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => usersService.changePlan(id, bulkPlanId)));
      qc.invalidateQueries({ queryKey: ["users"] });
      clearSelection(); setBulkChangePlan(false); setBulkPlanId("");
      toast.success(`Plan updated for ${plural(ids.length, "user")}.`);
    } catch { toast.error("Some plan updates failed."); }
    finally { setBulkPending(false); }
  };

  const handleBulkAssignFreePlan = async () => {
    if (!bulkFreePlanId) { toast.error("Select a plan."); return; }
    setBulkPending(true);
    const ids = [...selected];
    const days = parseInt(bulkFreePlanDays) || undefined;
    try {
      await Promise.all(ids.map(id => usersService.assignFreePlan(id, bulkFreePlanId, days)));
      qc.invalidateQueries({ queryKey: ["users"] });
      clearSelection(); setBulkFreePlan(false); setBulkFreePlanId(""); setBulkFreePlanDays("");
      toast.success(`Free plan assigned to ${plural(ids.length, "user")}.`);
    } catch { toast.error("Some free plan assignments failed."); }
    finally { setBulkPending(false); }
  };

  // ── Single-user mutations ─────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: ({ id, data, name: _ }: { id: string; data: { status?: string }; name?: string }) => usersService.update(id, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["users", drawerUser?.id] });
      if (variables.data.status === "SUSPENDED") toast.success(`${variables.name ?? "User"} suspended.`);
      else if (variables.data.status === "ACTIVE") toast.success(`${variables.name ?? "User"} reactivated.`);
    },
    onError: () => toast.error("Failed to update user."),
  });

  const forceLogoutMut = useMutation({
    mutationFn: (id: string) => usersService.forceLogout(id),
    onSuccess: () => { toast.success("Session terminated."); qc.invalidateQueries({ queryKey: ["sessions"] }); },
    onError: () => toast.error("Failed to terminate session."),
  });

  const assignFreePlanMut = useMutation({
    mutationFn: ({ id, planId, days }: { id: string; planId: string; days?: number }) =>
      usersService.assignFreePlan(id, planId, days),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowFreePlan(false); setDrawerUser(null);
      toast.success("Free plan assigned.");
    },
    onError: () => toast.error("Failed to assign free plan."),
  });

  const cancelFreePlanMut = useMutation({
    mutationFn: (id: string) => usersService.cancelFreePlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setDrawerUser(null);
      toast.success("Free plan cancelled.");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? "Failed to cancel free plan."),
  });

  const deleteUserMut = useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["users", drawerUser?.id] });
      setDrawerUser(null);
      toast.success("User account deleted.");
    },
    onError: () => toast.error("Failed to delete user."),
  });

  const changePlanMut = useMutation({
    mutationFn: ({ id, planId }: { id: string; planId: string }) => usersService.changePlan(id, planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowChangePlan(false); setDrawerUser(null);
      toast.success("Plan updated.");
    },
    onError: () => toast.error("Failed to change plan."),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleToggleStatus = (u: User) => {
    const newStatus = u.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    updateMut.mutate({ id: u.id, data: { status: newStatus }, name: u.name });
    if (drawerUser?.id === u.id) setDrawerUser({ ...drawerUser, status: newStatus as User["status"] });
  };

  const handleChangePlan = () => {
    if (!drawerUser || !selectedPlanId) { toast.error("Select a plan."); return; }
    changePlanMut.mutate({ id: drawerUser.id, planId: selectedPlanId });
  };

  const handleAssignFreePlan = () => {
    if (!drawerUser || !freePlanId) { toast.error("Select a plan."); return; }
    const days = parseInt(freePlanDays) || undefined;
    assignFreePlanMut.mutate({ id: drawerUser.id, planId: freePlanId, days });
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email).then(() => toast.success("Email copied."));
  };

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage all user accounts">
        <Button onClick={() => setShowAddUser(true)}><Plus className="h-4 w-4" /> Add User</Button>
      </PageHeader>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); clearSelection(); }}
            className="pl-9 bg-muted border-0"
          />
        </div>
        <select
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); clearSelection(); }}
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <select
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          value={appModeFilter}
          onChange={e => { setAppModeFilter(e.target.value); setPage(1); clearSelection(); }}
        >
          <option value="">All App Modes</option>
          <option value="learning">Learning</option>
          <option value="market">Product Market</option>
        </select>
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-sm font-semibold text-foreground">{plural(selected.size, "user")} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="gap-1.5" disabled={bulkPending} onClick={handleBulkSuspend}>
            <ShieldOff className="h-3.5 w-3.5" /> Suspend
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={bulkPending} onClick={handleBulkReactivate}>
            <UserCheck className="h-3.5 w-3.5" /> Reactivate
          </Button>
          <Button size="sm" className="gap-1.5" disabled={bulkPending} onClick={() => { setBulkPlanId(""); setBulkChangePlan(true); }}>
            <CreditCard className="h-3.5 w-3.5" /> Change Plan
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={bulkPending} onClick={() => { setBulkFreePlanId(""); setBulkFreePlanDays(""); setBulkFreePlan(true); }}>
            <Gift className="h-3.5 w-3.5" /> Free Plan
          </Button>
          <button className="ml-1 p-1 rounded text-muted-foreground hover:text-foreground transition-colors" onClick={clearSelection} title="Clear selection">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-table-header">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={users.length === 0}
                  className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                  title={allSelected ? "Deselect all" : "Select all on this page"}
                  style={{ opacity: someSelected && !allSelected ? 0.6 : 1 }}
                />
              </th>
              <th className="text-table-header text-left px-4 py-3">User</th>
              <th className="text-table-header text-left px-4 py-3 hidden md:table-cell">Phone</th>
              <th className="text-table-header text-left px-4 py-3 hidden md:table-cell">Plan</th>
              <th className="text-table-header text-left px-4 py-3 hidden md:table-cell">App Mode</th>
              <th className="text-table-header text-left px-4 py-3">Status</th>
              <th className="text-table-header text-left px-4 py-3 hidden md:table-cell">Expiry</th>
              <th className="text-table-header text-left px-4 py-3 hidden lg:table-cell">Joined</th>
              <th className="text-table-header text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array(5).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={9} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>
              ))
              : users.map(u => (
                <tr
                  key={u.id}
                  className={`border-b border-border last:border-0 hover:bg-table-hover transition-colors cursor-pointer ${selected.has(u.id) ? "bg-primary/5" : ""}`}
                  onClick={() => setDrawerUser(u)}
                >
                  <td className="px-4 py-3" onClick={e => toggleOne(u.id, e)}>
                    <input type="checkbox" checked={selected.has(u.id)} onChange={() => {}} className="h-4 w-4 accent-primary cursor-pointer" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-accent-foreground">{u.name[0]}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground">{u.name}</p>
                          {isFreePlan(u) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 leading-none">FREE</span>
                          )}
                        </div>
                        <p className="text-caption">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{u.phone || "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <StatusBadge variant={activePlan(u) === "No Plan" ? "neutral" : "brand"}>{activePlan(u)}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <StatusBadge variant={appModeVariant(u)}>{appModeLabel(u)}</StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={statusVariant(u.status)}>{statusLabel(u.status)}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{activeExpiry(u)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                    {new Date(u.joined_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setDrawerUser(u)}>
                          <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyEmail(u.email)}>
                          <Copy className="h-3.5 w-3.5 mr-2" /> Copy Email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setDrawerUser(u); setFreePlanId(""); setFreePlanDays(""); setShowFreePlan(true); }}>
                          <Gift className="h-3.5 w-3.5 mr-2" /> Give Free Plan
                        </DropdownMenuItem>
                        {isFreePlan(u) && (
                          <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => cancelFreePlanMut.mutate(u.id)}>
                            <Gift className="h-3.5 w-3.5 mr-2" /> Cancel Free Plan
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => {
                          if (window.confirm(`Delete account for ${u.name}? This cannot be undone.`)) {
                            deleteUserMut.mutate(u.id);
                          }
                        }}>
                          <UserX className="h-3.5 w-3.5 mr-2" />
                          Delete Account
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => handleToggleStatus(u)}>
                          <UserX className="h-3.5 w-3.5 mr-2" />
                          {u.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            }
            {!isLoading && users.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">No users found.</td></tr>
            )}
          </tbody>
        </table>
        <TableFooterPagination page={page} meta={meta} onPageChange={(next) => { setPage(next); clearSelection(); }} />
      </div>

      {/* ── User Drawer ─────────────────────────────────────────────────────── */}
      {drawerUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0" onClick={() => setDrawerUser(null)} />
          <div className="relative w-[480px] bg-card border-l border-border h-full overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-section-title">User Details</h2>
              <Button variant="ghost" size="icon" onClick={() => setDrawerUser(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
                  <span className="text-xl font-semibold text-accent-foreground">{drawerUser.name[0]}</span>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{drawerUser.name}</p>
                  {isFreePlan(drawerUser) && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">FREE</span>
                  )}
                  <p className="text-sm text-muted-foreground">{drawerUser.email}</p>
                  <p className="text-caption">
                    Joined {new Date(drawerUser.joined_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="text-caption mb-1">Active Plan</p>
                <p className="text-lg font-semibold text-foreground">{activePlan(drawerUser)}</p>
                <p className="text-sm text-muted-foreground">Expires: {activeExpiry(drawerUser)}</p>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="text-caption mb-1">App Mode</p>
                <StatusBadge variant={appModeVariant(drawerUser)}>{appModeLabel(drawerUser)}</StatusBadge>
                <div className="mt-2 space-y-0.5">
                  {formatDate(drawerUser.market_joined_at) && (
                    <p className="text-sm text-muted-foreground">Product Market since {formatDate(drawerUser.market_joined_at)}</p>
                  )}
                  {formatDate(drawerUser.learning_joined_at) && (
                    <p className="text-sm text-muted-foreground">Learning since {formatDate(drawerUser.learning_joined_at)}</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="text-caption mb-2">Session</p>
                <Button variant="danger-outline" size="sm" onClick={() => forceLogoutMut.mutate(drawerUser.id)} disabled={forceLogoutMut.isPending}>
                  Force Logout
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    const active = drawerUser.subscriptions?.find(s => s.status === "ACTIVE");
                    setSelectedPlanId(active?.plan?.id ?? "");
                    setShowChangePlan(true);
                  }}
                >
                  Change Plan
                </Button>
                <Button variant="outline" className="flex-1 gap-1.5" onClick={() => { setFreePlanId(""); setFreePlanDays(""); setShowFreePlan(true); }}>
                  <Gift className="h-4 w-4" /> Free Plan
                </Button>
              </div>
              {isFreePlan(drawerUser) && (
                <Button variant="danger-outline" className="w-full gap-1.5" onClick={() => cancelFreePlanMut.mutate(drawerUser.id)} disabled={cancelFreePlanMut.isPending}>
                  <Gift className="h-4 w-4" /> {cancelFreePlanMut.isPending ? "Cancelling…" : "Cancel Free Plan"}
                </Button>
              )}
              <Button variant="danger-outline" className="w-full" onClick={() => handleToggleStatus(drawerUser)} disabled={updateMut.isPending}>
                {drawerUser.status === "SUSPENDED" ? "Reactivate Account" : "Suspend Account"}
              </Button>
              <Button variant="danger-outline" className="w-full mt-2" onClick={() => {
                if (window.confirm(`Delete account for ${drawerUser.name}? This cannot be undone.`)) {
                  deleteUserMut.mutate(drawerUser.id);
                }
              }} disabled={deleteUserMut.isPending}>
                {deleteUserMut.isPending ? "Deleting…" : "Delete Account"}
              </Button>

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-caption">Wallet History</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatMoney(drawerUser.wallet_balance_minor ?? 0)}
                  </p>
                </div>
                {walletTxLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : walletTxs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No wallet transactions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {walletTxs.map(tx => {
                      const credit = tx.amount_minor >= 0;
                      return (
                        <div key={tx.id} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{walletTxLabel(tx.type)}</p>
                            <p className="text-caption">
                              {new Date(tx.created_at).toLocaleString("en-IN", {
                                day: "2-digit", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                            <p className="text-caption">Bal: {formatMoney(tx.balance_after_minor)}</p>
                          </div>
                          <p className={`text-sm font-semibold shrink-0 ${credit ? "text-emerald-600 dark:text-emerald-400" : "text-danger"}`}>
                            {credit ? "+" : ""}{formatMoney(tx.amount_minor)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {walletTxMeta && walletTxMeta.pages > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-2">
                    <span className="text-caption">Page {walletTxPage} of {walletTxMeta.pages}</span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={walletTxPage === 1} onClick={() => setWalletTxPage(p => p - 1)}>Prev</Button>
                      <Button variant="outline" size="sm" disabled={walletTxPage >= walletTxMeta.pages} onClick={() => setWalletTxPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Free Plan Modal (single user) ────────────────────────────────────── */}
      {showFreePlan && drawerUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-section-title mb-1">Give Free Plan</h2>
            <p className="text-sm text-muted-foreground mb-4">Assign a free plan to <span className="font-medium text-foreground">{drawerUser.name}</span> without payment.</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">Plan</label>
                <select className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" value={freePlanId} onChange={e => setFreePlanId(e.target.value)}>
                  <option value="">— Select plan —</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Duration (days) <span className="text-muted-foreground font-normal">— leave blank to use plan default</span></label>
                <Input className="mt-1" type="number" min={1} placeholder="e.g. 30" value={freePlanDays} onChange={e => setFreePlanDays(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setShowFreePlan(false)}>Cancel</Button>
              <Button onClick={handleAssignFreePlan} disabled={assignFreePlanMut.isPending || !freePlanId}>
                {assignFreePlanMut.isPending ? "Assigning…" : "Assign Free Plan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Free Plan Modal ─────────────────────────────────────────────── */}
      {bulkFreePlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-section-title mb-1">Give Free Plan</h2>
            <p className="text-sm text-muted-foreground mb-4">Applies to {plural(selected.size, "selected user")} — no payment required.</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">Plan</label>
                <select className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" value={bulkFreePlanId} onChange={e => setBulkFreePlanId(e.target.value)}>
                  <option value="">— Select plan —</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Duration (days) <span className="text-muted-foreground font-normal">— leave blank to use plan default</span></label>
                <Input className="mt-1" type="number" min={1} placeholder="e.g. 30" value={bulkFreePlanDays} onChange={e => setBulkFreePlanDays(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setBulkFreePlan(false)}>Cancel</Button>
              <Button onClick={handleBulkAssignFreePlan} disabled={bulkPending || !bulkFreePlanId}>
                {bulkPending ? "Assigning…" : "Assign to All"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Single-user Change Plan Modal ────────────────────────────────────── */}
      {showChangePlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-section-title mb-4">Change Plan</h2>
            <label className="text-sm font-medium text-foreground">Select New Plan</label>
            <select className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}>
              <option value="">— Select plan —</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setShowChangePlan(false)}>Cancel</Button>
              <Button onClick={handleChangePlan} disabled={changePlanMut.isPending}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Change Plan Modal ───────────────────────────────────────────── */}
      {bulkChangePlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-section-title mb-1">Change Plan</h2>
            <p className="text-sm text-muted-foreground mb-4">Applies to {plural(selected.size, "selected user")}.</p>
            <label className="text-sm font-medium text-foreground">Select New Plan</label>
            <select className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" value={bulkPlanId} onChange={e => setBulkPlanId(e.target.value)}>
              <option value="">— Select plan —</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setBulkChangePlan(false)}>Cancel</Button>
              <Button onClick={handleBulkChangePlan} disabled={bulkPending || !bulkPlanId}>
                {bulkPending ? "Updating…" : "Apply to All"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AddUserDialog open={showAddUser} onClose={() => setShowAddUser(false)} />
    </div>
  );
}
