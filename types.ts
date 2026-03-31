
export enum GoalType {
  Annual = 'Annual',
  Quarterly = 'Quarterly',
  Weekly = 'Weekly',
}

export interface Goal {
  id: string;
  title: string;
  type: GoalType;
  metric: string; // e.g., GCI, Listings
  targetValue: number;
  currentValue: number;
  visibility: 'solo' | 'team_view_only' | 'public';
  userName?: string;
  userId?: string;
  teamId: string | null;
  marketCenterId: string | null;
  coachId?: string | null;
  createdAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  templateId?: string;
  isArchived?: boolean;
}

export interface Team {
  id: string;
  name: string;
  creatorId: string;
  memberIds: string[];
  teamCode: string;
  marketCenterId: string | null;
}

export interface MarketCenterBranding {
  logoUrl?: string;
  darkLogoUrl?: string;
  colors: {
    primary: string;
    secondary: string;
    accent?: string;
    surface?: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
  };
  style?: {
    borderRadius?: string;
    navStyle?: 'solid' | 'glass' | 'minimal';
  };
}

export interface MarketCenter {
  id: string;
  name: string; // Brokerage Name
  marketCenterNumber: string;
  location: string;
  agentCount: number;
  adminIds: string[];
  calendarEmbedUrl?: string; // Google Calendar Src URL
  branding?: MarketCenterBranding;
}

export interface TeamMember {
  id:string;
  name: string;
  email?: string;
  bio?: string;
  gci?: number;
  listings?: number;
  calls?: number;
  appointments?: number;
  goalScore?: number;
  role?: 'agent' | 'team_leader' | 'productivity_coach' | 'market_center_admin' | 'recruiter';
  teamId: string | null;
  marketCenterId: string | null;
  theme?: 'light' | 'dark';
  isNewAgent?: boolean;
  coachId?: string | null;
  contributingAgentIds?: { [key: string]: boolean };
  isSuperAdmin?: boolean;
  playbookProgress?: { [playbookId: string]: string[] };
  assignedLearningPathId?: string;
  assignedHabitTrackerTemplateId?: string;
  newAgentResources?: NewAgentResources;
  onboardingChecklistProgress?: string[];
  zapierApiKey?: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioNumber?: string;
  dashboardLayout?: DashboardWidgetConfig[];
}

export interface DashboardWidgetConfig {
  id: string;
  span: 1 | 2 | 3;
  visible: boolean;
  order: number;
}

// Add missing types that are used in the app
export type PipelineStage = 'Lead' | 'Contacted' | 'Appointment Set' | 'Appointment Held' | 'Active Recruit' | 'Signed' | 'Not a Fit';

export const PIPELINE_STAGES: PipelineStage[] = ['Lead', 'Contacted', 'Appointment Set', 'Appointment Held', 'Active Recruit', 'Signed', 'Not a Fit'];

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  stage: PipelineStage;
  recruiterId: string;
  marketCenterId: string;
  createdAt: string;
  lastContacted: string;
  currentBrokerage?: string;
  gciLast12Months?: number;
  unitsLast12Months?: number;
}

export interface CandidateActivity {
  id: string;
  candidateId: string;
  userId: string;
  userName: string;
  createdAt: string;
  note: string;
}

// --- New Client Lead Pipeline Types ---
export type ClientLeadPipelineStage = 'New Lead' | 'Contacted' | 'Qualified' | 'Showing Homes' | 'Offer Made' | 'Under Contract' | 'Closed' | 'Lost';

export const CLIENT_LEAD_PIPELINE_STAGES: ClientLeadPipelineStage[] = ['New Lead', 'Contacted', 'Qualified', 'Showing Homes', 'Offer Made', 'Under Contract', 'Closed', 'Lost'];

export interface ClientLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  stage: ClientLeadPipelineStage;
  ownerId: string; // userId of the agent/team leader who owns this lead
  teamId: string | null; // teamId of the owner
  marketCenterId: string | null; // marketCenterId of the owner
  createdAt: string;
  lastContacted: string;
  leadSource?: string; // e.g., "Open House", "Referral", "Website"
  budget?: number; // Client's budget
  propertyType?: string; // e.g., "Single Family", "Condo"
  notes?: string; // General notes about the lead
}

