import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  UserCheck,
  Users,
  X
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { technicians as initialTechnicians } from "../data/demoData";
import { Technician } from "../types/domain";
import {
  listAdminStaffRequestsApi,
  reviewAdminStaffRequestApi,
  type StaffLoginRequestRecord
} from "../services/api";

type ViewMode = "grid" | "table";
type StatusFilter = "ALL" | "Available" | "Busy" | "Offline";

const STAFF_STORAGE_KEY = "resolveai.staff_directory";

export function TechnicianManagement() {
  const [staffList, setStaffList] = useState<Technician[]>(() => {
    const saved = localStorage.getItem(STAFF_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        return initialTechnicians;
      }
    }
    return initialTechnicians;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStaffForContact, setSelectedStaffForContact] = useState<Technician | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<Technician | null>(null);

  // Staff Login Requests state
  const [pendingRequests, setPendingRequests] = useState<StaffLoginRequestRecord[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      const res = await listAdminStaffRequestsApi();
      setPendingRequests(res.requests.filter((r) => r.status === "PENDING_APPROVAL"));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleReview = async (id: string, decision: "ACCEPT" | "REJECT") => {
    setReviewingId(id);
    try {
      await reviewAdminStaffRequestApi(id, decision);
      await loadRequests();
    } catch (e) {
      console.error(e);
    } finally {
      setReviewingId(null);
    }
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staffList));
  }, [staffList]);

  // New staff form state
  const [newStaff, setNewStaff] = useState({
    name: "",
    title: "",
    department: "Network Operations",
    email: "",
    phone: "",
    location: "HQ · Tech Support",
    skills: "",
    capacity: 6
  });

  // Extract unique departments for filter dropdown
  const departments = useMemo(() => {
    const deps = new Set(staffList.map((t) => t.department).filter(Boolean) as string[]);
    return ["ALL", ...Array.from(deps)];
  }, [staffList]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((tech) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        tech.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tech.title && tech.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tech.email && tech.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        tech.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === "ALL" || tech.status === statusFilter;
      const matchesDepartment =
        departmentFilter === "ALL" || tech.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [staffList, searchQuery, statusFilter, departmentFilter]);

  // Overall KPIs
  const totalStaff = staffList.length;
  const availableCount = staffList.filter((s) => s.status === "Available").length;
  const busyCount = staffList.filter((s) => s.status === "Busy").length;
  const totalWorkload = staffList.reduce((acc, s) => acc + s.workload, 0);
  const totalCapacity = staffList.reduce((acc, s) => acc + s.capacity, 0);
  const avgUtilization =
    totalCapacity > 0 ? Math.round((totalWorkload / totalCapacity) * 100) : 0;
  const avgResolutionTime =
    staffList.length > 0
      ? (
          staffList.reduce((acc, s) => acc + s.averageResolutionHours, 0) / staffList.length
        ).toFixed(1)
      : "0";

  // Change staff status directly
  const handleStatusChange = (id: string, newStatus: "Available" | "Busy" | "Offline") => {
    setStaffList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
  };

  // Add new staff submit
  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name.trim() || !newStaff.email.trim()) return;

    const created: Technician = {
      id: `TECH-${Date.now().toString().slice(-4)}`,
      name: newStaff.name,
      title: newStaff.title || "IT Support Specialist",
      department: newStaff.department,
      email: newStaff.email,
      phone: newStaff.phone || "+1 (555) 000-0000",
      location: newStaff.location,
      skills: newStaff.skills
        ? newStaff.skills.split(",").map((s) => s.trim()).filter(Boolean)
        : ["General Support"],
      status: "Available",
      workload: 0,
      capacity: Number(newStaff.capacity) || 6,
      averageResolutionHours: 2.5,
      rating: 5.0,
      resolvedTickets: 0
    };

    setStaffList((prev) => [created, ...prev]);
    setIsAddModalOpen(false);
    setNewStaff({
      name: "",
      title: "",
      department: "Network Operations",
      email: "",
      phone: "",
      location: "HQ · Tech Support",
      skills: "",
      capacity: 6
    });
  };

  // Confirm delete staff
  const handleConfirmDelete = () => {
    if (!staffToDelete) return;
    setStaffList((prev) => prev.filter((t) => t.id !== staffToDelete.id));
    setStaffToDelete(null);
  };

  // Reset to default roster
  const handleResetDefaults = () => {
    if (window.confirm("Reset staff directory back to original default specialists?")) {
      setStaffList(initialTechnicians);
      localStorage.removeItem(STAFF_STORAGE_KEY);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Title", "Department", "Email", "Phone", "Status", "Skills", "Workload", "Capacity", "Avg Resolution (h)"];
    const rows = staffList.map((s) => [
      s.id,
      `"${s.name}"`,
      `"${s.title || ''}"`,
      `"${s.department || ''}"`,
      s.email || '',
      `"${s.phone || ''}"`,
      s.status,
      `"${s.skills.join(', ')}"`,
      s.workload,
      s.capacity,
      s.averageResolutionHours
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ResolveAI_Staff_Directory.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <PageHeader
        eyebrow="Staff Directory & Resource Management"
        title="Certified Technicians & Specialist Roster"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
              title="Reset to default specialists"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              Reset
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Specialist
            </button>
          </div>
        }
      />

      <main className="space-y-6 p-6">
        {/* Pending Staff Review Section */}
        {pendingRequests.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pending Staff Login Requests ({pendingRequests.length})
                  </h3>
                  <p className="text-xs text-slate-600">
                    Review staff members requesting workbench access. Either accept or reject their login request.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Action Required
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {pendingRequests.map((req) => (
                <div key={req.id} className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{req.name}</h4>
                      <p className="text-[11px] text-slate-500 truncate">{req.email}</p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Dept: <span className="font-semibold">{req.department || "IT Support"}</span>
                      </p>
                      {req.phone && (
                        <p className="text-[11px] text-slate-600">
                          Phone: <span className="font-semibold">{req.phone}</span>
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      Pending
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={reviewingId === req.id}
                      onClick={() => void handleReview(req.id, "ACCEPT")}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === req.id}
                      onClick={() => void handleReview(req.id, "REJECT")}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold shadow-sm flex items-center justify-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPI Metric Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Specialists</span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-950">{totalStaff}</p>
            <p className="mt-1 text-xs text-slate-500">Active in system directory</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Available Right Now</span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-bold text-slate-950">{availableCount}</p>
              <span className="text-xs text-emerald-600 font-semibold">{busyCount} busy</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Ready for automated assignment</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Capacity Utilization</span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-600">
                <Briefcase className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-bold text-slate-950">{avgUtilization}%</p>
              <span className="text-xs text-slate-500">({totalWorkload}/{totalCapacity} slots)</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  avgUtilization > 85 ? "bg-rose-500" : avgUtilization > 65 ? "bg-amber-500" : "bg-teal-500"
                }`}
                style={{ width: `${Math.min(avgUtilization, 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Avg Resolution Speed</span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-950">{avgResolutionTime}h</p>
            <p className="mt-1 text-xs text-slate-500">Across all resolved tickets</p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, title, skill, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="py-2 px-3 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
              >
                {departments.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep === "ALL" ? "All Departments" : dep}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Pills & View Toggle */}
          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              {(["ALL", "Available", "Busy", "Offline"] as StatusFilter[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    statusFilter === status
                      ? "bg-white text-slate-950 font-bold shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "grid"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "table"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong className="text-slate-800">{filteredStaff.length}</strong> of{" "}
            <strong className="text-slate-800">{totalStaff}</strong> specialists
          </span>
          {(searchQuery || statusFilter !== "ALL" || departmentFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
                setDepartmentFilter("ALL");
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Empty State */}
        {filteredStaff.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-900">No staff members match your criteria</p>
            <p className="text-xs text-slate-500 mt-1">Try refining your search terms or clearing filters.</p>
          </div>
        )}

        {/* GRID VIEW */}
        {viewMode === "grid" && filteredStaff.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredStaff.map((tech) => {
              const initials = tech.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              const loadPercent = Math.round((tech.workload / tech.capacity) * 100);
              const isOverloaded = loadPercent >= 85;
              const isModerate = loadPercent >= 60 && loadPercent < 85;

              return (
                <article
                  key={tech.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Avatar, Name, Department & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white font-bold text-sm shadow-md">
                            {initials}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                              tech.status === "Available"
                                ? "bg-emerald-500"
                                : tech.status === "Busy"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            }`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-bold text-slate-950 text-base">{tech.name}</h2>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                              {tech.id}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-indigo-700">{tech.title || "IT Specialist"}</p>
                          <p className="text-[11px] text-slate-500">{tech.department || "IT Operations"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <StatusBadge value={tech.status} />
                        <button
                          onClick={() => setStaffToDelete(tech)}
                          className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title={`Remove ${tech.name} from directory`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Meta info: Location & Contact */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                      {tech.location && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{tech.location}</span>
                        </div>
                      )}
                      {tech.email && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{tech.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Skills Chips */}
                    <div className="mt-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Specialized Domains
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {tech.skills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Capacity & Workload Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-600">Active Workload</span>
                        <span className="font-bold text-slate-800">
                          {tech.workload} / {tech.capacity} Tickets ({loadPercent}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOverloaded
                              ? "bg-rose-500"
                              : isModerate
                              ? "bg-amber-500"
                              : "bg-teal-600"
                          }`}
                          style={{ width: `${Math.min(loadPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Performance metrics grid */}
                    <div className="mt-4 grid grid-cols-3 gap-2 bg-slate-50/80 rounded-lg p-2.5 text-center">
                      <div>
                        <p className="text-[10px] text-slate-500">Avg Resolution</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">
                          {tech.averageResolutionHours}h
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">Satisfaction</p>
                        <p className="text-xs font-bold text-amber-600 flex items-center justify-center gap-0.5 mt-0.5">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {tech.rating || 4.8}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">Resolved</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">
                          {tech.resolvedTickets || 120}+
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Status quick toggle */}
                    <select
                      value={tech.status}
                      onChange={(e) =>
                        handleStatusChange(tech.id, e.target.value as "Available" | "Busy" | "Offline")
                      }
                      className="text-xs py-1.5 px-2 bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      <option value="Available">🟢 Available</option>
                      <option value="Busy">🟡 Busy</option>
                      <option value="Offline">⚪ Offline</option>
                    </select>

                    <button
                      onClick={() => setSelectedStaffForContact(tech)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Contact
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* TABLE VIEW */}
        {viewMode === "table" && filteredStaff.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Specialist</th>
                    <th className="px-4 py-3.5">Department</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Primary Skills</th>
                    <th className="px-4 py-3.5">Load</th>
                    <th className="px-4 py-3.5">Resolution Time</th>
                    <th className="px-4 py-3.5">Rating</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredStaff.map((tech) => (
                    <tr key={tech.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-white font-bold text-xs">
                            {tech.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{tech.name}</p>
                            <p className="text-xs text-slate-500">{tech.title || "Specialist"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-700">
                        {tech.department || "IT Operations"}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge value={tech.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {tech.skills.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]"
                            >
                              {s}
                            </span>
                          ))}
                          {tech.skills.length > 3 && (
                            <span className="text-[10px] text-slate-400 self-center">
                              +{tech.skills.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold text-slate-800">
                        {tech.workload}/{tech.capacity}
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold text-slate-800">
                        {tech.averageResolutionHours}h
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-amber-600">
                        ★ {tech.rating || 4.8}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedStaffForContact(tech)}
                            className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                          >
                            Contact
                          </button>
                          <button
                            onClick={() => setStaffToDelete(tech)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={`Remove ${tech.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: ADD SPECIALIST */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-950">Add Specialist to Directory</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Systems Engineer"
                    value={newStaff.title}
                    onChange={(e) => setNewStaff({ ...newStaff, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={newStaff.department}
                    onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Network Operations">Network Operations</option>
                    <option value="InfoSec & Compliance">InfoSec & Compliance</option>
                    <option value="Directory Services">Directory Services</option>
                    <option value="Cloud Platforms">Cloud Platforms</option>
                    <option value="User Operations">User Operations</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="maya.lin@resolveai.com"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Skills (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cisco, VPN, DNS, Routing, Firewall"
                  value={newStaff.skills}
                  onChange={(e) => setNewStaff({ ...newStaff, skills: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Office / Floor Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HQ · Building C, Fl 1"
                    value={newStaff.location}
                    onChange={(e) => setNewStaff({ ...newStaff, location: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Ticket Capacity Limit
                    </label>
                    <span className="text-[10px] text-slate-400">Max concurrent</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newStaff.capacity}
                    onChange={(e) => setNewStaff({ ...newStaff, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="e.g. 6"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Maximum active tickets this technician can handle at the same time.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm"
                >
                  Save Specialist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {staffToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Remove Specialist</h3>
            <p className="text-xs text-slate-500 mt-2">
              Are you sure you want to remove <strong className="text-slate-800">{staffToDelete.name}</strong> ({staffToDelete.id}) from the active staff directory?
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONTACT SPECIALIST */}
      {selectedStaffForContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-600 text-white font-bold text-sm">
                  {selectedStaffForContact.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-base">
                    {selectedStaffForContact.name}
                  </h3>
                  <p className="text-xs text-indigo-700 font-medium">
                    {selectedStaffForContact.title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {selectedStaffForContact.department}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStaffForContact(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <StatusBadge value={selectedStaffForContact.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email</span>
                <a
                  href={`mailto:${selectedStaffForContact.email}`}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  {selectedStaffForContact.email || "N/A"}
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Direct Phone</span>
                <a
                  href={`tel:${selectedStaffForContact.phone}`}
                  className="text-slate-800 font-semibold"
                >
                  {selectedStaffForContact.phone || "N/A"}
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Location</span>
                <span className="text-slate-800 font-medium">
                  {selectedStaffForContact.location || "Main Campus"}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedStaffForContact(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              <a
                href={`mailto:${selectedStaffForContact.email}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm"
              >
                <Mail className="h-3.5 w-3.5" />
                Send Email
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
