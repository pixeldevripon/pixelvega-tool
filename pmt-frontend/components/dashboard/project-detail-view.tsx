"use client";

import {
  ArrowLeft,
  Archive,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Flag,
  History,
  ListFilter,
  Loader2,
  MessageSquareText,
  Pencil,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Square,
  Timer,
  Trash2,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdditionalRequirementsSection } from "@/components/dashboard/additional-requirements-section";
import { BlockersSection } from "@/components/dashboard/blockers-section";
import { ClientFeedbackSection } from "@/components/dashboard/client-feedback-section";
import { InternalReviewsSection } from "@/components/dashboard/internal-reviews-section";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { ProjectActivityTimeline } from "@/components/dashboard/project-activity-timeline";
import { ProjectDailyWorkReportsSection } from "@/components/dashboard/project-daily-work-reports-section";
import { ProjectReportSection } from "@/components/dashboard/project-report-section";
import { ProjectSlackConnection } from "@/components/dashboard/project-slack-connection";
import { ProjectEditDialog } from "@/components/dashboard/project-edit-dialog";
import { ProjectTypesEditDialog } from "@/components/dashboard/project-types-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  type Project,
  type ProjectActivity,
  type ProjectDocument,
  type ProjectDocumentType,
  type ProjectDailyTimeSummary,
  type ProjectTimeSummary,
  type ProjectMember,
  type ProjectPriority,
  type ProjectRole,
  type ProjectStatus,
  type TimeEntry,
  type TimeEntryStatus,
  projectPriorities,
  projectDocumentTypes,
  projectsApi,
} from "@/lib/api/projects";
import { userStore } from "@/lib/api/user-store";
import type { AppUser } from "@/types/auth";

const MEMBER_ROLE_LABELS: Record<ProjectRole, string> = {
  PROJECT_MANAGER: "Project Manager",
  DEVELOPER: "Developer",
  DESIGNER: "Designer",
};

const MEMBER_ROLES: ProjectRole[] = ["PROJECT_MANAGER", "DEVELOPER", "DESIGNER"];

const ALL_VALUE = "ALL";

const DOCUMENT_TYPE_LABELS: Record<ProjectDocumentType, string> = {
  PRD: "PRD",
  REQUIREMENT: "Requirement",
  MEETING_NOTE: "Meeting Note",
  CREDENTIAL: "Credential",
  ASSET: "Asset",
  DELIVERABLE: "Deliverable",
};

const DOCUMENT_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv";
const MAX_DOCUMENT_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ACTIVITY_PAGE_SIZE = 20;

type SlackInviteState = {
  status: "INVITED" | "NEEDS_ATTENTION" | "FAILED";
  message: string;
};

type ProjectDetailTab = "overview" | "delivery" | "files" | "time" | "team" | "history";

const PROJECT_DETAIL_TABS: Array<{ id: ProjectDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "delivery", label: "Delivery" },
  { id: "files", label: "Files" },
  { id: "time", label: "Time" },
  { id: "team", label: "Team" },
  { id: "history", label: "History" },
];

const STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  PLANNING: ["SCHEDULED", "READY_FOR_WORK", "CANCELLED"],
  SCHEDULED: ["READY_FOR_WORK", "CANCELLED"],
  READY_FOR_WORK: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "INTERNAL_REVIEW", "CANCELLED"],
  ON_HOLD: ["READY_FOR_WORK", "CANCELLED"],
  INTERNAL_REVIEW: ["READY_FOR_CLIENT", "READY_FOR_WORK", "CANCELLED"],
  READY_FOR_CLIENT: ["WAITING_FOR_FEEDBACK", "CANCELLED"],
  WAITING_FOR_FEEDBACK: ["COMPLETED", "READY_FOR_WORK", "CANCELLED"],
  COMPLETED: ["READY_FOR_WORK"],
  CANCELLED: ["READY_FOR_WORK"],
};

const STATUS_HELP_TEXT: Record<ProjectStatus, string> = {
  PLANNING: "Project is still being prepared and staffed.",
  SCHEDULED: "Project is staffed and waiting for its planned start date.",
  READY_FOR_WORK: "Project is ready for assigned work to begin or resume.",
  IN_PROGRESS: "Work has started and is actively moving.",
  ON_HOLD: "Project is paused until the hold reason is resolved.",
  INTERNAL_REVIEW: "Assigned work is ready for PM/internal review.",
  READY_FOR_CLIENT: "Project is ready to be shared with the client.",
  WAITING_FOR_FEEDBACK: "Project is waiting for client response.",
  COMPLETED: "Project has reached completion.",
  CANCELLED: "Project was cancelled before completion.",
};

const STATUS_PROGRESSION_ORDER: ProjectStatus[] = [
  "PLANNING",
  "SCHEDULED",
  "READY_FOR_WORK",
  "IN_PROGRESS",
  "ON_HOLD",
  "INTERNAL_REVIEW",
  "READY_FOR_CLIENT",
  "WAITING_FOR_FEEDBACK",
  "COMPLETED",
  "CANCELLED",
];

function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && STATUS_PROGRESSION_ORDER.includes(value as ProjectStatus);
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: ProjectStatus) {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "ON_HOLD" || status === "WAITING_FOR_FEEDBACK") return "warning";
  if (status === "READY_FOR_WORK" || status === "IN_PROGRESS") return "primary";
  return "default";
}

function priorityTone(priority?: ProjectPriority) {
  if (priority === "CRITICAL" || priority === "URGENT") return "danger";
  if (priority === "HIGH") return "warning";
  if (priority === "MEDIUM") return "primary";
  return "default";
}

function activityLabel(type: string) {
  return formatEnumLabel(type);
}

function projectTypes(project: Project) {
  return project.projectTypeTags?.map((tag) => tag.type) ?? [];
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "No file size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatHours(value?: number | null) {
  if (value === undefined || value === null) return "Not set";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
}