export interface ClientLeadActivity {
  id: string;
  clientLeadId: string;
  userId: string;
  userName: string;
  createdAt: string;
  note: string;
}
// --- End New Client Lead Pipeline Types ---

export interface NewAgentHomework {
    id: string;
    week: number;
    title: string;
    description: string;
    url?: string;
    userId: string;
    teamId: string | null;
    marketCenterId: string | null;
    coachId?: string | null;
}
export interface NewAgentResourceLink {
    id: string;
    title: string;
    url: string;
}

export interface NewAgentResources {
  assignedOnboardingPlaybookId?: string;
  goalTemplates?: NewAgentGoalTemplate[];
  homework?: NewAgentHomework[];
  resourceLinks?: NewAgentResourceLink[];
  onboardingChecklist?: ChecklistItem[];
}

export interface NewAgentGoalTemplate {
  id: string;
  title: string;
  type: GoalType;
  metric: string;
  targetValue: number;
  visibility: 'solo' | 'team_view_only' | 'public';
}

export interface CommissionProfile {
  id: string;
  commissionSplit: number;
  commissionCap: number;
  postCapTransactionFee: number;
  royaltyFee: number;
  royaltyFeeCap: number;
  capAnniversaryDate: string;
  marketCenterId: string | null;
}
export interface Transaction {
  id: string;
  userId: string;
  teamId: string | null;
  marketCenterId: string | null;
  coachId?: string | null;
  acceptanceDate: string;
  address: string;
  type: 'Listing Sale' | 'Buyer Sale' | 'Lease';
  salePrice: number;
  commissionRate: number;
  totalCommission?: number; // Optional override for GCI
  closeDate?: string;
  conditionsDate?: string;
  expiryDate?: string;
}

export interface ProcessedTransaction extends Transaction {
  gci: number;
  companyDollarPaid: number;
  royaltyPaid: number;
  netCommission: number;
  hstOnGci: number;
}

export interface PerformanceLog {
  id: string;
  agentId: string;
  coachId: string;
  teamId: string | null;
  marketCenterId: string | null;
  date: string;
  type: 'coaching_session' | 'attendance' | 'performance_review' | 'goal_review';
  notes?: string;
  eventName?: string;
  attended?: boolean;
  ratings?: {
      prospecting: number;
      skillDevelopment: number;
      mindset: number;
  };
  goalProgress?: {
      goalId: string;
      goalTitle: string;
      currentValue: number;
      targetValue: number;
  }[];
  isArchived?: boolean;
}

export interface DailyTrackerData {
  id?: string;
  userId: string;
  date: string;
  teamId: string | null;
  marketCenterId: string | null;
  coachId?: string | null;
  dials: number;
  doorsKnocked: number;
  knocksAnswered: number;
  pointsActivities: { [key: string]: number };
  prospectingSessions: [ProspectingSession, ProspectingSession];
  prospectingTotals: ProspectingTotals;
  notes: string;
  schedule: { [time: string]: string };
}
export interface ProspectingSession {
    startTime: string;
    endTime: string;
}
export interface ProspectingTotals {
  contacts: number;
  aptsSet: number;
  listingAptsSet: number;
  buyerAptsSet: number;
  lenderAptsSet: number;
}
export interface BudgetModelInputs {
    userId: string;
    gci: number;
    // COS
    listingSpecialistCompensation: number;
    buyerSpecialistCompensation: number;
    otherCOS: number;
    // OpEx
    compensation: number;
    leadGeneration: number;
    occupancy: number;
    educationCoaching: number;
    officeExpenses: number;
    commsTech: number;
    auto: number;
    equipment: number;
    insurance: number;
    marketCenterId: string | null;
}
export interface HabitTrackerTemplate {
  id: string;
  name: string;
  description?: string;
  activities: HabitActivitySetting[];
  creatorId?: string;
  marketCenterId?: string | null;
  isDefaultForRole?: TeamMember['role'] | null;
}
export interface HabitActivitySetting {
  id: string;
  name: string;
  worth: number;
  unit: string;
}
export interface OrgBlueprint {
  userId: string;
  teamId?: string | null;
  marketCenterId?: string | null;
  nodes: OrgChartNode[];
}
export interface OrgChartNode {
  id: string;
  role: string;
  status: 'ghosted' | 'active';
}

export interface DiscoveryGuideData {
  gpsGoal: { focusArea: string; targetGoal: string; };
  gpsPriorities: GpsPriority[];
  gpsStrategies: GpsStrategy[];
  actionPlan: ActionPlanItem[];
  discoveryAnswers: { [key: string]: string };
}
export interface GpsPriority {
  id: string; what: string; how: string; 
}
export interface GpsStrategy {
  id: string; priority: string; strategy1: string; strategy2: string; strategy3: string;
}
export interface ActionPlanItem {
  id: string; timeframe: string; focus: string; actions: string;
}

export interface FourOneOneData {
    annualGoals: string;
    monthlyGoals: string;
    weeklyGoals: {
        week1: string;
        week2: string;
        week3: string;
        week4: string;
    };
}

export interface Playbook {
  id: string;
  creatorId: string;
  marketCenterId?: string | null;
  teamId?: string | null;
  title: string;
  description: string;
  category?: string;
  createdAt: string | any; // Can be string or Firestore serverTimestamp
  modules: Module[];
}
export interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}
export interface Lesson {
  id: string;
  title: string;
  type: 'text' | 'video' | 'link' | 'quiz' | 'checklist' | 'presentation' | 'submission';
  content: string | QuizContent | ChecklistContent | SubmissionRequirement;
  order: number;
}
export type QuizContent = QuizQuestion[];
export type ChecklistContent = ChecklistItem[];
export interface QuizQuestion {
  id: string;
  questionText: string;
  options: QuizQuestionOption[];
}
export interface QuizQuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}
export interface ChecklistItem {
  id: string;
  text: string;
}
export interface LearningPath {
  id: string;
  creatorId: string;
  marketCenterId?: string | null;
  teamId?: string | null;
  title: string;
  description: string;
  playbookIds: string[];
  createdAt?: string;
}
export type LeaderboardViewMetric = 'gci' | 'listings' | 'goalScore' | 'calls' | 'appointments';
export interface Notification {
  id: string;
  userId: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
  triggeredByUserId?: string;
  triggeredByUserName?: string;
}

export type Priority = 'Urgent' | 'High' | 'Medium' | 'Low';

// New type definition for TodoItem
export interface TodoItem {
  id: string;
  userId: string;
  text: string;
  dueDate: string | null; // ISO string 'YYYY-MM-DD'
  isCompleted: boolean;
  createdAt: string; // ISO string
  priority: Priority;
  order: number;
  clientLeadId?: string | null;
  candidateId?: string | null;
  clientLeadName?: string | null;
  candidateName?: string | null;
}

export interface SubmissionRequirement {
  prompt: string;
  uploadType: 'text_entry' | 'file_upload' | 'video_link';
  required: boolean;
}

export interface UserSubmission {
  id: string;
  userId: string;
  lessonId: string;
  playbookId: string;
  content: string; // The text answer or file URL
  status: 'pending' | 'approved' | 'rejected';
  coachFeedback?: string;
  submittedAt: string; // ISO Date
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string; // ISO Date string
  authorId: string;
  authorName: string;
  marketCenterId: string | null;
  importance: 'normal' | 'high';
  mediaType: 'none' | 'image' | 'video';
  mediaUrl?: string;
}

export interface UserIntegration {
  id: string;
  userId: string;
  provider: 'google' | 'zoom';
  email?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
}

export interface LiveSession {
  id: string;
  title: string;
  description: string;
  startTime: string; // ISO Date
  endTime: string; // ISO Date
  sessionType: 'client-consult' | 'mc-training';
  platform: 'google-meet' | 'zoom';
  meetingUrl: string;
  hostId: string;
  hostName: string;
  marketCenterId: string | null;
  teamId: string | null;
  
  // Audience targeting for LMS
  targetAudience?: {
    roles?: TeamMember['role'][];
    specificAgentIds?: string[];
  };

  // Client info for 1-on-1
  clientId?: string;
  clientName?: string;
  clientEmail?: string;

  status: 'scheduled' | 'live' | 'completed' | 'cancelled' | 'ended';
  createdAt: string;
  
  // Distribution tracking
  distribution: {
    emailSent: boolean;
    notificationSent: boolean;
    sentAt?: string;
  };
}