function formatTrackedHours(value?: number | null) {
  if (value === undefined || value === null) return "0h";
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}h`;
}

function formatMinutes(value?: number | null) {
  if (value === undefined || value === null) return "Running";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function elapsedMinutesSince(value?: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
}

function emptyDocumentForm() {
  return {
    title: "",
    description: "",
    type: "REQUIREMENT" as ProjectDocumentType,
    mode: "TEXT" as "TEXT" | "FILE",
    textContent: "",
    file: null as File | null,
  };
}

function userDisplayName(user?: Pick<AppUser, "name" | "email"> | null) {
  return user?.name || user?.email || "Unknown user";
}

function projectRoleForUser(user?: AppUser) {
  if (
    user?.role === "PROJECT_MANAGER" ||
    user?.role === "DEVELOPER" ||
    user?.role === "DESIGNER"
  ) {
    return user.role;
  }
  return null;
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-extrabold uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-bold">{value}</div>
    </div>
  );
}

function ReadinessItem({
  label,
  description,
  ready,
}: {
  label: string;
  description: string;
  ready: boolean;
}) {
  const Icon = ready ? CheckCircle2 : Clock3;
  return (
    <div className="flex gap-3 rounded-md border border-border bg-muted/30 p-3">
      <Icon
        size={18}
        className={ready ? "mt-0.5 text-emerald-600" : "mt-0.5 text-amber-600"}
      />
      <div>
        <div className="text-sm font-extrabold">{label}</div>
        <div className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
          {description}
        </div>
      </div>
    </div>
  );
}

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { currentUser, users } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);
  const activityPageRef = useRef(1);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [documentFilter, setDocumentFilter] = useState<
    ProjectDocumentType | typeof ALL_VALUE
  >(ALL_VALUE);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeEntriesTotalMinutes, setTimeEntriesTotalMinutes] = useState(0);
  const [dailyTimeSummary, setDailyTimeSummary] =
    useState<ProjectDailyTimeSummary | null>(null);
  const [projectTimeSummary, setProjectTimeSummary] =
    useState<ProjectTimeSummary | null>(null);
  const [timeSummaryError, setTimeSummaryError] = useState("");
  const [activeTimeEntry, setActiveTimeEntry] = useState<TimeEntry | null>(null);
  const [timeUserFilter, setTimeUserFilter] = useState(ALL_VALUE);
  const [timeStatusFilter, setTimeStatusFilter] = useState<
    TimeEntryStatus | typeof ALL_VALUE
  >(ALL_VALUE);
  const [timeStartDate, setTimeStartDate] = useState("");
  const [timeEndDate, setTimeEndDate] = useState("");
  const [appliedTimeFilters, setAppliedTimeFilters] = useState({
    userId: ALL_VALUE,
    status: ALL_VALUE as TimeEntryStatus | typeof ALL_VALUE,
    startDate: "",
    endDate: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [memberRole, setMemberRole] = useState<ProjectRole>("PROJECT_MANAGER");
  const [memberUserId, setMemberUserId] = useState("");
  const [workloadCount, setWorkloadCount] = useState<number | null>(null);
  const [workloadOverloaded, setWorkloadOverloaded] = useState(false);
  const [workloadLoading, setWorkloadLoading] = useState(false);
  const [memberActionError, setMemberActionError] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState<ProjectMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [nextStatus, setNextStatus] = useState<ProjectStatus | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [statusActionError, setStatusActionError] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [archiveActionError, setArchiveActionError] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [restoreActionError, setRestoreActionError] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedPriority, setSelectedPriority] =
    useState<ProjectPriority>("MEDIUM");
  const [rushReason, setRushReason] = useState("");
  const [priorityActionError, setPriorityActionError] = useState("");
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [documentForm, setDocumentForm] = useState(emptyDocumentForm);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<ProjectDocument | null>(
    null,
  );
  const [viewingDocument, setViewingDocument] = useState<ProjectDocument | null>(
    null,
  );
  const [removingDocument, setRemovingDocument] =
    useState<ProjectDocument | null>(null);
  const [documentActionError, setDocumentActionError] = useState("");
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [isRemovingDocument, setIsRemovingDocument] = useState(false);
  const [timerNotes, setTimerNotes] = useState("");
  const [timerActionError, setTimerActionError] = useState("");
  const [timerAction, setTimerAction] = useState<
    "start" | "pause" | "resume" | "stop" | null
  >(null);
  const [estimatedHoursInput, setEstimatedHoursInput] = useState("");
  const [estimatedHoursError, setEstimatedHoursError] = useState("");
  const [isSavingEstimatedHours, setIsSavingEstimatedHours] = useState(false);
  const [timerNow, setTimerNow] = useState(0);
  const [slackInviteStates, setSlackInviteStates] = useState<
    Record<string, SlackInviteState>
  >({});
  const [resyncingMemberId, setResyncingMemberId] = useState("");
  const [activeProjectTab, setActiveProjectTab] =
    useState<ProjectDetailTab>("overview");

  const isClient = currentUser?.role === "CLIENT";
  const currentUserId = currentUser?.id;
  const currentUserRole = currentUser?.role;
  const canManageStaffing =
    currentUser?.role === "SYSTEM_ADMIN" ||
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "PROJECT_MANAGER";
  const canManageDocuments = canManageStaffing;
  const canViewInternalProject = Boolean(currentUser && !isClient);
  const canManagePriority = canManageStaffing;
  const canManageEstimatedHours = canManageStaffing;
  const canViewTimeTracking = canViewInternalProject;
  const canCancelProject =
    currentUser?.role === "SYSTEM_ADMIN" || currentUser?.role === "ADMIN";
  const canUpdateStatus = Boolean(
    currentUser &&
      (currentUser.role === "SYSTEM_ADMIN" ||
        currentUser.role === "ADMIN" ||
        currentUser.role === "PROJECT_MANAGER" ||
        currentUser.role === "DEVELOPER" ||
        currentUser.role === "DESIGNER"),
  );

  const activeMembers = useMemo(
    () => members.filter((member) => !member.leftAt),
    [members],
  );
  const formerMembers = useMemo(
    () => members.filter((member) => Boolean(member.leftAt)),
    [members],
  );
  const canManageThisProject = Boolean(
    currentUser &&
      (currentUser.role === "SYSTEM_ADMIN" ||
        currentUser.role === "ADMIN" ||
        (currentUser.role === "PROJECT_MANAGER" &&
          activeMembers.some(
            (member) =>
              member.userId === currentUser.id &&
              member.role === "PROJECT_MANAGER" &&
              !member.leftAt,
          ))),
  );
  const canAdministerProject =
    currentUserRole === "SYSTEM_ADMIN" || currentUserRole === "ADMIN";
  const canReopenProject = Boolean(
    canAdministerProject &&
      !project?.archivedAt &&
      (project?.status === "COMPLETED" || project?.status === "CANCELLED"),
  );
  const canRestoreProject = Boolean(canAdministerProject && project?.archivedAt);
  const canArchiveProject = Boolean(
    canAdministerProject &&
      !project?.archivedAt &&
      (project?.status === "COMPLETED" || project?.status === "CANCELLED"),
  );
  const hasProjectManager = activeMembers.some(
    (member) => member.role === "PROJECT_MANAGER",
  );
  const hasMaker = activeMembers.some(
    (member) => member.role === "DEVELOPER" || member.role === "DESIGNER",
  );
  const canTrackTime =
    (currentUser?.role === "DEVELOPER" || currentUser?.role === "DESIGNER") &&
    activeMembers.some((member) => member.userId === currentUser.id);
  const typeTags = project ? projectTypes(project) : [];
  const statusOptions = useMemo(() => {
    if (!project || !canUpdateStatus) return [];
    return STATUS_TRANSITIONS[project.status].filter(
      (status) =>
        (status !== "CANCELLED" || canCancelProject) &&
          (status !== "ON_HOLD" ||
            currentUserRole === "SYSTEM_ADMIN" ||
            currentUserRole === "ADMIN" ||
            currentUserRole === "PROJECT_MANAGER") &&
        (status !== "READY_FOR_WORK" ||
          project.status !== "COMPLETED" &&
            project.status !== "CANCELLED" ||
          canReopenProject) &&
        !(
          project.status === "INTERNAL_REVIEW" &&
          (status === "READY_FOR_CLIENT" || status === "READY_FOR_WORK")
        ),
    );
  }, [canCancelProject, canReopenProject, canUpdateStatus, currentUserRole, project]);
  const completedStatuses = useMemo(() => {
    const visited = new Set<ProjectStatus>();

    activities.forEach((activity) => {
      if (activity.type !== "STATUS_CHANGED" || !activity.metadata) return;
      const from = activity.metadata.from;
      if (isProjectStatus(from) && from !== project?.status) visited.add(from);
    });

    return STATUS_PROGRESSION_ORDER.filter((status) => visited.has(status));
  }, [activities, project?.status]);
  const selectedPriorityRequiresReason =
    selectedPriority === "URGENT" || selectedPriority === "CRITICAL";
  const activeTimerOnThisProject =
    activeTimeEntry?.status === "RUNNING" && activeTimeEntry.projectId === projectId;
  const activeTimerOnAnotherProject =
    activeTimeEntry?.status === "RUNNING" && activeTimeEntry.projectId !== projectId;
  const resumablePausedEntry = timeEntries.find(
    (entry) => entry.userId === currentUser?.id && entry.status === "PAUSED",
  );
  const activeTimerElapsedMinutes =
    activeTimeEntry?.status === "RUNNING"
      ? Math.max(
          0,
          Math.floor((timerNow - new Date(activeTimeEntry.startedAt).getTime()) / 60_000),
        )
      : 0;

  const assignableUsers = useMemo(
    () =>
      (Array.isArray(users) ? users : [])
        .filter((user) => user.status === "ACTIVE")
        .filter((user) => projectRoleForUser(user) === memberRole)
        .filter(
          (user) =>
            !activeMembers.some(
              (member) => member.userId === user.id && member.role === memberRole,
            ),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [activeMembers, memberRole, users],
  );
  const timeFilterMembers = useMemo(
    () =>
      activeMembers
        .filter((member) => member.role === "DEVELOPER" || member.role === "DESIGNER")
        .filter((member) => Boolean(member.user))
        .sort((a, b) =>
          userDisplayName(a.user).localeCompare(userDisplayName(b.user)),
        ),
    [activeMembers],
  );
  const unmappedSlackMemberCount = useMemo(
    () =>
      project?.slackChannelId
        ? activeMembers.filter(
            (member) => !users.find((user) => user.id === member.userId)?.slackUserId,
          ).length
        : 0,
    [activeMembers, project?.slackChannelId, users],
  );

  const loadActivityPage = useCallback(
    async (page: number) => {
      setActivityLoading(true);
      try {
        const result = await projectsApi.activities(projectId, {
          page,
          pageSize: ACTIVITY_PAGE_SIZE,
        });
        setActivities(result.items);
        setActivityTotal(result.total);
        setActivityPage(result.page);
        activityPageRef.current = result.page;
      } catch {
        toast.error("Unable to load project activity.");
      } finally {
        setActivityLoading(false);
      }
    },
    [projectId],
  );

  const loadProjectDetail = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setTimeSummaryError("");

    try {
      const projectResult = await projectsApi.findOne(projectId);
      setProject(projectResult);
      if (projectResult.priority) {
        setSelectedPriority(projectResult.priority);
      }
      setEstimatedHoursInput(
        projectResult.estimatedHours === null ||
          projectResult.estimatedHours === undefined
          ? ""
          : String(projectResult.estimatedHours),
      );

      const documentResult = await projectsApi.documents(projectId, {
        page: 1,
        pageSize: 100,
        type: documentFilter,
      });
      setDocuments(documentResult.items);

      if (!isClient) {
        const [memberResult, activityResult, timeResult, activeTimerResult] =
          await Promise.allSettled([
          projectsApi.members(projectId, {
            page: 1,
            pageSize: 100,
            includeLeft: true,
          }),
          projectsApi.activities(projectId, {
            page: activityPageRef.current,
            pageSize: ACTIVITY_PAGE_SIZE,
          }),
          projectsApi.timeEntries(projectId, {
            page: 1,
            pageSize: 20,
            userId: appliedTimeFilters.userId,
            status: appliedTimeFilters.status,
            startDate: appliedTimeFilters.startDate,
            endDate: appliedTimeFilters.endDate,
          }),
          currentUserRole === "DEVELOPER" || currentUserRole === "DESIGNER"
            ? projectsApi.activeTimeEntry()
            : Promise.resolve({ active: false, entry: null }),
        ]);
        setMembers(memberResult.status === "fulfilled" ? memberResult.value.items : []);
        setActivities(
          activityResult.status === "fulfilled" ? activityResult.value.items : [],
        );
        setActivityTotal(
          activityResult.status === "fulfilled" ? activityResult.value.total : 0,
        );
        if (activityResult.status === "fulfilled") {
          setActivityPage(activityResult.value.page);
          activityPageRef.current = activityResult.value.page;
        }
        setTimeEntries(timeResult.status === "fulfilled" ? timeResult.value.items : []);
        setTimeEntriesTotalMinutes(
          timeResult.status === "fulfilled" ? timeResult.value.totalMinutes : 0,
        );
        setActiveTimeEntry(
          activeTimerResult.status === "fulfilled"
            ? activeTimerResult.value.entry
            : null,
        );

        const canViewOtherUserSummary =
          currentUserRole === "SYSTEM_ADMIN" ||
          currentUserRole === "ADMIN" ||
          currentUserRole === "PROJECT_MANAGER";
        const summaryUserId =
          canViewOtherUserSummary && appliedTimeFilters.userId !== ALL_VALUE
            ? appliedTimeFilters.userId
            : currentUserRole === "DEVELOPER" || currentUserRole === "DESIGNER"
              ? currentUserId
              : undefined;

        const [dailySummaryResult, projectSummaryResult] = await Promise.allSettled([
          projectsApi.dailyTimeSummary(projectId, {
            userId: appliedTimeFilters.userId,
            status: appliedTimeFilters.status,
            startDate: appliedTimeFilters.startDate,
            endDate: appliedTimeFilters.endDate,
          }),
          summaryUserId
            ? projectsApi.projectTimeSummary({
                userId: summaryUserId,
                startDate: appliedTimeFilters.startDate,
                endDate: appliedTimeFilters.endDate,
              })
            : Promise.resolve(null),
        ]);
        setDailyTimeSummary(
          dailySummaryResult.status === "fulfilled"
            ? dailySummaryResult.value
            : null,
        );
        setProjectTimeSummary(
          projectSummaryResult.status === "fulfilled"
            ? projectSummaryResult.value
            : null,
        );
        const summaryErrors = [dailySummaryResult, projectSummaryResult].flatMap(
          (result) =>
            result.status === "rejected"
              ? [
                  result.reason instanceof Error
                    ? result.reason.message
                    : "Unable to load time summaries.",
                ]
              : [],
        );
        setTimeSummaryError(summaryErrors[0] ?? "");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to load project.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    appliedTimeFilters,
    currentUserId,
    currentUserRole,
    documentFilter,
    isClient,
    projectId,
  ]);

  useEffect(() => {
    void userStore.loadCurrentUser();
  }, []);

  useEffect(() => {
    if (canManageStaffing) {
      void userStore.loadUsers();
    }
  }, [canManageStaffing]);

  useEffect(() => {
    if (!currentUserId) return undefined;

    const timeoutId = window.setTimeout(() => {
      void loadProjectDetail();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [currentUserId, loadProjectDetail]);

  useEffect(() => {
    if (activeTimeEntry?.status !== "RUNNING") return undefined;

    const timeoutId = window.setTimeout(() => setTimerNow(Date.now()), 0);
    const intervalId = window.setInterval(() => setTimerNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [activeTimeEntry?.status]);

  async function handleMemberUserChange(userId: string) {
    setMemberUserId(userId);
    setMemberActionError("");
    setWorkloadCount(null);
    setWorkloadOverloaded(false);

    if (!userId) return;

    setWorkloadLoading(true);
    try {
      const response = await projectsApi.findForUser(userId, {
        page: 1,
        pageSize: 6,
      });
      setWorkloadCount(response.total);
      setWorkloadOverloaded(Boolean(response.overloaded));
    } catch (error) {
      setMemberActionError(
        error instanceof Error
          ? error.message
          : "Unable to check this user's workload.",
      );
    } finally {
      setWorkloadLoading(false);
    }
  }

  function handleMemberRoleChange(role: ProjectRole) {
    setMemberRole(role);
    setMemberUserId("");
    setWorkloadCount(null);
    setWorkloadOverloaded(false);
    setMemberActionError("");
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMemberActionError("");

    if (!memberUserId) {
      setMemberActionError("Select a user to add to this project.");
      return;
    }

    setIsAddingMember(true);
    try {
      const member = await projectsApi.addMember(projectId, {
        userId: memberUserId,
        role: memberRole,
      });
      toast.success("Team member added", {
        description:
          member.workloadWarning ??
          `${userDisplayName(member.user)} joined as ${MEMBER_ROLE_LABELS[member.role]}.`,
      });
      setMemberUserId("");
      setWorkloadCount(null);
      setWorkloadOverloaded(false);
      await loadProjectDetail();
    } catch (error) {
      setMemberActionError(
        error instanceof Error ? error.message : "Unable to add team member.",
      );
    } finally {
      setIsAddingMember(false);
    }
  }

  async function handleRemoveMember() {
    if (!removingMember) return;
    setIsRemovingMember(true);
    setMemberActionError("");

    try {
      await projectsApi.removeMember(projectId, removingMember.id);
      toast.success("Team member removed", {
        description: `${userDisplayName(removingMember.user)} is no longer active on this project.`,
      });
      setRemovingMember(null);
      await loadProjectDetail();
    } catch (error) {
      setMemberActionError(
        error instanceof Error
          ? error.message
          : "Unable to remove team member.",
      );
    } finally {
      setIsRemovingMember(false);
    }
  }

  async function handleResyncSlackInvite(member: ProjectMember) {
    setResyncingMemberId(member.id);
    try {
      const result = await projectsApi.resyncSlackInvite(projectId, member.id);
      setSlackInviteStates((current) => ({
        ...current,
        [member.id]: {
          status: result.invited ? "INVITED" : "NEEDS_ATTENTION",
          message: result.message,
        },
      }));
      if (result.invited) {
        if (canManageStaffing) {
          void userStore.loadUsers();
        }
        toast.success("Slack invite sent", { description: result.message });
      } else {
        toast.error("Slack invite needs attention", {
          description: result.message,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to resync the Slack invite.";
      setSlackInviteStates((current) => ({
        ...current,
        [member.id]: { status: "FAILED", message },
      }));
      toast.error("Slack invite resync failed", { description: message });
    } finally {
      setResyncingMemberId("");
    }
  }

  function openStatusDialog(status: ProjectStatus) {
    setNextStatus(status);
    setStatusReason("");
    setStatusActionError("");
  }

  async function handleUpdateStatus() {
    if (!nextStatus) return;
    const requiresReason = nextStatus === "ON_HOLD" || nextStatus === "CANCELLED";
    const trimmedReason = statusReason.trim();

    if (requiresReason && !trimmedReason) {
      setStatusActionError(
        nextStatus === "ON_HOLD"
          ? "Add the hold reason before pausing this project."
          : "Add the cancellation reason before cancelling this project.",
      );
      return;
    }

    setIsUpdatingStatus(true);
    setStatusActionError("");

    try {
      const updated = await projectsApi.updateStatus(projectId, {
        status: nextStatus,
        reason: trimmedReason,
      });
      toast.success("Project status updated", {
        description: `${updated.name} moved to ${formatEnumLabel(updated.status)}.`,
      });
      setNextStatus(null);
      setStatusReason("");
      await loadProjectDetail();
    } catch (error) {
      setStatusActionError(
        error instanceof Error ? error.message : "Unable to update status.",
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleArchiveProject() {
    if (!canArchiveProject) return;

    setIsArchiving(true);
    setArchiveActionError("");

    try {
      const archivedProject = await projectsApi.archive(projectId);
      toast.success("Project archived", {
        description: `${archivedProject.name} is now preserved as an archived project.`,
      });
      setIsArchiveDialogOpen(false);
      await loadProjectDetail();
    } catch (error) {
      setArchiveActionError(
        error instanceof Error ? error.message : "Unable to archive project.",
      );
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleRestoreProject() {
    if (!canRestoreProject) return;

    setIsRestoring(true);
    setRestoreActionError("");

    try {
      const restoredProject = await projectsApi.restore(projectId);
      toast.success("Project restored", {
        description: `${restoredProject.name} is ready for work again.`,
      });
      setIsRestoreDialogOpen(false);
      await loadProjectDetail();
    } catch (error) {
      setRestoreActionError(
        error instanceof Error ? error.message : "Unable to restore project.",
      );
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleUpdatePriority(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPriorityActionError("");

    if (!project) return;
    if (selectedPriority === project.priority) {
      setPriorityActionError("Select a different priority before saving.");
      return;
    }

    const trimmedRushReason = rushReason.trim();
    if (selectedPriorityRequiresReason && !trimmedRushReason) {
      setPriorityActionError(
        "Add the rush reason before setting Urgent or Critical priority.",
      );
      return;
    }

    setIsUpdatingPriority(true);
    try {
      const updated = await projectsApi.updatePriority(projectId, {
        priority: selectedPriority,
        rushReason: trimmedRushReason,
      });
      toast.success("Project priority updated", {
        description: `${updated.name} is now ${formatEnumLabel(updated.priority ?? selectedPriority)} priority.`,
      });
      setRushReason("");
      await loadProjectDetail();
    } catch (error) {
      setPriorityActionError(
        error instanceof Error ? error.message : "Unable to update priority.",
      );
    } finally {
      setIsUpdatingPriority(false);
    }
  }

  async function handleSaveEstimatedHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEstimatedHoursError("");

    const estimatedHours = Number(estimatedHoursInput);
    if (!Number.isFinite(estimatedHours) || estimatedHours < 0) {
      setEstimatedHoursError("Enter estimated hours as 0 or a positive number.");
      return;
    }

    setIsSavingEstimatedHours(true);
    try {
      const updated = await projectsApi.updateEstimatedHours(projectId, {
        estimatedHours,
      });
      toast.success("Estimated hours updated", {
        description: `${updated.name} is estimated at ${formatHours(updated.estimatedHours)}.`,
      });
      await loadProjectDetail();
    } catch (error) {
      setEstimatedHoursError(
        error instanceof Error
          ? error.message
          : "Unable to update estimated hours.",
      );
    } finally {
      setIsSavingEstimatedHours(false);
    }
  }

  function handleApplyTimeFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedTimeFilters({
      userId: timeUserFilter,
      status: timeStatusFilter,
      startDate: timeStartDate,
      endDate: timeEndDate,
    });
  }

  function handleResetTimeFilters() {
    setTimeUserFilter(ALL_VALUE);
    setTimeStatusFilter(ALL_VALUE);
    setTimeStartDate("");
    setTimeEndDate("");
    setAppliedTimeFilters({
      userId: ALL_VALUE,
      status: ALL_VALUE,
      startDate: "",
      endDate: "",
    });
  }

  async function handleTimerAction(
    action: "start" | "pause" | "resume" | "stop",
  ) {
    setTimerAction(action);
    setTimerActionError("");

    try {
      const notes = timerNotes.trim();
      if (action === "start") {
        await projectsApi.startTimeEntry(projectId, { notes });
        toast.success("Timer started", {
          description: "Your project timer is now running.",
        });
      } else {
        const targetEntry = activeTimerOnThisProject
          ? activeTimeEntry
          : resumablePausedEntry;
        if (!targetEntry) return;
        if (action === "pause") {
          await projectsApi.pauseTimeEntry(projectId, targetEntry.id, { notes });
          toast.success("Timer paused", {
            description: "Elapsed time was saved for this segment.",
          });
        }
        if (action === "resume") {
          await projectsApi.resumeTimeEntry(projectId, targetEntry.id, {
            notes,
          });
          toast.success("Timer resumed", {
            description: "A new time segment is now running.",
          });
        }
        if (action === "stop") {
          await projectsApi.stopTimeEntry(projectId, targetEntry.id, { notes });
          toast.success("Timer stopped", {
            description: "Project actual hours were recalculated.",
          });
        }
      }
      setTimerNotes("");
      await loadProjectDetail();
    } catch (error) {
      setTimerActionError(
        error instanceof Error ? error.message : "Unable to update timer.",
      );
    } finally {
      setTimerAction(null);
    }
  }

  function openCreateDocumentDialog() {
    setEditingDocument(null);
    setDocumentForm(emptyDocumentForm());
    setDocumentActionError("");
    setIsDocumentDialogOpen(true);
  }

  function openEditDocumentDialog(document: ProjectDocument) {
    setEditingDocument(document);
    setDocumentForm({
      title: document.title,
      description: document.description ?? "",
      type: document.type,
      mode: document.format,
      textContent: document.textContent ?? "",
      file: null,
    });
    setDocumentActionError("");
    setIsDocumentDialogOpen(true);
  }

  async function handleSaveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDocumentActionError("");

    const title = documentForm.title.trim();
    const description = documentForm.description.trim();
    const textContent = documentForm.textContent.trim();

    if (!title) {
      setDocumentActionError("Document title is required.");
      return;
    }

    if (!editingDocument && documentForm.mode === "TEXT" && !textContent) {
      setDocumentActionError("Add text content or switch to file upload.");
      return;
    }

    if (!editingDocument && documentForm.mode === "FILE" && !documentForm.file) {
      setDocumentActionError("Choose one file to upload.");
      return;
    }

    if (
      !editingDocument &&
      documentForm.file &&
      documentForm.file.size > MAX_DOCUMENT_FILE_SIZE_BYTES
    ) {
      setDocumentActionError("Choose a file up to 25 MB.");
      return;
    }

    setIsSavingDocument(true);
    try {
      const saved = editingDocument
        ? await projectsApi.updateDocument(projectId, editingDocument.id, {
            title,
            description,
            textContent: editingDocument.format === "TEXT" ? textContent : undefined,
          })
        : await projectsApi.createDocument(projectId, {
            title,
            type: documentForm.type,
            description,
            textContent: documentForm.mode === "TEXT" ? textContent : undefined,
            file: documentForm.mode === "FILE" ? documentForm.file : null,
          });

      toast.success(editingDocument ? "Document updated" : "Document added", {
        description: saved.title,
      });
      setIsDocumentDialogOpen(false);
      setEditingDocument(null);
      setDocumentForm(emptyDocumentForm());
      await loadProjectDetail();
    } catch (error) {
      setDocumentActionError(
        error instanceof Error ? error.message : "Unable to save document.",
      );
    } finally {
      setIsSavingDocument(false);
    }
  }

  async function handleRemoveDocument() {
    if (!removingDocument) return;
    setIsRemovingDocument(true);
    setDocumentActionError("");

    try {
      await projectsApi.removeDocument(projectId, removingDocument.id);
      toast.success("Document removed", {
        description: removingDocument.title,
      });
      setRemovingDocument(null);
      await loadProjectDetail();
    } catch (error) {
      setDocumentActionError(
        error instanceof Error ? error.message : "Unable to remove document.",
      );
    } finally {
      setIsRemovingDocument(false);
    }
  }

  if (!currentUser || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Project unavailable</AlertTitle>
        <AlertDescription>{error || "Unable to load project."}</AlertDescription>
      </Alert>
    );
  }

  const selectedSummaryMember = timeFilterMembers.find(
    (member) => member.userId === projectTimeSummary?.userId,
  );
  const projectSummaryLabel = selectedSummaryMember
    ? userDisplayName(selectedSummaryMember.user)
    : projectTimeSummary?.userId === currentUser?.id
      ? userDisplayName(currentUser)
      : "selected team member";
  const managerNeedsSummaryMember =
    (currentUser.role === "SYSTEM_ADMIN" ||
      currentUser.role === "ADMIN" ||
      currentUser.role === "PROJECT_MANAGER") &&
    appliedTimeFilters.userId === ALL_VALUE;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <Button
          variant="ghost"
          className="-ml-3 mb-4"
          onClick={() => router.push("/dashboard/projects")}
        >
          <ArrowLeft size={18} />
          Projects
        </Button>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(project.status)}>
                {formatEnumLabel(project.status)}
              </Badge>
              {project.archivedAt ? <Badge>Archived</Badge> : null}
              {project.priority ? (
                <Badge tone={priorityTone(project.priority)}>
                  {formatEnumLabel(project.priority)} priority
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-4 max-w-4xl break-words text-3xl font-extrabold tracking-tight">
              {project.name}
            </h1>
            <p className="mt-2 max-w-4xl text-base font-medium leading-7 text-muted-foreground">
              {project.description || "No project description has been added yet."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {canManageStaffing ? (
              <ProjectEditDialog
                project={project}
                canEdit={canManageStaffing}
                onSaved={(updatedProject) => setProject(updatedProject)}
              />
            ) : null}
            <div className="grid min-w-[240px] gap-2 rounded-md border border-border bg-muted p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold text-muted-foreground">Client</span>
                <span className="break-words text-right font-extrabold">
                  {project.client?.name || "Client"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold text-muted-foreground">Created</span>
                <span className="font-extrabold">{formatDate(project.createdAt)}</span>
              </div>
            </div>
        </div>
        </div>
      </section>

      <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
        <div
          className="flex gap-1 overflow-x-auto"
          role="tablist"
          aria-label="Project details"
        >
          {PROJECT_DETAIL_TABS
            .filter((tab) => tab.id === "overview" || tab.id === "files" || canViewInternalProject)
            .map((tab) => (
              <button
                key={tab.id}
                id={`project-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeProjectTab === tab.id}
                aria-controls={`project-panel-${tab.id}`}
                tabIndex={activeProjectTab === tab.id ? 0 : -1}
                onClick={() => setActiveProjectTab(tab.id)}
                onKeyDown={(event) => {
                  const visibleTabs = PROJECT_DETAIL_TABS.filter(
                    (visibleTab) =>
                      visibleTab.id === "overview" ||
                      visibleTab.id === "files" ||
                      canViewInternalProject,
                  );
                  const currentIndex = visibleTabs.findIndex(
                    (visibleTab) => visibleTab.id === tab.id,
                  );
                  let nextIndex = currentIndex;

                  if (event.key === "ArrowRight") {
                    nextIndex = (currentIndex + 1) % visibleTabs.length;
                  } else if (event.key === "ArrowLeft") {
                    nextIndex =
                      (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
                  } else if (event.key === "Home") {
                    nextIndex = 0;
                  } else if (event.key === "End") {
                    nextIndex = visibleTabs.length - 1;
                  } else {
                    return;
                  }

                  event.preventDefault();
                  setActiveProjectTab(visibleTabs[nextIndex].id);
                }}
                className={`min-w-fit cursor-pointer rounded-md px-4 py-2.5 text-sm font-extrabold transition-colors ${
                  activeProjectTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
        </div>
      </div>

      <div
        id="project-panel-overview"
        role="tabpanel"
        aria-labelledby="project-tab-overview"
        hidden={activeProjectTab !== "overview"}
        className="space-y-6"
      >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs font-extrabold uppercase text-muted-foreground">
                Project types
              </div>
              {canManageStaffing ? (
                <ProjectTypesEditDialog
                  project={project}
                  canEdit={canManageStaffing}
                  onSaved={(updatedProject) => setProject(updatedProject)}
                />
              ) : null}
            </div>
            <div className="text-sm font-bold">
              {typeTags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {typeTags.map((type) => (
                    <Badge key={type}>{formatEnumLabel(type)}</Badge>
                  ))}
                </div>
              ) : (
                "No types"
              )}
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <DetailItem
            label="Planned start"
            value={
              <span className="flex items-center gap-2">
                <CalendarClock size={16} className="text-muted-foreground" />
                {formatDate(project.plannedStartDate)}
              </span>
            }
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <DetailItem label="Deadline" value={formatDate(project.deadline)} />
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <DetailItem
            label="Created by"
            value={project.createdBy?.name || "Workspace user"}
          />
        </div>
      </section>

      {isClient ? (
        <Alert>
          <AlertTitle>Client project view</AlertTitle>
          <AlertDescription>
            This view shows client-safe project status and timing details. Internal
            staffing and activity history are visible to staff only.
          </AlertDescription>
        </Alert>
      ) : null}

      {isClient ? (
        <ClientFeedbackSection
          project={project}
          canSubmit
          isClient
          onSubmitted={loadProjectDetail}
        />
      ) : null}

      {canViewInternalProject ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Flag size={20} className="text-primary" />
              <div>
                <h2 className="text-lg font-extrabold">Status controls</h2>
                <p className="text-sm font-medium text-muted-foreground">
                  {STATUS_HELP_TEXT[project.status]}
                </p>
              </div>
            </div>

            <div className="mb-5 rounded-md border border-border bg-muted/30 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  Status progression
                </span>
                <Badge tone={statusTone(project.status)}>Current</Badge>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {completedStatuses.map((status) => (
                  <div
                    key={status}
                    className="flex min-w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"
                  >
                    <CheckCircle2 size={14} />
                    {formatEnumLabel(status)}
                  </div>
                ))}
                {completedStatuses.length ? (
                  <span className="text-muted-foreground">→</span>
                ) : null}
                <div className="flex min-w-fit items-center gap-1.5 rounded-full border-2 border-primary bg-primary px-3 py-1.5 text-xs font-extrabold text-primary-foreground shadow-sm">
                  <Flag size={14} />
                  {formatEnumLabel(project.status)}
                </div>
              </div>

              <div className="mt-3 text-xs font-semibold text-muted-foreground">
                {completedStatuses.length
                  ? `${completedStatuses.length} previous status${completedStatuses.length === 1 ? "" : "es"} completed.`
                  : "Project has not completed a previous status transition yet."}
              </div>
            </div>

            {statusOptions.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-5 text-sm font-semibold text-muted-foreground">
                {project.status === "COMPLETED" || project.status === "CANCELLED"
                  ? "This project has reached a terminal status. No upcoming transitions are available."
                  : "No status transitions are currently available for this project."}
              </div>
            ) : (
              <div>
                <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  Upcoming available statuses
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((status) => (
                    <Button
                      key={status}
                      variant={status === "CANCELLED" ? "outline" : "secondary"}
                      onClick={() => openStatusDialog(status)}
                    >
                      {formatEnumLabel(status)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {project.status === "ON_HOLD" && project.onHoldReason ? (
              <Alert className="mt-4" variant="warning">
                <AlertTitle>Hold reason</AlertTitle>
                <AlertDescription>{project.onHoldReason}</AlertDescription>
              </Alert>
            ) : null}

            {project.status === "CANCELLED" && project.cancellationReason ? (
              <Alert className="mt-4" variant="destructive">
                <AlertTitle>Cancellation reason</AlertTitle>
                <AlertDescription>{project.cancellationReason}</AlertDescription>
              </Alert>
            ) : null}

            {project.archivedAt ? (
              <Alert className="mt-4">
                <Archive size={18} />
                <AlertTitle>Project archived</AlertTitle>
                <AlertDescription>
                  This project is preserved for historical reference and can no
                  longer be changed until it is restored.
                </AlertDescription>
              </Alert>
            ) : null}

            {canRestoreProject ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-4">
                <div>
                  <div className="font-extrabold">Restore this project</div>
                  <div className="mt-1 text-sm font-semibold text-muted-foreground">
                    Return it to Ready For Work and clear its archived state.
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRestoreActionError("");
                    setIsRestoreDialogOpen(true);
                  }}
                >
                  <RefreshCw size={18} />
                  Restore project
                </Button>
              </div>
            ) : null}

            {canArchiveProject ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50/60 p-4 dark:border-red-950 dark:bg-red-950/20">
                <div>
                  <div className="font-extrabold">Archive this project</div>
                  <div className="mt-1 text-sm font-semibold text-muted-foreground">
                    Keep this project available for historical reference.
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200"
                  onClick={() => {
                    setArchiveActionError("");
                    setIsArchiveDialogOpen(true);
                  }}
                >
                  <Archive size={18} />
                  Archive project
                </Button>
              </div>
            ) : null}
          </div>

          {canManagePriority ? (
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-extrabold">Priority</h2>
                <p className="text-sm font-medium text-muted-foreground">
                  Urgent and Critical need a rush reason.
                </p>
              </div>
              <form className="space-y-4" onSubmit={handleUpdatePriority}>
                <div className="space-y-2">
                  <label className="text-sm font-bold">Priority level</label>
                  <Select
                    value={selectedPriority}
                    onValueChange={(value) =>
                      setSelectedPriority(value as ProjectPriority)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projectPriorities.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {formatEnumLabel(priority)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPriorityRequiresReason ? (
                  <div className="space-y-2">
                    <label className="text-sm font-bold">Rush reason</label>
                    <Textarea
                      value={rushReason}
                      onChange={(event) => setRushReason(event.target.value)}
                      placeholder="Why does this project need elevated priority?"
                      rows={3}
                    />
                  </div>
                ) : null}

                {project.rushReason ? (
                  <div className="rounded-md border border-border bg-muted p-3 text-xs font-semibold leading-5 text-muted-foreground">
                    Current rush reason: {project.rushReason}
                  </div>
                ) : null}

                {priorityActionError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{priorityActionError}</AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  disabled={
                    isUpdatingPriority ||
                    selectedPriority === project.priority ||
                    (selectedPriorityRequiresReason && !rushReason.trim())
                  }
                >
                  {isUpdatingPriority ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Flag size={18} />
                  )}
                  {isUpdatingPriority ? "Saving..." : "Save priority"}
                </Button>
              </form>
            </div>
          ) : null}
        </section>
      ) : null}

      </div>

      {canViewInternalProject ? (
        <div
          id="project-panel-delivery"
          role="tabpanel"
          aria-labelledby="project-tab-delivery"
          hidden={activeProjectTab !== "delivery"}
          className="space-y-6"
        >

      <InternalReviewsSection
        project={project}
        canSubmit={canManageStaffing}
        onReviewed={loadProjectDetail}
      />

      <ClientFeedbackSection
        project={project}
        canSubmit={canManageStaffing}
        isClient={false}
        onSubmitted={loadProjectDetail}
      />

      {canViewInternalProject ? (
        <AdditionalRequirementsSection project={project} canManage={canManageStaffing} />
      ) : null}

      {canViewInternalProject ? (
      <BlockersSection
          project={project}
          activeMembers={activeMembers}
          canReport={Boolean(
            currentUser &&
              (currentUser.role === "SYSTEM_ADMIN" ||
                currentUser.role === "ADMIN" ||
                activeMembers.some((member) => member.userId === currentUser.id)),
          )}
          canManageReasons={Boolean(
            currentUser &&
              (currentUser.role === "SYSTEM_ADMIN" ||
                currentUser.role === "ADMIN" ||
                currentUser.role === "PROJECT_MANAGER"),
          )}
        />
      ) : null}

      <ProjectReportSection project={project} />

      </div>
      ) : null}

      <div
        id="project-panel-files"
        role="tabpanel"
        aria-labelledby="project-tab-files"
        hidden={activeProjectTab !== "files"}
        className="space-y-6"
      >
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-primary" />
                <div>
                  <h2 className="text-lg font-extrabold">Documents</h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    Store project files, notes, credentials, assets, and client
                    deliverables.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {isClient ? (
                  <Badge tone="primary">Deliverables only</Badge>
                ) : (
                  <Select
                    value={documentFilter}
                    onValueChange={(value) =>
                      setDocumentFilter(value as ProjectDocumentType | typeof ALL_VALUE)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[220px]">
                      <SelectValue placeholder="All document types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>All document types</SelectItem>
                      {projectDocumentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {DOCUMENT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {canManageDocuments ? (
                  <Button onClick={openCreateDocumentDialog}>
                    <FilePlus2 size={18} />
                    Add document
                  </Button>
                ) : null}
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center">
                <FileText size={38} className="mx-auto text-muted-foreground" />
                <h3 className="mt-4 text-lg font-extrabold">
                  No documents found
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-muted-foreground">
                  {canManageDocuments
                    ? "Add a project document to keep requirements, credentials, assets, and deliverables organized."
                    : "No documents are visible to your account for this project yet."}
                </p>
                {canManageDocuments ? (
                  <Button className="mt-4" onClick={openCreateDocumentDialog}>
                    <FilePlus2 size={18} />
                    Add document
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-muted text-xs font-bold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Document</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Format</th>
                      <th className="px-4 py-3">Uploaded</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {documents.map((document) => (
                      <tr key={document.id} className="align-top">
                        <td className="max-w-[320px] px-4 py-4">
                          <div className="break-words font-extrabold">
                            {document.title}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-muted-foreground">
                            {document.description || "No description added"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge>{DOCUMENT_TYPE_LABELS[document.type]}</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold">{document.format}</div>
                          <div className="mt-1 text-xs font-semibold text-muted-foreground">
                            {document.format === "FILE"
                              ? formatFileSize(document.fileSizeBytes)
                              : "Typed text"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold">
                            {formatDate(document.createdAt)}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-muted-foreground">
                            {document.uploadedBy?.name || "Workspace user"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewingDocument(document)}
                            >
                              <Eye size={16} />
                              View
                            </Button>
                            {document.fileUrl ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  window.open(document.fileUrl ?? "", "_blank")
                                }
                              >
                                <Download size={16} />
                                Open
                              </Button>
                            ) : null}
                            {canManageDocuments ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditDocumentDialog(document)}
                                >
                                  <Pencil size={16} />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setDocumentActionError("");
                                    setRemovingDocument(document);
                                  }}
                                >
                                  <Trash2 size={16} />
                                  Delete
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </section>

      </div>

      {canViewInternalProject ? (
        <>
          {canViewTimeTracking ? (
            <div
              id="project-panel-time"
              role="tabpanel"
              aria-labelledby="project-tab-time"
              hidden={activeProjectTab !== "time"}
              className="space-y-6"
            >
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-center gap-2">
                  <Timer size={20} className="text-primary" />
                  <div>
                    <h2 className="text-lg font-extrabold">Time tracking</h2>
                    <p className="text-sm font-medium text-muted-foreground">
                      Track work sessions and review finalized project time.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[420px]">
                  <div className="rounded-md border border-border bg-muted p-3">
                    <div className="text-xs font-extrabold uppercase text-muted-foreground">
                      Estimated
                    </div>
                    <div className="mt-1 text-xl font-extrabold">
                      {formatHours(project.estimatedHours)}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-muted p-3">
                    <div className="text-xs font-extrabold uppercase text-muted-foreground">
                      Actual
                    </div>
                    <div className="mt-1 text-xl font-extrabold">
                      {formatHours(project.actualHours ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-muted p-3">
                    <div className="text-xs font-extrabold uppercase text-muted-foreground">
                      Remaining
                    </div>
                    <div className="mt-1 text-xl font-extrabold">
                      {formatHours(project.remainingHours)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="space-y-4">
                  {canManageEstimatedHours ? (
                    <form
                      className="rounded-md border border-border p-4"
                      onSubmit={handleSaveEstimatedHours}
                    >
                      <div className="mb-3">
                        <h3 className="text-base font-extrabold">
                          Estimated hours
                        </h3>
                        <p className="text-sm font-medium text-muted-foreground">
                          Set the project estimate used for remaining hours.
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Input
                          type="number"
                          min="0"
                          step="0.25"
                          value={estimatedHoursInput}
                          onChange={(event) =>
                            setEstimatedHoursInput(event.target.value)
                          }
                          placeholder="40"
                        />
                        <Button
                          type="submit"
                          disabled={isSavingEstimatedHours || !estimatedHoursInput}
                        >
                          {isSavingEstimatedHours ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Timer size={18} />
                          )}
                          {isSavingEstimatedHours ? "Saving..." : "Save"}
                        </Button>
                      </div>
                      {estimatedHoursError ? (
                        <Alert className="mt-3" variant="destructive">
                          <AlertDescription>{estimatedHoursError}</AlertDescription>
                        </Alert>
                      ) : null}
                    </form>
                  ) : null}

                  {canTrackTime ? (
                    <div className="rounded-md border border-border p-4">
                      <div className="mb-3">
                        <h3 className="text-base font-extrabold">My timer</h3>
                        <p className="text-sm font-medium text-muted-foreground">
                          Only one timer can run across all projects.
                        </p>
                      </div>

                      {activeTimerOnAnotherProject ? (
                        <Alert variant="warning">
                          <AlertTitle>Timer running elsewhere</AlertTitle>
                          <AlertDescription>
                            You already have a timer running on{" "}
                            {activeTimeEntry?.project?.name || "another project"}.
                            Pause or stop it before starting this one.
                          </AlertDescription>
                        </Alert>
                      ) : activeTimerOnThisProject ? (
                        <Alert variant="success">
                          <AlertTitle>Timer running</AlertTitle>
                          <AlertDescription>
                            Current segment elapsed:{" "}
                            {formatMinutes(activeTimerElapsedMinutes)}
                          </AlertDescription>
                        </Alert>
                      ) : resumablePausedEntry ? (
                        <Alert>
                          <AlertTitle>Timer paused</AlertTitle>
                          <AlertDescription>
                            Resume to continue this session or stop to finalize it.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert>
                          <AlertTitle>No timer running</AlertTitle>
                          <AlertDescription>
                            Start a timer when you begin work on this project.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="mt-4 space-y-2">
                        <label className="text-sm font-bold">Notes</label>
                        <Textarea
                          value={timerNotes}
                          onChange={(event) => setTimerNotes(event.target.value)}
                          placeholder="Optional note for this time segment."
                          rows={3}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {(!activeTimeEntry && !resumablePausedEntry) ||
                        activeTimerOnAnotherProject ? (
                          <Button
                            disabled={Boolean(timerAction) || activeTimerOnAnotherProject}
                            onClick={() => void handleTimerAction("start")}
                          >
                            {timerAction === "start" ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Play size={18} />
                            )}
                            Start
                          </Button>
                        ) : null}
                        {activeTimerOnThisProject ? (
                          <Button
                            variant="outline"
                            disabled={Boolean(timerAction)}
                            onClick={() => void handleTimerAction("pause")}
                          >
                            {timerAction === "pause" ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Pause size={18} />
                            )}
                            Pause
                          </Button>
                        ) : null}
                        {resumablePausedEntry ? (
                          <Button
                            variant="outline"
                            disabled={Boolean(timerAction)}
                            onClick={() => void handleTimerAction("resume")}
                          >
                            {timerAction === "resume" ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Play size={18} />
                            )}
                            Resume
                          </Button>
                        ) : null}
                        {activeTimeEntry?.projectId === projectId ||
                        resumablePausedEntry ? (
                          <Button
                            variant="outline"
                            disabled={Boolean(timerAction)}
                            onClick={() => void handleTimerAction("stop")}
                          >
                            {timerAction === "stop" ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Square size={18} />
                            )}
                            Stop
                          </Button>
                        ) : null}
                      </div>

                      {timerActionError ? (
                        <Alert className="mt-4" variant="destructive">
                          <AlertDescription>{timerActionError}</AlertDescription>
                        </Alert>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-md border border-border p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <ListFilter size={18} className="text-primary" />
                    <div>
                      <h3 className="text-base font-extrabold">Time log</h3>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total for current filters:{" "}
                        {formatMinutes(timeEntriesTotalMinutes)}
                      </p>
                    </div>
                  </div>

                  <form
                    className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
                    onSubmit={handleApplyTimeFilters}
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-bold">Member</label>
                      <Select value={timeUserFilter} onValueChange={setTimeUserFilter}>
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_VALUE}>All members</SelectItem>
                          {timeFilterMembers.map((member) => (
                            <SelectItem key={member.id} value={member.userId}>
                              {userDisplayName(member.user)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">Status</label>
                      <Select
                        value={timeStatusFilter}
                        onValueChange={(value) =>
                          setTimeStatusFilter(value as TimeEntryStatus | typeof ALL_VALUE)
                        }
                      >
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                          <SelectItem value="RUNNING">Running</SelectItem>
                          <SelectItem value="PAUSED">Paused</SelectItem>
                          <SelectItem value="STOPPED">Stopped</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">From</label>
                      <Input
                        type="date"
                        value={timeStartDate}
                        onChange={(event) => setTimeStartDate(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">To</label>
                      <Input
                        type="date"
                        value={timeEndDate}
                        onChange={(event) => setTimeEndDate(event.target.value)}
                      />
                    </div>
                    <div className="flex items-end justify-end gap-2 md:col-span-2 xl:col-span-4">
                      <Button type="submit" className="min-w-24">Apply</Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-w-24"
                        onClick={handleResetTimeFilters}
                      >
                        Reset
                      </Button>
                    </div>
                  </form>

                  {timeEntries.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm font-medium text-muted-foreground">
                      No time entries match the current filters.
                    </div>
                  ) : (
                    <div className="max-h-[480px] overflow-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-muted text-xs font-bold uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-3">Member</th>
                            <th className="px-3 py-3">Status</th>
                            <th className="px-3 py-3">Started</th>
                            <th className="px-3 py-3">Duration</th>
                            <th className="px-3 py-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {timeEntries.map((entry) => (
                            <tr key={entry.id} className="align-top">
                              <td className="px-3 py-3 font-bold">
                                {entry.user?.name || entry.user?.email || "User"}
                              </td>
                              <td className="px-3 py-3">
                                <Badge
                                  tone={
                                    entry.status === "RUNNING"
                                      ? "success"
                                      : entry.status === "PAUSED"
                                        ? "warning"
                                        : "default"
                                  }
                                >
                                  {formatEnumLabel(entry.status)}
                                </Badge>
                              </td>
                              <td className="px-3 py-3 font-semibold">
                                {formatDateTime(entry.startedAt)}
                              </td>
                              <td className="px-3 py-3 font-semibold">
                                {entry.status === "RUNNING"
                                  ? formatMinutes(elapsedMinutesSince(entry.startedAt))
                                  : formatMinutes(entry.durationMinutes)}
                              </td>
                              <td className="max-w-[220px] px-3 py-3">
                                <span className="line-clamp-2 text-xs font-semibold text-muted-foreground">
                                  {entry.notes || "No notes"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                {timeSummaryError ? (
                  <Alert className="xl:col-span-2" variant="destructive">
                    <AlertTitle>Time summaries unavailable</AlertTitle>
                    <AlertDescription>{timeSummaryError}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="rounded-md border border-border p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold">Daily hours</h3>
                      <p className="text-sm font-medium text-muted-foreground">
                        Finalized hours grouped by the day each segment started.
                      </p>
                    </div>
                    <CalendarClock size={18} className="text-primary" />
                  </div>

                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-border bg-muted p-3">
                      <div className="text-xs font-extrabold uppercase text-muted-foreground">
                        Filtered total
                      </div>
                      <div className="mt-1 text-xl font-extrabold">
                        {formatTrackedHours(dailyTimeSummary?.totalHours)}
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-muted p-3">
                      <div className="text-xs font-extrabold uppercase text-muted-foreground">
                        Scope
                      </div>
                      <div className="mt-1 truncate text-sm font-extrabold">
                        {dailyTimeSummary?.userId
                          ? userDisplayName(
                              timeFilterMembers.find(
                                (member) =>
                                  member.userId === dailyTimeSummary.userId,
                              )?.user,
                            )
                          : "Whole project team"}
                      </div>
                    </div>
                  </div>

                  {!dailyTimeSummary?.days.length ? (
                    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm font-medium text-muted-foreground">
                      No finalized hours match the current filters.
                    </div>
                  ) : (
                    <div className="max-h-[280px] overflow-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted text-xs font-bold uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-3">Date</th>
                            <th className="px-3 py-3 text-right">Hours</th>
                            <th className="px-3 py-3 text-right">Minutes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {dailyTimeSummary.days.map((day) => (
                            <tr key={day.date}>
                              <td className="px-3 py-3 font-bold">
                                {formatDate(day.date)}
                              </td>
                              <td className="px-3 py-3 text-right font-extrabold">
                                {formatTrackedHours(day.totalHours)}
                              </td>
                              <td className="px-3 py-3 text-right font-semibold text-muted-foreground">
                                {formatMinutes(day.totalMinutes)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-border p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold">Cross-project hours</h3>
                      <p className="text-sm font-medium text-muted-foreground">
                        {managerNeedsSummaryMember
                          ? "Select a developer or designer in the Member filter to compare their projects."
                          : `Finalized hours for ${projectSummaryLabel}, across projects.`}
                      </p>
                    </div>
                    <BriefcaseBusiness size={18} className="text-primary" />
                  </div>

                  {managerNeedsSummaryMember ? (
                    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm font-medium text-muted-foreground">
                      Choose a member and apply the filters to load their
                      cross-project summary.
                    </div>
                  ) : !projectTimeSummary?.projects.length ? (
                    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm font-medium text-muted-foreground">
                      No finalized hours match the current date filters.
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 rounded-md border border-border bg-muted p-3">
                        <div className="text-xs font-extrabold uppercase text-muted-foreground">
                          Across all projects
                        </div>
                        <div className="mt-1 text-xl font-extrabold">
                          {formatTrackedHours(projectTimeSummary.totalHours)}
                        </div>
                      </div>
                      <div className="max-h-[280px] overflow-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-muted text-xs font-bold uppercase text-muted-foreground">
                            <tr>
                              <th className="px-3 py-3">Project</th>
                              <th className="px-3 py-3 text-right">Hours</th>
                              <th className="px-3 py-3 text-right">Minutes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {projectTimeSummary.projects.map((summary) => (
                              <tr key={summary.projectId}>
                                <td className="max-w-[220px] truncate px-3 py-3 font-bold">
                                  {summary.projectName || "Unknown project"}
                                </td>
                                <td className="px-3 py-3 text-right font-extrabold">
                                  {formatTrackedHours(summary.totalHours)}
                                </td>
                                <td className="px-3 py-3 text-right font-semibold text-muted-foreground">
                                  {formatMinutes(summary.totalMinutes)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
            </div>
          ) : null}

          <div
            id="project-panel-team"
            role="tabpanel"
            aria-labelledby="project-tab-team"
            hidden={activeProjectTab !== "team"}
            className="space-y-6"
          >
          <ProjectSlackConnection
            project={project}
            canManage={canManageThisProject}
            onConnected={(updatedProject) => setProject(updatedProject)}
          />

          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck size={20} className="text-primary" />
                <div>
                  <h2 className="text-lg font-extrabold">Planning readiness</h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    Staffing completion can automatically move Planning projects
                    to Scheduled or Ready For Work.
                  </p>
                </div>
              </div>
              <div className="grid gap-3">
                <ReadinessItem
                  label="Client selected"
                  description={project.client?.name || "Project has a client."}
                  ready={Boolean(project.clientId || project.client)}
                />
                <ReadinessItem
                  label="Project type tagged"
                  description={
                    typeTags.length
                      ? `${typeTags.length} type${typeTags.length === 1 ? "" : "s"} selected.`
                      : "At least one project type is required."
                  }
                  ready={typeTags.length > 0}
                />
                <ReadinessItem
                  label="Project Manager assigned"
                  description={
                    hasProjectManager
                      ? "At least one active PM is assigned."
                      : "Assign a PM before the project leaves Planning."
                  }
                  ready={hasProjectManager}
                />
                <ReadinessItem
                  label="Developer or Designer assigned"
                  description={
                    hasMaker
                      ? "Execution coverage is assigned."
                      : "Assign at least one Developer or Designer."
                  }
                  ready={hasMaker}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Users size={20} className="text-primary" />
                <div>
                  <h2 className="text-lg font-extrabold">Active team</h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active members can access the internal project history and project Slack channel.
                  </p>
                </div>
              </div>

              {project.slackChannelId && canManageThisProject && unmappedSlackMemberCount > 0 ? (
                <Alert className="mb-4" variant="warning">
                  <MessageSquareText size={18} />
                  <AlertTitle>Slack identity mapping needs attention</AlertTitle>
                  <AlertDescription>
                    {unmappedSlackMemberCount} active member
                    {unmappedSlackMemberCount === 1 ? " does" : "s do"} not have a cached Slack user ID.
                    Add the Slack user ID from the Users screen, then retry their invite here.
                  </AlertDescription>
                </Alert>
              ) : null}

              {activeMembers.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center">
                  <UserRound
                    size={34}
                    className="mx-auto text-muted-foreground"
                  />
                  <h3 className="mt-3 text-base font-extrabold">
                    No active team members assigned
                  </h3>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Assign a PM and at least one Developer or Designer to make the
                    project operational.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeMembers.map((member) => {
                    const mappedSlackUserId = users.find(
                      (user) => user.id === member.userId,
                    )?.slackUserId;
                    const inviteState = slackInviteStates[member.id];
                    const inviteStatus = inviteState
                      ? inviteState.status === "INVITED"
                        ? "Invite confirmed"
                        : inviteState.status === "NEEDS_ATTENTION"
                          ? "Needs attention"
                          : "Resync failed"
                      : mappedSlackUserId
                        ? "Account mapped · invite not verified"
                        : users.length
                          ? "Account not mapped"
                          : "Invite status not available";
                    const inviteTone = inviteState?.status === "INVITED"
                      ? "success"
                      : inviteState?.status === "FAILED" || !mappedSlackUserId
                        ? "warning"
                        : "default";

                    return (
                      <div
                        key={member.id}
                        className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold">
                            {userDisplayName(member.user)}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge>{MEMBER_ROLE_LABELS[member.role]}</Badge>
                            <span className="text-xs font-semibold text-muted-foreground">
                              Joined {formatDate(member.joinedAt)}
                            </span>
                          </div>
                          {project.slackChannelId ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge tone={inviteTone}>
                                <MessageSquareText size={14} />
                                {inviteStatus}
                              </Badge>
                              {inviteState ? (
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {inviteState.message}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          {project.slackChannelId && canManageThisProject ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={Boolean(resyncingMemberId)}
                              onClick={() => void handleResyncSlackInvite(member)}
                            >
                              {resyncingMemberId === member.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <RefreshCw size={16} />
                              )}
                              {resyncingMemberId === member.id
                                ? "Resyncing..."
                                : inviteState?.status === "NEEDS_ATTENTION" ||
                                    inviteState?.status === "FAILED"
                                  ? "Retry Slack invite"
                                  : "Resync Slack invite"}
                            </Button>
                          ) : null}
                          {canManageStaffing ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRemovingMember(member)}
                            >
                              <Trash2 size={16} />
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {canManageStaffing ? (
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-extrabold">Add team member</h2>
                <p className="text-sm font-medium text-muted-foreground">
                  Workload is checked before assignment. Overload warnings are
                  advisory and do not block staffing.
                </p>
              </div>
              <form
                className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto]"
                onSubmit={handleAddMember}
              >
                <div className="space-y-2">
                  <label className="text-sm font-bold">Project role</label>
                  <Select
                    value={memberRole}
                    onValueChange={(value) =>
                      handleMemberRoleChange(value as ProjectRole)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBER_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {MEMBER_ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold">User</label>
                  <Select
                    value={memberUserId}
                    onValueChange={(value) => void handleMemberUserChange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${MEMBER_ROLE_LABELS[memberRole]}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignableUsers.length === 0 ? (
                    <p className="text-xs font-semibold text-muted-foreground">
                      No active unassigned {MEMBER_ROLE_LABELS[memberRole]} users
                      are available.
                    </p>
                  ) : null}
                </div>

                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={isAddingMember || !memberUserId}
                    className="w-full lg:w-auto"
                  >
                    {isAddingMember ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Plus size={18} />
                    )}
                    {isAddingMember ? "Adding..." : "Add member"}
                  </Button>
                </div>
              </form>

              {workloadLoading ? (
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  Checking workload...
                </div>
              ) : workloadCount !== null ? (
                <Alert
                  className="mt-4"
                  variant={workloadOverloaded ? "warning" : "success"}
                >
                  <AlertDescription>
                    This user is currently assigned to {workloadCount} active
                    project{workloadCount === 1 ? "" : "s"}.
                    {workloadOverloaded
                      ? " Recommended load is 3 active projects, so review capacity before assigning."
                      : " Workload is within the recommended range."}
                  </AlertDescription>
                </Alert>
              ) : null}

              {memberActionError ? (
                <Alert className="mt-4" variant="destructive">
                  <AlertDescription>{memberActionError}</AlertDescription>
                </Alert>
              ) : null}
            </section>
          ) : null}

          </div>

          <div
            id="project-panel-history"
            role="tabpanel"
            aria-labelledby="project-tab-history"
            hidden={activeProjectTab !== "history"}
            className="space-y-6"
          >
          <ProjectActivityTimeline project={project} />
          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <History size={20} className="text-primary" />
                <div>
                  <h2 className="text-lg font-extrabold">Activity timeline</h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    Newest project activity is shown first.
                  </p>
                </div>
              </div>
              {activities.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm font-medium text-muted-foreground">
                  No project activity has been recorded yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1 border-b border-border pb-4 last:border-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{activityLabel(activity.type)}</Badge>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {formatDateTime(activity.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-6">
                          {activity.message || "Project activity recorded."}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          By {activity.user?.name || activity.user?.email || "System"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activityLoading ? (
                <div
                  className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 size={16} className="animate-spin" />
                  Loading activity…
                </div>
              ) : null}
              <div className="mt-5">
                <PaginationControls
                  page={activityPage}
                  total={activityTotal}
                  pageSize={ACTIVITY_PAGE_SIZE}
                  disabled={activityLoading}
                  onPageChange={loadActivityPage}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BriefcaseBusiness size={20} className="text-primary" />
                <div>
                  <h2 className="text-lg font-extrabold">Membership history</h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    Removed members stay in history with their left date.
                  </p>
                </div>
              </div>
              {formerMembers.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm font-medium text-muted-foreground">
                  No previous team members
                </div>
              ) : (
                <div className="space-y-3">
                  {formerMembers.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-md border border-border bg-muted/30 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-extrabold">
                          {userDisplayName(member.user)}
                        </div>
                        <Badge tone="default">{MEMBER_ROLE_LABELS[member.role]}</Badge>
                      </div>
                      <div className="mt-2 text-xs font-semibold text-muted-foreground">
                        Joined {formatDate(member.joinedAt)} · Left{" "}
                        {formatDate(member.leftAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          <ProjectDailyWorkReportsSection projectId={projectId} members={members} />
          </div>
        </>
      ) : null}

      <Dialog
        open={isDocumentDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isSavingDocument) {
            setIsDocumentDialogOpen(false);
            setEditingDocument(null);
            setDocumentForm(emptyDocumentForm());
            setDocumentActionError("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDocument ? "Edit document" : "Add document"}
            </DialogTitle>
            <DialogDescription>
              {editingDocument
                ? "Update document metadata. Uploaded file content cannot be replaced here."
                : "Add one typed document or upload one file up to 25 MB."}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSaveDocument}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold">Title</label>
                <Input
                  value={documentForm.title}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Staging server credentials"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold">Type</label>
                <Select
                  value={documentForm.type}
                  disabled={Boolean(editingDocument)}
                  onValueChange={(value) =>
                    setDocumentForm((current) => ({
                      ...current,
                      type: value as ProjectDocumentType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projectDocumentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {DOCUMENT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editingDocument ? (
              <div className="space-y-2">
                <label className="text-sm font-bold">Format</label>
                <Select
                  value={documentForm.mode}
                  onValueChange={(value) =>
                    setDocumentForm((current) => ({
                      ...current,
                      mode: value as "TEXT" | "FILE",
                      file: null,
                      textContent: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Typed text</SelectItem>
                    <SelectItem value="FILE">File upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-bold">Description</label>
              <Textarea
                value={documentForm.description}
                onChange={(event) =>
                  setDocumentForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional context for this document."
                rows={3}
              />
            </div>

            {documentForm.mode === "TEXT" || editingDocument?.format === "TEXT" ? (
              <div className="space-y-2">
                <label className="text-sm font-bold">Text content</label>
                <Textarea
                  value={documentForm.textContent}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,
                      textContent: event.target.value,
                    }))
                  }
                  placeholder="Paste credentials, notes, or requirement text."
                  rows={6}
                  disabled={Boolean(editingDocument && editingDocument.format !== "TEXT")}
                />
              </div>
            ) : null}

            {!editingDocument && documentForm.mode === "FILE" ? (
              <div className="space-y-2">
                <label className="text-sm font-bold">File</label>
                <input
                  type="file"
                  accept={DOCUMENT_ACCEPT}
                  className="block w-full rounded-md border border-border bg-input px-3.5 py-2.5 text-sm font-semibold file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-bold file:text-primary-foreground"
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,
                      file: event.target.files?.[0] ?? null,
                    }))
                  }
                />
                <p className="text-xs font-semibold leading-5 text-muted-foreground">
                  Supports images, PDF, Office files, ZIP, TXT, and CSV up to 25 MB.
                </p>
              </div>
            ) : null}

            {documentActionError ? (
              <Alert variant="destructive">
                <AlertDescription>{documentActionError}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSavingDocument}
                onClick={() => {
                  setIsDocumentDialogOpen(false);
                  setEditingDocument(null);
                  setDocumentForm(emptyDocumentForm());
                  setDocumentActionError("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingDocument}>
                {isSavingDocument ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <FilePlus2 size={18} />
                )}
                {isSavingDocument ? "Saving..." : "Save document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewingDocument)}
        onOpenChange={(open) => {
          if (!open) setViewingDocument(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingDocument?.title || "Document"}</DialogTitle>
            <DialogDescription>
              {viewingDocument
                ? `${DOCUMENT_TYPE_LABELS[viewingDocument.type]} · ${viewingDocument.format}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {viewingDocument ? (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-md border border-border bg-muted p-4 sm:grid-cols-2">
                <DetailItem
                  label="Uploaded"
                  value={formatDateTime(viewingDocument.createdAt)}
                />
                <DetailItem
                  label="Uploaded by"
                  value={viewingDocument.uploadedBy?.name || "Workspace user"}
                />
                <DetailItem
                  label="Format"
                  value={
                    viewingDocument.format === "FILE"
                      ? formatFileSize(viewingDocument.fileSizeBytes)
                      : "Typed text"
                  }
                />
                <DetailItem
                  label="Type"
                  value={DOCUMENT_TYPE_LABELS[viewingDocument.type]}
                />
              </div>

              {viewingDocument.description ? (
                <div>
                  <div className="text-xs font-extrabold uppercase text-muted-foreground">
                    Description
                  </div>
                  <p className="mt-2 whitespace-pre-wrap rounded-md border border-border p-3 text-sm font-semibold leading-6">
                    {viewingDocument.description}
                  </p>
                </div>
              ) : null}

              {viewingDocument.format === "TEXT" ? (
                <div>
                  <div className="text-xs font-extrabold uppercase text-muted-foreground">
                    Text content
                  </div>
                  <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-4 text-sm font-semibold leading-6">
                    {viewingDocument.textContent || "No text content."}
                  </pre>
                </div>
              ) : viewingDocument.fileUrl ? (
                <Button
                  onClick={() => window.open(viewingDocument.fileUrl ?? "", "_blank")}
                >
                  <Download size={18} />
                  Open file
                </Button>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingDocument(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(removingDocument)}
        onOpenChange={(open) => {
          if (!open && !isRemovingDocument) setRemovingDocument(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              This removes the document from active project views while preserving
              project history.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted p-4">
            <div className="font-extrabold">{removingDocument?.title}</div>
            <div className="mt-1 text-sm font-semibold text-muted-foreground">
              {removingDocument ? DOCUMENT_TYPE_LABELS[removingDocument.type] : ""}
            </div>
          </div>
          {documentActionError ? (
            <Alert variant="destructive">
              <AlertDescription>{documentActionError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isRemovingDocument}
              onClick={() => setRemovingDocument(null)}
            >
              Cancel
            </Button>
            <Button disabled={isRemovingDocument} onClick={handleRemoveDocument}>
              {isRemovingDocument ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
              {isRemovingDocument ? "Deleting..." : "Delete document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(nextStatus)}
        onOpenChange={(open) => {
          if (!open && !isUpdatingStatus) {
            setNextStatus(null);
            setStatusReason("");
            setStatusActionError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Move to {nextStatus ? formatEnumLabel(nextStatus) : "next status"}?
            </DialogTitle>
            <DialogDescription>
              This will update the project status and add a project activity
              entry to the timeline.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border bg-muted p-4">
            <div className="text-xs font-extrabold uppercase text-muted-foreground">
              Current status
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(project.status)}>
                {formatEnumLabel(project.status)}
              </Badge>
              <span className="text-sm font-bold text-muted-foreground">to</span>
              {nextStatus ? (
                <Badge tone={statusTone(nextStatus)}>
                  {formatEnumLabel(nextStatus)}
                </Badge>
              ) : null}
            </div>
          </div>

          {nextStatus === "ON_HOLD" || nextStatus === "CANCELLED" ? (
            <div className="space-y-2">
              <label className="text-sm font-bold">
                {nextStatus === "ON_HOLD" ? "Hold reason" : "Cancellation reason"}
              </label>
              <Textarea
                value={statusReason}
                onChange={(event) => {
                  setStatusReason(event.target.value);
                  setStatusActionError("");
                }}
                placeholder={
                  nextStatus === "ON_HOLD"
                    ? "What is blocking progress?"
                    : "Why is this project being cancelled?"
                }
                rows={4}
              />
            </div>
          ) : null}

          {statusActionError ? (
            <Alert variant="destructive">
              <AlertDescription>{statusActionError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={isUpdatingStatus}
              onClick={() => {
                setNextStatus(null);
                setStatusReason("");
                setStatusActionError("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isUpdatingStatus ||
                ((nextStatus === "ON_HOLD" || nextStatus === "CANCELLED") &&
                  !statusReason.trim())
              }
              onClick={handleUpdateStatus}
            >
              {isUpdatingStatus ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              {isUpdatingStatus ? "Updating..." : "Update status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRestoreDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isRestoring) {
            setIsRestoreDialogOpen(false);
            setRestoreActionError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore this project?</DialogTitle>
            <DialogDescription>
              This will remove the archived state and return the project to
              Ready For Work. The restoration will be recorded in project
              activity.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border bg-muted p-4">
            <div className="flex items-start gap-3">
              <RefreshCw size={20} className="mt-0.5 text-primary" />
              <div>
                <div className="font-extrabold">{project.name}</div>
                <div className="mt-1 text-sm font-semibold text-muted-foreground">
                  {formatEnumLabel(project.status)} project
                </div>
              </div>
            </div>
          </div>

          {restoreActionError ? (
            <Alert variant="destructive">
              <AlertDescription>{restoreActionError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={isRestoring}
              onClick={() => {
                setIsRestoreDialogOpen(false);
                setRestoreActionError("");
              }}
            >
              Cancel
            </Button>
            <Button disabled={isRestoring} onClick={handleRestoreProject}>
              {isRestoring ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <RefreshCw size={18} />
              )}
              {isRestoring ? "Restoring..." : "Restore project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isArchiveDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isArchiving) {
            setIsArchiveDialogOpen(false);
            setArchiveActionError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this project?</DialogTitle>
            <DialogDescription>
              Archiving keeps this {project.status === "CANCELLED" ? "cancelled" : "completed"} project
              available for historical reference. This action cannot be repeated
              after the project is archived.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border bg-muted p-4">
            <div className="flex items-start gap-3">
              <Archive size={20} className="mt-0.5 text-red-600" />
              <div>
                <div className="font-extrabold">{project.name}</div>
                <div className="mt-1 text-sm font-semibold text-muted-foreground">
                  {formatEnumLabel(project.status)} project
                </div>
              </div>
            </div>
          </div>

          {archiveActionError ? (
            <Alert variant="destructive">
              <AlertDescription>{archiveActionError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={isArchiving}
              onClick={() => {
                setIsArchiveDialogOpen(false);
                setArchiveActionError("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isArchiving}
              onClick={handleArchiveProject}
            >
              {isArchiving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Archive size={18} />
              )}
              {isArchiving ? "Archiving..." : "Archive project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(removingMember)}
        onOpenChange={(open) => {
          if (!open && !isRemovingMember) setRemovingMember(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
            <DialogDescription>
              This keeps membership history intact by marking the member as
              inactive on this project.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted p-4">
            <div className="flex items-start gap-3">
              <XCircle size={20} className="mt-0.5 text-red-600" />
              <div>
                <div className="font-extrabold">
                  {userDisplayName(removingMember?.user)}
                </div>
                <div className="mt-1 text-sm font-semibold text-muted-foreground">
                  {removingMember ? MEMBER_ROLE_LABELS[removingMember.role] : ""}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isRemovingMember}
              onClick={() => setRemovingMember(null)}
            >
              Cancel
            </Button>
            <Button disabled={isRemovingMember} onClick={handleRemoveMember}>
              {isRemovingMember ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
              {isRemovingMember ? "Removing..." : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
