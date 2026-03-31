import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { getAuthInstance, getFirestoreInstance } from '../firebaseConfig';
import { firebaseConfig } from '../config';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    updatePassword as firebaseUpdatePassword,
    User as FirebaseUser,
    getAuth 
} from 'firebase/auth';
import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    or,
    getDocs,
    arrayUnion,
    arrayRemove,
    deleteField,
    writeBatch,
    documentId,
    onSnapshot,
    serverTimestamp,
    addDoc,
    orderBy,
    deleteDoc,
    limit
} from 'firebase/firestore';
import { processDailyTrackerDoc, processTransactionDoc, processCommissionProfileDoc, processUserDoc, processTeamDoc, processPerformanceLogDoc, processPlaybookDoc, processClientLeadDoc, processClientLeadActivityDoc, processTodoItemDoc } from '../lib/firestoreUtils';
import type { Team, TeamMember, NewAgentResources, NewAgentHomework, NewAgentResourceLink, CommissionProfile, Transaction, PerformanceLog, DailyTrackerData, BudgetModelInputs, MarketCenter, MarketCenterBranding, Candidate, CandidateActivity, ClientLead, ClientLeadActivity, OrgBlueprint, Playbook, TodoItem, DashboardWidgetConfig } from '../types';

export const P = {
  isSuperAdmin: (user: TeamMember | null): boolean => !!user?.isSuperAdmin,
  isMcAdmin: (user: TeamMember | null): boolean => P.isSuperAdmin(user) || user?.role === 'market_center_admin',
  isCoach: (user: TeamMember | null): boolean => P.isMcAdmin(user) || user?.role === 'productivity_coach',
  isTeamLeader: (user: TeamMember | null): boolean => P.isCoach(user) || user?.role === 'team_leader',
  isRecruiter: (user: TeamMember | null): boolean => user?.role === 'recruiter',
  
  canManageResources: (user: TeamMember | null): boolean => P.isTeamLeader(user) || P.isCoach(user) || P.isMcAdmin(user),
  canAccessCoachingTools: (user: TeamMember | null): boolean => user?.role === 'team_leader' || user?.role === 'productivity_coach',
  canSeeMyPerformance: (user: TeamMember | null): boolean => user?.role === 'agent' || user?.role === 'team_leader',
  canSeeGrowthArchitect: (user: TeamMember | null): boolean => P.isMcAdmin(user) || user?.role === 'agent' || P.isTeamLeader(user),
  canSeeRecruitmentPlaybook: (user: TeamMember | null): boolean => user?.role === 'team_leader' || user?.role === 'recruiter',
  canManageClientPipeline: (user: TeamMember | null): boolean => user?.role === 'agent' || P.isTeamLeader(user),
};

interface AuthContextType {
  user: FirebaseUser | null;
  userData: TeamMember | null;
  mcBranding: MarketCenterBranding | null;
  loading: boolean;
  managedAgents: TeamMember[];
  loadingAgents: boolean;
  agentsError: string | null;
  signUpWithEmail: (email: string, password: string, name: string, options?: { role?: TeamMember['role']; teamId?: string; marketCenterId?: string; }) => Promise<void>;
  createAccountForAgent: (email: string, password: string, name: string, role: TeamMember['role'], teamId: string | null, marketCenterId: string | null) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (profileData: Partial<TeamMember>) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  joinTeam: (teamCode: string) => Promise<{ success: boolean; message: string }>;
  createTeam: (teamName: string) => Promise<void>;
  updateTheme: (theme: string) => Promise<void>;
  getTeamById: (teamId: string) => Promise<Team | null>;
  getUsersByIds: (userIds: string[]) => Promise<TeamMember[]>;
  getAllUsers: (marketCenterId?: string) => Promise<TeamMember[]>;
  getUsersForMarketCenter: (marketCenterId: string) => Promise<TeamMember[]>;
  leaveTeam: () => Promise<{ success: boolean; message: string; }>;
  removeAgentFromTeam: (agentId: string) => Promise<{ success: boolean; message: string; }>;
  getUserById: (userId: string) => Promise<TeamMember | null>;
  updateUserNewAgentStatus: (userId: string, isNew: boolean) => Promise<void>;
  getNewAgentResourcesForUser: (userId: string) => Promise<NewAgentResources | null>;
  saveNewAgentResources: (resources: NewAgentResources) => Promise<void>;
  updateUserMetrics: (userId: string, metrics: { gci?: number; listings?: number; calls?: number; appointments?: number; }) => Promise<void>;
  assignHomeworkToUser: (userId: string, homework: Omit<NewAgentHomework, 'id' | 'userId' | 'teamId' | 'marketCenterId'>) => Promise<void>;
  getAssignedResourcesForUser: (userId: string) => Promise<{ homework: NewAgentHomework[]; resourceLinks: NewAgentResourceLink[]; }>;
  getHomeworkForManagedUsers: () => Promise<Record<string, NewAgentHomework[]>>;
  getHabitLogsForManagedUsers: () => Promise<Record<string, DailyTrackerData[]>>;
  getHabitLogsForUser: (userId: string) => Promise<DailyTrackerData[]>;
  deleteHomeworkForUser: (homeworkId: string) => Promise<void>;
  getCommissionProfileForUser: (userId: string) => Promise<CommissionProfile | null>;
  saveCommissionProfile: (profileData: Omit<CommissionProfile, 'id'>) => Promise<void>;
  getTransactionsForManagedUsers: () => Promise<Transaction[]>;
  getTransactionsForUser: (userId: string) => Promise<Transaction[]>;
  getAllCommissionProfiles: () => Promise<CommissionProfile[]>;
  addPerformanceLog: (logData: Omit<PerformanceLog, 'id' | 'coachId' | 'date'>) => Promise<void>;
  getPerformanceLogsForAgent: (agentId: string) => Promise<PerformanceLog[]>;
  getPerformanceLogsForCurrentUser: () => Promise<PerformanceLog[]>;
  getPerformanceLogsForManagedUsers: () => Promise<Record<string, PerformanceLog[]>>;
  updatePerformanceLog: (logId: string, updates: Partial<PerformanceLog>) => Promise<void>;
  updateContributingAgents: (agentIds: string[]) => Promise<void>;
  updateCoachRoster: (coachId: string, agentIds: string[]) => Promise<void>;
  updateUserCoachAssignment: (agentId: string, newCoachId: string | null) => Promise<void>;
  updateUserTeamAffiliation: (agentId: string, newTeamId: string | null) => Promise<void>;
  getBudgetModelForUser: (userId: string) => Promise<BudgetModelInputs | null>;
  saveBudgetModel: (data: BudgetModelInputs) => Promise<void>;
  getMarketCenters: () => Promise<MarketCenter[]>;
  createMarketCenter: (mcData: Omit<MarketCenter, 'id' | 'adminIds'>) => Promise<void>;
  deleteMarketCenter: (id: string) => Promise<void>;
  assignMcAdmin: (email: string, marketCenterId: string) => Promise<void>;
  removeMcAdmin: (userId: string, marketCenterId: string) => Promise<void>;
  updateUserMarketCenter: (marketCenterId: string | null) => Promise<void>;
  updateUserRole: (userId: string, role: TeamMember['role']) => Promise<void>;
  updateUserMarketCenterForAdmin: (userId: string, marketCenterId: string | null) => Promise<void>;
  updateUserRoleAndMarketCenterAffiliation: (userId: string, newRole: TeamMember['role'], newMarketCenterId: string | null) => Promise<void>;
  updateUserAssignments: (userId: string, assignedLearningPathId: string | null, assignedHabitTrackerTemplateId: string | null) => Promise<void>;
  getAllTeams: (marketCenterId?: string) => Promise<Team[]>;
  getAllTransactionsForAdmin: () => Promise<Transaction[]>;
  updatePlaybookProgress: (playbookId: string, completedLessonIds: string[]) => Promise<void>;
  updateOnboardingChecklistProgress: (completedItemIds: string[]) => Promise<void>;
  getPlaybooksForUser: (userId: string) => Promise<Playbook[]>;
  getTransactionsForMarketCenter: (marketCenterId: string) => Promise<Transaction[]>;
  getCommissionProfilesForMarketCenter: (marketCenterId: string) => Promise<CommissionProfile[]>;
  getBudgetModelsForMarketCenter: (marketCenterId: string) => Promise<BudgetModelInputs[]>;
  getCandidatesForMarketCenter: (marketCenterId: string) => Promise<Candidate[]>;
  getCandidatesForRecruiter: (recruiterId: string) => Promise<Candidate[]>;
  addCandidate: (data: Omit<Candidate, 'id' | 'createdAt' | 'lastContacted'>) => Promise<string>;
  updateCandidate: (id: string, data: Partial<Candidate>) => Promise<void>;
  deleteCandidate: (id: string) => Promise<void>;
  getCandidateActivities: (candidateId: string) => Promise<CandidateActivity[]>;
  addCandidateActivity: (candidateId: string, note: string) => Promise<void>;
  getOrgBlueprintForUser: (userId: string) => Promise<OrgBlueprint | null>;
  addClientLead: (data: Omit<ClientLead, 'id' | 'createdAt' | 'lastContacted' | 'ownerId' | 'teamId' | 'marketCenterId'>) => Promise<string>;
  updateClientLead: (id: string, data: Partial<ClientLead>) => Promise<void>;
  deleteClientLead: (id: string) => Promise<void>;
  getClientLeadsForUser: (userId: string) => Promise<ClientLead[]>;
  getClientLeadsForTeam: (teamId: string) => Promise<ClientLead[]>;
  getClientLeadActivities: (clientLeadId: string) => Promise<ClientLeadActivity[]>;
  addClientLeadActivity: (clientLeadId: string, note: string) => Promise<void>;
  regenerateZapierApiKey: () => Promise<string>;
  getWebhooks: () => Promise<Record<string, string>>;
  saveWebhook: (event: string, url: string) => Promise<void>;
  deleteWebhook: (event: string) => Promise<void>;
  addTodo: (data: Partial<Omit<TodoItem, 'id' | 'userId' | 'createdAt' | 'isCompleted'>>) => Promise<void>;
  updateTodo: (todoId: string, updates: Partial<Omit<TodoItem, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  deleteTodo: (todoId: string) => Promise<void>;
  getTodosForUserDateRange: (startDate: string, endDate: string) => Promise<TodoItem[]>;
  getUndatedTodosForUser: () => Promise<TodoItem[]>;
  getLinkableContacts: () => Promise<{ leads: ClientLead[], candidates: Candidate[] }>;
  sendSms: (to: string, body: string) => Promise<{ success: boolean; error?: string }>;
  updateDashboardLayout: (layout: DashboardWidgetConfig[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<TeamMember | null>(null);
    const [mcBranding, setMcBranding] = useState<MarketCenterBranding | null>(null);
    const [loading, setLoading] = useState(true);
    const [managedAgents, setManagedAgents] = useState<TeamMember[]>([]);
    const [loadingAgents, setLoadingAgents] = useState(true);
    const [agentsError, setAgentsError] = useState<string | null>(null);

    useEffect(() => {
        const auth = getAuthInstance();
        if (!auth) { setLoading(false); return; }
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            if (!firebaseUser) { setUserData(null); setLoading(false); }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        const db = getFirestoreInstance();
        if (!db) return;
        let unsubscribe: (() => void) | undefined;
        if (user) {
            setLoading(true);
            unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = processUserDoc(docSnap);
                    console.log("UserData loaded:", data);
                    setUserData(data);
                } else {
                    console.log("UserData not found");
                    setUserData(null);
                }
                setLoading(false);
            }, (error) => {
                console.error("Error loading UserData:", error);
                setUserData(null); 
                setLoading(false); 
            });
        } else {
            setUserData(null); setManagedAgents([]); setLoading(false); setLoadingAgents(false);
        }
        return () => { if (unsubscribe) unsubscribe(); };
    }, [user]);

    useEffect(() => {
        const db = getFirestoreInstance();
        if (!userData?.marketCenterId || !db) {
            setMcBranding(null);
            return;
        }

        const unsubscribe = onSnapshot(doc(db, 'marketCenters', userData.marketCenterId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMcBranding(data.branding || null);
            } else {
                setMcBranding(null);
            }
        });

        return () => unsubscribe();
    }, [userData?.marketCenterId]);

    useEffect(() => {
        const db = getFirestoreInstance();
        if (!user || !userData || !db) {
            setManagedAgents([]);
            setLoadingAgents(false);
            return;
        }

        setLoadingAgents(true);
        setAgentsError(null);

        const usersRef = collection(db, 'users');

        // Helper to fetch agents by IDs (bypasses collection query rule issues for managers)
        const fetchAgentsByIds = async (ids: string[]) => {
            try {
                const agentsData = await Promise.all(
                    ids.filter(id => id !== user.uid).map(async (id) => {
                        const docSnap = await getDoc(doc(db, 'users', id));
                        return docSnap.exists() ? processUserDoc(docSnap) : null;
                    })
                );
                setManagedAgents(agentsData.filter((a): a is TeamMember => a !== null));
                setLoadingAgents(false);
            } catch (err) {
                console.error("Error fetching agents by IDs:", err);
                setAgentsError("Failed to load agents.");
                setLoadingAgents(false);
            }
        };

        let unsubscribe: (() => void) | undefined;

        if (P.isSuperAdmin(userData)) {
            const q = query(usersRef);
            unsubscribe = onSnapshot(q, (snapshot) => {
                const agents = snapshot.docs.map(processUserDoc);
                setManagedAgents(agents.filter(a => a.id !== user.uid));
                setLoadingAgents(false);
            }, (err) => {
                console.error("Error fetching managed agents (Super Admin):", err);
                setAgentsError("Failed to load agents.");
                setLoadingAgents(false);
            });
        } else if (P.isMcAdmin(userData) && userData.marketCenterId) {
            // MC Admins fetch all users in their MC. 
            // Since there's no central list of all MC users, we use a query.
            // If this fails, we might need to denormalize the user list on the MC doc.
            const q = query(usersRef, where('marketCenterId', '==', userData.marketCenterId));
            unsubscribe = onSnapshot(q, (snapshot) => {
                const agents = snapshot.docs.map(processUserDoc);
                setManagedAgents(agents.filter(a => a.id !== user.uid));
                setLoadingAgents(false);
            }, (err) => {
                console.error("Error fetching managed agents (MC Admin):", err);
                // Fallback: If query fails, it's likely a permission issue with collection queries.
                setAgentsError("Failed to load agents via query.");
                setLoadingAgents(false);
            });
        } else if (P.isTeamLeader(userData) && userData.teamId) {
            // Team Leaders fetch the team document to get member IDs, then fetch members individually.
            // This bypasses collection query limitations in rules.
            const teamUnsubscribe = onSnapshot(doc(db, 'teams', userData.teamId), (docSnap) => {
                if (docSnap.exists()) {
                    const memberIds = docSnap.data().memberIds || [];
                    fetchAgentsByIds(memberIds);
                } else {
                    setManagedAgents([]);
                    setLoadingAgents(false);
                }
            }, (err) => {
                console.error("Error fetching team for Team Leader:", err);
                setAgentsError("Failed to load team members.");
                setLoadingAgents(false);
            });
            unsubscribe = teamUnsubscribe;
        } else if (P.isCoach(userData)) {
            // Coaches fetch by coachId. This query is safe because of the direct coachId rule.
            const q = query(usersRef, where('coachId', '==', user.uid));
            unsubscribe = onSnapshot(q, (snapshot) => {
                const agents = snapshot.docs.map(processUserDoc);
                setManagedAgents(agents.filter(a => a.id !== user.uid));
                setLoadingAgents(false);
            }, (err) => {
                console.error("Error fetching managed agents (Coach):", err);
                setAgentsError("Failed to load agents.");
                setLoadingAgents(false);
            });
        } else {
            setManagedAgents([]);
            setLoadingAgents(false);
        }

        return () => { if (unsubscribe) unsubscribe(); };
    }, [user, userData]);

    const signUpWithEmail = useCallback(async (email: string, password: string, name: string, options?: { role?: TeamMember['role']; teamId?: string; marketCenterId?: string; }) => {
        const auth = getAuthInstance();
        const db = getFirestoreInstance();
        if (!auth || !db) throw new Error("Firebase not initialized");
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser: any = {
            id: userCredential.user.uid,
            name,
            email,
            role: options?.role || 'agent',
            teamId: options?.teamId || null,
            marketCenterId: options?.marketCenterId || null,
            gci: 0,
            listings: 0,
            calls: 0,
            appointments: 0,
            goalScore: 0,
            isNewAgent: true,
            playbookProgress: {},
            onboardingChecklistProgress: []
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
    }, []);

    const createAccountForAgent = useCallback(async (email: string, password: string, name: string, role: TeamMember['role'], teamId: string | null, marketCenterId: string | null) => {
        const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
        const secondaryAuth = getAuth(secondaryApp);
        const db = getFirestoreInstance();
        if (!db) throw new Error("Firestore not initialized");

        try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUser: any = {
                id: userCredential.user.uid,
                name,
                email,
                role,
                teamId,
                marketCenterId,
                gci: 0,
                listings: 0,
                calls: 0,
                appointments: 0,
                goalScore: 0,
                isNewAgent: true,
                playbookProgress: {},
                onboardingChecklistProgress: []
            };
            await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
        } finally {
            await deleteApp(secondaryApp);
        }
    }, []);

    const signInWithEmail = useCallback(async (email: string, password: string) => {
        const auth = getAuthInstance();
        if (!auth) throw new Error("Firebase not initialized");
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            console.error("Detailed Login Error:", {
                code: err.code,
                message: err.message,
                stack: err.stack,
                customData: err.customData
            });
            throw err;
        }
    }, []);

    const logout = useCallback(async () => {
        const auth = getAuthInstance();
        if (!auth) throw new Error("Firebase not initialized");
        await signOut(auth);
    }, []);

    const updateUserProfile = useCallback(async (profileData: Partial<TeamMember>) => {
        const db = getFirestoreInstance();
        if (!user || !db) throw new Error("User not authenticated.");
        await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
    }, [user]);

    const updatePassword = useCallback(async (password: string) => {
        if (!user) throw new Error("User not authenticated");
        await firebaseUpdatePassword(user, password);
    }, [user]);

    const joinTeam = useCallback(async (teamCode: string) => {
        const db = getFirestoreInstance();
        if (!user || !db) return { success: false, message: 'Not authenticated.' };
        const q = query(collection(db, 'teams'), where('teamCode', '==', teamCode));
        const snap = await getDocs(q);
        if (snap.empty) return { success: false, message: 'Invalid team code.' };
        const teamDoc = snap.docs[0];
        await updateDoc(doc(db, 'teams', teamDoc.id), { memberIds: arrayUnion(user.uid) });
        await updateDoc(doc(db, 'users', user.uid), { teamId: teamDoc.id });
        return { success: true, message: `Joined team ${teamDoc.data().name}!` };
    }, [user]);

    const createTeam = useCallback(async (teamName: string) => {
        const db = getFirestoreInstance();
        if (!user || !db || !userData) return;
        const teamCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const teamRef = await addDoc(collection(db, 'teams'), {
            name: teamName,
            creatorId: user.uid,
            memberIds: [user.uid],
            teamCode,
            marketCenterId: userData.marketCenterId || null
        });
        await updateDoc(doc(db, 'users', user.uid), { teamId: teamRef.id, role: 'team_leader' });
    }, [user, userData]);

    const updateTheme = useCallback(async (theme: string) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await updateDoc(doc(db, 'users', user.uid), { theme });
    }, [user]);

    const getTeamById = useCallback(async (teamId: string) => {
        const db = getFirestoreInstance();
        if (!db) return null;
        const snap = await getDoc(doc(db, 'teams', teamId));
        return snap.exists() ? processTeamDoc(snap) : null;
    }, []);

    const getUsersByIds = useCallback(async (userIds: string[]) => {
        const db = getFirestoreInstance();
        if (!db || userIds.length === 0) return [];
        const q = query(collection(db, 'users'), where(documentId(), 'in', userIds));
        const snap = await getDocs(q);
        return snap.docs.map(processUserDoc);
    }, []);

    const getAllUsers = useCallback(async (marketCenterId?: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        let q = query(collection(db, 'users'));
        if (marketCenterId) {
            q = query(collection(db, 'users'), where('marketCenterId', '==', marketCenterId));
        }
        const snap = await getDocs(q);
        return snap.docs.map(processUserDoc);
    }, []);

    const getUsersForMarketCenter = useCallback(async (marketCenterId: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const q = query(collection(db, 'users'), where('marketCenterId', '==', marketCenterId));
        const snap = await getDocs(q);
        return snap.docs.map(processUserDoc);
    }, []);

    const leaveTeam = useCallback(async () => {
        const db = getFirestoreInstance();
        if (!user || !userData?.teamId || !db) return { success: false, message: 'Error leaving team.' };
        await updateDoc(doc(db, 'teams', userData.teamId), { memberIds: arrayRemove(user.uid) });
        await updateDoc(doc(db, 'users', user.uid), { teamId: null });
        return { success: true, message: 'Left team successfully.' };
    }, [user, userData]);

    const removeAgentFromTeam = useCallback(async (agentId: string) => {
        const db = getFirestoreInstance();
        if (!userData?.teamId || !db) return { success: false, message: 'Error removing agent.' };
        await updateDoc(doc(db, 'teams', userData.teamId), { memberIds: arrayRemove(agentId) });
        await updateDoc(doc(db, 'users', agentId), { teamId: null });
        return { success: true, message: 'Agent removed from team.' };
    }, [userData]);

    const getUserById = useCallback(async (userId: string) => {
        const db = getFirestoreInstance();
        if (!db) return null;
        const snap = await getDoc(doc(db, 'users', userId));
        return snap.exists() ? processUserDoc(snap) : null;
    }, []);

    const updateUserNewAgentStatus = useCallback(async (userId: string, isNew: boolean) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'users', userId), { isNewAgent: isNew });
    }, []);

    const getNewAgentResourcesForUser = useCallback(async (userId: string) => {
        const db = getFirestoreInstance();
        if (!db) return null;
        const snap = await getDoc(doc(db, 'users', userId));
        return snap.exists() ? (snap.data().newAgentResources as NewAgentResources || null) : null;
    }, []);

    const saveNewAgentResources = useCallback(async (resources: NewAgentResources) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await updateDoc(doc(db, 'users', user.uid), { newAgentResources: resources });
    }, [user]);

    const updateUserMetrics = useCallback(async (userId: string, metrics: { gci?: number; listings?: number; calls?: number; appointments?: number; }) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'users', userId), metrics);
    }, []);

    const assignHomeworkToUser = useCallback(async (userId: string, homework: Omit<NewAgentHomework, 'id' | 'userId' | 'teamId' | 'marketCenterId'>) => {
        const db = getFirestoreInstance();
        if (!db) return;
        const newHw = { ...homework, id: `hw-${Date.now()}` };
        await updateDoc(doc(db, 'users', userId), { 'newAgentResources.homework': arrayUnion(newHw) });
    }, []);

    const getAssignedResourcesForUser = useCallback(async (userId: string) => {
        const db = getFirestoreInstance();
        if (!db) return { homework: [], resourceLinks: [] };
        const snap = await getDoc(doc(db, 'users', userId));
        const data = snap.data()?.newAgentResources;
        return { homework: data?.homework || [], resourceLinks: data?.resourceLinks || [] };
    }, []);

    const getHomeworkForManagedUsers = useCallback(async () => {
        const res: Record<string, NewAgentHomework[]> = {};
        managedAgents.forEach(a => { res[a.id] = a.newAgentResources?.homework || []; });
        return res;
    }, [managedAgents]);

    const getHabitLogsForManagedUsers = useCallback(async () => {
        const db = getFirestoreInstance();
        if (!db || managedAgents.length === 0 || !userData) return {};
        
        const res: Record<string, DailyTrackerData[]> = {};
        
        // Fetch logs for each agent individually to handle permission rules more reliably
        await Promise.all(managedAgents.map(async (agent) => {
            try {
                let q;
                if (P.isSuperAdmin(userData)) {
                    q = query(collection(db, 'dailyTrackers'), where('userId', '==', agent.id), limit(100));
                } else if (P.isMcAdmin(userData) && userData.marketCenterId) {
                    q = query(collection(db, 'dailyTrackers'), where('marketCenterId', '==', userData.marketCenterId), where('userId', '==', agent.id));
                } else if (P.isCoach(userData) && agent.coachId === user?.uid) {
                    q = query(collection(db, 'dailyTrackers'), where('coachId', '==', user?.uid), where('userId', '==', agent.id));
                } else if (P.isTeamLeader(userData) && userData.teamId === agent.teamId) {
                    q = query(collection(db, 'dailyTrackers'), where('teamId', '==', userData.teamId), where('userId', '==', agent.id));
                } else {
                    // Fallback or restricted access
                    return;
                }

                const snap = await getDocs(q);
                res[agent.id] = snap.docs.map(processDailyTrackerDoc);
            } catch (err) {
                console.error(`Error fetching habit logs for agent ${agent.id}:`, err);
                res[agent.id] = [];
            }
        }));
        
        return res;
    }, [managedAgents, userData, user]);

    const getHabitLogsForUser = useCallback(async (userId: string) => {
        const db = getFirestoreInstance();
        if (!db || !user || !userData) return [];
        
        let q;
        if (P.isSuperAdmin(userData)) {
            q = query(collection(db, 'dailyTrackers'), where('userId', '==', userId), orderBy('date', 'desc'));
        } else if (P.isMcAdmin(userData) && userData.marketCenterId) {
            q = query(collection(db, 'dailyTrackers'), where('marketCenterId', '==', userData.marketCenterId), where('userId', '==', userId), orderBy('date', 'desc'));
        } else if (userId === user.uid) {
            q = query(collection(db, 'dailyTrackers'), where('userId', '==', userId), orderBy('date', 'desc'));
        } else if (userData.role === 'productivity_coach') {
            q = query(
                collection(db, 'dailyTrackers'), 
                where('coachId', '==', user.uid),
                where('userId', '==', userId), 
                orderBy('date', 'desc')
            );
        } else if (userData.role === 'team_leader' && userData.teamId) {
            q = query(
                collection(db, 'dailyTrackers'), 
                where('teamId', '==', userData.teamId),
                where('userId', '==', userId), 
                orderBy('date', 'desc')
            );
        }

        const snap = await getDocs(q);
        return snap.docs.map(processDailyTrackerDoc);
    }, [user, userData]);

    const deleteHomeworkForUser = useCallback(async (homeworkId: string) => {
        const db = getFirestoreInstance();
        if (!userData || !db) return;
        for (const agent of managedAgents) {
            const hw = agent.newAgentResources?.homework?.find(h => h.id === homeworkId);
            if (hw) {
                await updateDoc(doc(db, 'users', agent.id), { 'newAgentResources.homework': arrayRemove(hw) });
                break;
            }
        }
    }, [userData, managedAgents]);

    const getCommissionProfileForUser = useCallback(async (userId: string) => {
        const db = getFirestoreInstance();
        if (!db) return null;
        const snap = await getDoc(doc(db, 'commissionProfiles', userId));
        return snap.exists() ? processCommissionProfileDoc(snap) : null;
    }, []);

    const saveCommissionProfile = useCallback(async (profileData: Omit<CommissionProfile, 'id'>) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await setDoc(doc(db, 'commissionProfiles', user.uid), profileData);
    }, [user]);

    const getTransactionsForManagedUsers = useCallback(async () => {
        const db = getFirestoreInstance();
        if (!db || managedAgents.length === 0 || !userData) return [];
        
        const allTransactions: Transaction[] = [];
        
        // Fetch transactions for each agent individually
        await Promise.all(managedAgents.map(async (agent) => {
            try {
                let q;
                if (P.isSuperAdmin(userData)) {
                    q = query(collection(db, 'transactions'), where('userId', '==', agent.id));
                } else if (P.isMcAdmin(userData) && userData.marketCenterId) {
                    q = query(collection(db, 'transactions'), where('marketCenterId', '==', userData.marketCenterId), where('userId', '==', agent.id));
                } else if (P.isCoach(userData) && agent.coachId === user?.uid) {
                    q = query(collection(db, 'transactions'), where('coachId', '==', user?.uid), where('userId', '==', agent.id));
                } else if (P.isTeamLeader(userData) && userData.teamId === agent.teamId) {
                    q = query(collection(db, 'transactions'), where('teamId', '==', userData.teamId), where('userId', '==', agent.id));
                } else {
                    return;
                }

                const snap = await getDocs(q);
                allTransactions.push(...snap.docs.map(processTransactionDoc));
            } catch (err) {
                console.error(`Error fetching transactions for agent ${agent.id}:`, err);
            }
        }));
        
        return allTransactions;
    }, [managedAgents, userData, user]);

    const getTransactionsForUser = useCallback(async (userId: string) => {
        const db = getFirestoreInstance();
        if (!db || !user || !userData) return [];
        
        let q;
        if (P.isSuperAdmin(userData)) {
            q = query(collection(db, 'transactions'), where('userId', '==', userId));
        } else if (P.isMcAdmin(userData) && userData.marketCenterId) {
            q = query(collection(db, 'transactions'), where('marketCenterId', '==', userData.marketCenterId), where('userId', '==', userId));
        } else if (userId === user.uid) {
            q = query(collection(db, 'transactions'), where('userId', '==', userId));
        } else if (userData.role === 'productivity_coach') {
            q = query(
                collection(db, 'transactions'), 
                where('coachId', '==', user.uid),
                where('userId', '==', userId)
            );
        } else if (userData.role === 'team_leader' && userData.teamId) {
            q = query(
                collection(db, 'transactions'), 
                where('teamId', '==', userData.teamId),
                where('userId', '==', userId)
            );
        }

        const snap = await getDocs(q);
        return snap.docs.map(processTransactionDoc);
    }, [user, userData]);

    const getAllCommissionProfiles = useCallback(async () => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const snap = await getDocs(collection(db, 'commissionProfiles'));
        return snap.docs.map(processCommissionProfileDoc);
    }, []);

    const addPerformanceLog = useCallback(async (logData: Omit<PerformanceLog, 'id' | 'coachId' | 'date'>) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await addDoc(collection(db, 'performanceLogs'), { ...logData, coachId: user.uid, date: serverTimestamp() });
    }, [user]);

    const getPerformanceLogsForAgent = useCallback(async (agentId: string) => {
        const db = getFirestoreInstance();
        if (!db || !user || !userData) return [];
        
        let q;
        if (P.isSuperAdmin(userData)) {
            q = query(collection(db, 'performanceLogs'), where('agentId', '==', agentId), orderBy('date', 'desc'));
        } else if (P.isMcAdmin(userData) && userData.marketCenterId) {
            q = query(collection(db, 'performanceLogs'), where('marketCenterId', '==', userData.marketCenterId), where('agentId', '==', agentId), orderBy('date', 'desc'));
        } else if (agentId === user.uid) {
            q = query(collection(db, 'performanceLogs'), where('agentId', '==', agentId), orderBy('date', 'desc'));
        } else if (userData.role === 'productivity_coach') {
            q = query(
                collection(db, 'performanceLogs'), 
                where('coachId', '==', user.uid),
                where('agentId', '==', agentId), 
                orderBy('date', 'desc')
            );
        } else if (userData.role === 'team_leader' && userData.teamId) {
            q = query(
                collection(db, 'performanceLogs'), 
                where('teamId', '==', userData.teamId),
                where('agentId', '==', agentId), 
                orderBy('date', 'desc')
            );
        }

        const snap = await getDocs(q);
        return snap.docs.map(processPerformanceLogDoc);
    }, [user, userData]);

    const getPerformanceLogsForCurrentUser = useCallback(async () => {
        const db = getFirestoreInstance();
        if (!user || !db) return [];
        const q = query(collection(db, 'performanceLogs'), where('agentId', '==', user.uid), orderBy('date', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(processPerformanceLogDoc);
    }, [user]);

    const getPerformanceLogsForManagedUsers = useCallback(async () => {
        const db = getFirestoreInstance();
        if (!db || managedAgents.length === 0 || !userData) return {};
        
        let q;
        if (P.isSuperAdmin(userData)) {
            q = query(collection(db, 'performanceLogs'), limit(500));
        } else if (P.isMcAdmin(userData) && userData.marketCenterId) {
            q = query(collection(db, 'performanceLogs'), where('marketCenterId', '==', userData.marketCenterId));
        } else if (userData.role === 'productivity_coach') {
            q = query(collection(db, 'performanceLogs'), where('coachId', '==', user?.uid));
        } else if (userData.role === 'team_leader' && userData.teamId) {
            q = query(collection(db, 'performanceLogs'), where('teamId', '==', userData.teamId));
        }

        const snap = await getDocs(q);
        const res: Record<string, PerformanceLog[]> = {};
        snap.docs.forEach(doc => {
            const data = processPerformanceLogDoc(doc);
            if (!res[data.agentId]) res[data.agentId] = [];
            res[data.agentId].push(data);
        });
        return res;
    }, [managedAgents, userData, user]);

    const updatePerformanceLog = useCallback(async (logId: string, updates: Partial<PerformanceLog>) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'performanceLogs', logId), updates);
    }, []);

    const updateContributingAgents = useCallback(async (agentIds: string[]) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        const contributingAgentIds: Record<string, boolean> = {};
        agentIds.forEach(id => { contributingAgentIds[id] = true; });
        await updateDoc(doc(db, 'users', user.uid), { contributingAgentIds });
    }, [user]);

    const updateCoachRoster = useCallback(async (coachId: string, agentIds: string[]) => {
        const db = getFirestoreInstance();
        if (!db) return;
        const batch = writeBatch(db);
        agentIds.forEach(id => { batch.update(doc(db, 'users', id), { coachId }); });
        await batch.commit();
    }, []);

    const updateUserCoachAssignment = useCallback(async (agentId: string, newCoachId: string | null) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'users', agentId), { coachId: newCoachId });
    }, []);

    const updateUserTeamAffiliation = useCallback(async (agentId: string, newTeamId: string | null) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'users', agentId), { teamId: newTeamId });
    }, []);

    const updateUserAssignments = useCallback(async (userId: string, assignedLearningPathId: string | null, assignedHabitTrackerTemplateId: string | null) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'users', userId), { 
            assignedLearningPathId: assignedLearningPathId || null, 
            assignedHabitTrackerTemplateId: assignedHabitTrackerTemplateId || null 
        });
    }, []);

    const getBudgetModelForUser = useCallback(async (userId: string) => {
        const db = getFirestoreInstance();
        if (!db) return null;
        const snap = await getDoc(doc(db, 'budgetModels', userId));
        return snap.exists() ? (snap.data() as BudgetModelInputs) : null;
    }, []);

    const saveBudgetModel = useCallback(async (data: BudgetModelInputs) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await setDoc(doc(db, 'budgetModels', user.uid), data);
    }, [user]);

    const getMarketCenters = useCallback(async () => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const snap = await getDocs(collection(db, 'marketCenters'));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketCenter));
    }, []);

    const createMarketCenter = useCallback(async (mcData: Omit<MarketCenter, 'id' | 'adminIds'>) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await addDoc(collection(db, 'marketCenters'), { ...mcData, adminIds: [] });
    }, []);

    const deleteMarketCenter = useCallback(async (id: string) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await deleteDoc(doc(db, 'marketCenters', id));
    }, []);

    const assignMcAdmin = useCallback(async (email: string, marketCenterId: string) => {
        const db = getFirestoreInstance();
        if (!db) return;
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snap = await getDocs(q);
        if (snap.empty) return;
        const userDoc = snap.docs[0];
        await updateDoc(doc(db, 'users', userDoc.id), { role: 'market_center_admin', marketCenterId });
        await updateDoc(doc(db, 'marketCenters', marketCenterId), { adminIds: arrayUnion(userDoc.id) });
    }, []);

    const removeMcAdmin = useCallback(async (userId: string, marketCenterId: string) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'users', userId), { role: 'agent' });
        await updateDoc(doc(db, 'marketCenters', marketCenterId), { adminIds: arrayRemove(userId) });
    }, []);

    const updateUserMarketCenter = useCallback(async (marketCenterId: string | null) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await updateDoc(doc(db, 'users', user.uid), { marketCenterId });
    }, [user]);

    const updateUserMarketCenterForAdmin = useCallback(async (userId: string, marketCenterId: string | null) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'users', userId), { marketCenterId });
    }, []);

    const updateUserRole = useCallback(async (userId: string, role: TeamMember['role']) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'users', userId), { role });
    }, []);

    const updateUserRoleAndMarketCenterAffiliation = useCallback(async (userId: string, newRole: TeamMember['role'], newMarketCenterId: string | null) => {
        const db = getFirestoreInstance();
        if (!db) return;
        const userRef = doc(db, 'users', userId);
        const oldUserDataSnap = await getDoc(userRef);
        if (!oldUserDataSnap.exists()) {
            throw new Error(`User document with ID ${userId} does not exist.`);
        }
        const oldUserData = oldUserDataSnap.data() as TeamMember;
        const batch = writeBatch(db);
        if (oldUserData.role === 'market_center_admin' && oldUserData.marketCenterId) {
            batch.update(doc(db, 'marketCenters', oldUserData.marketCenterId), { adminIds: arrayRemove(userId) });
        }
        if (newRole === 'market_center_admin' && newMarketCenterId) {
            batch.update(doc(db, 'marketCenters', newMarketCenterId), { adminIds: arrayUnion(userId) });
        }
        batch.update(userRef, { role: newRole, marketCenterId: newMarketCenterId });
        await batch.commit();
    }, []);

    const getAllTeams = useCallback(async (marketCenterId?: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        let q = query(collection(db, 'teams'));
        if (marketCenterId) {
            q = query(collection(db, 'teams'), where('marketCenterId', '==', marketCenterId));
        }
        const snap = await getDocs(q);
        return snap.docs.map(processTeamDoc);
    }, []);

    const getAllTransactionsForAdmin = useCallback(async () => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const snap = await getDocs(collection(db, 'transactions'));
        return snap.docs.map(processTransactionDoc);
    }, []);

    const updatePlaybookProgress = useCallback(async (playbookId: string, completedLessonIds: string[]) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await updateDoc(doc(db, 'users', user.uid), { [`playbookProgress.${playbookId}`]: completedLessonIds });
    }, [user]);

    const updateOnboardingChecklistProgress = useCallback(async (completedItemIds: string[]) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await updateDoc(doc(db, 'users', user.uid), { onboardingChecklistProgress: completedItemIds });
    }, [user]);

    const getOrgBlueprintForUser = useCallback(async (userId: string) => {
        const db = getFirestoreInstance();
        if (!db) return null;
        const snap = await getDoc(doc(db, 'orgBlueprints', userId));
        return snap.exists() ? (snap.data() as OrgBlueprint) : null;
    }, []);

    const getPlaybooksForUser = useCallback(async (userId: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (!userSnap.exists()) return [];
        const userData = userSnap.data() as TeamMember;
        const queriesToRun = [query(collection(db, 'playbooks'), where('teamId', '==', null), where('marketCenterId', '==', null))];
        if (userData.teamId) queriesToRun.push(query(collection(db, 'playbooks'), where('teamId', '==', userData.teamId)));
        if (userData.marketCenterId) queriesToRun.push(query(collection(db, 'playbooks'), where('marketCenterId', '==', userData.marketCenterId)));
        const snaps = await Promise.all(queriesToRun.map(q => getDocs(q)));
        const all = new Map<string, Playbook>();
        snaps.forEach(s => s.docs.forEach(d => all.set(d.id, processPlaybookDoc(d))));
        return Array.from(all.values());
    }, []);

    const getTransactionsForMarketCenter = useCallback(async (marketCenterId: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const q = query(collection(db, 'transactions'), where('marketCenterId', '==', marketCenterId));
        const snap = await getDocs(q);
        return snap.docs.map(processTransactionDoc);
    }, []);

    const getCommissionProfilesForMarketCenter = useCallback(async (marketCenterId: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const q = query(collection(db, 'commissionProfiles'), where('marketCenterId', '==', marketCenterId));
        const snap = await getDocs(q);
        return snap.docs.map(processCommissionProfileDoc);
    }, []);

    const getBudgetModelsForMarketCenter = useCallback(async (marketCenterId: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const q = query(collection(db, 'budgetModels'), where('marketCenterId', '==', marketCenterId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as BudgetModelInputs);
    }, []);

    const getCandidatesForMarketCenter = useCallback(async (marketCenterId: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const q = query(collection(db, 'candidates'), where('marketCenterId', '==', marketCenterId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Candidate));
    }, []);

    const getCandidatesForRecruiter = useCallback(async (recruiterId: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const q = query(collection(db, 'candidates'), where('recruiterId', '==', recruiterId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Candidate));
    }, []);

    const addCandidate = useCallback(async (data: Omit<Candidate, 'id' | 'createdAt' | 'lastContacted'>) => {
        const db = getFirestoreInstance();
        if (!db) return '';
        const docRef = await addDoc(collection(db, 'candidates'), { ...data, createdAt: serverTimestamp(), lastContacted: serverTimestamp() });
        return docRef.id;
    }, []);

    const updateCandidate = useCallback(async (id: string, data: Partial<Candidate>) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'candidates', id), { ...data, lastContacted: serverTimestamp() });
    }, []);

    const deleteCandidate = useCallback(async (id: string) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await deleteDoc(doc(db, 'candidates', id));
    }, []);

    const getCandidateActivities = useCallback(async (candidateId: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const q = query(collection(db, 'candidateActivities'), where('candidateId', '==', candidateId), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CandidateActivity));
    }, []);

    const addCandidateActivity = useCallback(async (candidateId: string, note: string) => {
        const db = getFirestoreInstance();
        if (!user || !userData || !db) return;
        
        // Fetch candidate to get marketCenterId and recruiterId for the activity doc
        const candidateSnap = await getDoc(doc(db, 'candidates', candidateId));
        if (!candidateSnap.exists()) return;
        const candidateData = candidateSnap.data();

        await addDoc(collection(db, 'candidateActivities'), {
            candidateId, 
            userId: user.uid, 
            userName: userData.name, 
            note, 
            createdAt: serverTimestamp(),
            marketCenterId: candidateData.marketCenterId || null,
            recruiterId: candidateData.recruiterId || null
        });
    }, [user, userData]);

    const addClientLead = useCallback(async (data: Omit<ClientLead, 'id' | 'createdAt' | 'lastContacted' | 'ownerId' | 'teamId' | 'marketCenterId'>) => {
        const db = getFirestoreInstance();
        if (!user || !userData || !db) return '';
        const docRef = await addDoc(collection(db, 'clientLeads'), {
            ...data, ownerId: user.uid, teamId: userData.teamId || null, marketCenterId: userData.marketCenterId || null,
            createdAt: serverTimestamp(), lastContacted: serverTimestamp()
        });
        return docRef.id;
    }, [user, userData]);

    const updateClientLead = useCallback(async (id: string, data: Partial<ClientLead>) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'clientLeads', id), { ...data, lastContacted: serverTimestamp() });
    }, []);

    const deleteClientLead = useCallback(async (id: string) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await deleteDoc(doc(db, 'clientLeads', id));
    }, []);

    const getClientLeadsForUser = useCallback(async (userId: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const q = query(collection(db, 'clientLeads'), where('ownerId', '==', userId), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(processClientLeadDoc);
    }, []);

    const getClientLeadsForTeam = useCallback(async (teamId: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const q = query(collection(db, 'clientLeads'), where('teamId', '==', teamId), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(processClientLeadDoc);
    }, []);

    const getClientLeadActivities = useCallback(async (clientLeadId: string) => {
        const db = getFirestoreInstance();
        if (!db) return [];
        const q = query(collection(db, 'clientLeadActivities'), where('clientLeadId', '==', clientLeadId), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(processClientLeadActivityDoc);
    }, []);

    const addClientLeadActivity = useCallback(async (clientLeadId: string, note: string) => {
        const db = getFirestoreInstance();
        if (!user || !userData || !db) return;

        // Fetch lead to get marketCenterId and ownerId for the activity doc
        const leadSnap = await getDoc(doc(db, 'clientLeads', clientLeadId));
        if (!leadSnap.exists()) return;
        const leadData = leadSnap.data();

        await addDoc(collection(db, 'clientLeadActivities'), {
            clientLeadId, 
            userId: user.uid, 
            userName: userData.name, 
            note, 
            createdAt: serverTimestamp(),
            marketCenterId: leadData.marketCenterId || null,
            ownerId: leadData.ownerId || null,
            teamId: leadData.teamId || null
        });
    }, [user, userData]);

    const regenerateZapierApiKey = useCallback(async () => {
        const db = getFirestoreInstance();
        if (!user || !db) throw new Error("User not authenticated");
        const newKey = `ag_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
        await updateDoc(doc(db, 'users', user.uid), { zapierApiKey: newKey });
        return newKey;
    }, [user]);

    const getWebhooks = useCallback(async () => {
        const db = getFirestoreInstance();
        if (!user || !db) return {};
        const snap = await getDoc(doc(db, 'users', user.uid));
        return snap.data()?.webhooks || {};
    }, [user]);

    const saveWebhook = useCallback(async (event: string, url: string) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await updateDoc(doc(db, 'users', user.uid), { [`webhooks.${event}`]: url });
    }, [user]);

    const deleteWebhook = useCallback(async (event: string) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await updateDoc(doc(db, 'users', user.uid), { [`webhooks.${event}`]: deleteField() });
    }, [user]);

    const addTodo = useCallback(async (data: Partial<Omit<TodoItem, 'id' | 'userId' | 'createdAt' | 'isCompleted'>>) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await addDoc(collection(db, 'todos'), {
            ...data, userId: user.uid, isCompleted: false, createdAt: serverTimestamp(), order: Date.now()
        });
    }, [user]);

    const updateTodo = useCallback(async (todoId: string, updates: Partial<TodoItem>) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'todos', todoId), updates);
    }, []);

    const deleteTodo = useCallback(async (todoId: string) => {
        const db = getFirestoreInstance();
        if (!db) return;
        await deleteDoc(doc(db, 'todos', todoId));
    }, []);

    const getTodosForUserDateRange = useCallback(async (startDate: string, endDate: string) => {
        const db = getFirestoreInstance();
        if (!user || !db) return [];
        const q = query(collection(db, 'todos'), where('userId', '==', user.uid), where('dueDate', '>=', startDate), where('dueDate', '<=', endDate));
        const snap = await getDocs(q);
        return snap.docs.map(processTodoItemDoc);
    }, [user]);

    const getUndatedTodosForUser = useCallback(async () => {
        const db = getFirestoreInstance();
        if (!user || !db) return [];
        const q = query(collection(db, 'todos'), where('userId', '==', user.uid), where('dueDate', '==', null));
        const snap = await getDocs(q);
        return snap.docs.map(processTodoItemDoc);
    }, [user]);

    const getLinkableContacts = useCallback(async () => {
        const [leads, candidates] = await Promise.all([
            getClientLeadsForUser(user?.uid || ''),
            getCandidatesForRecruiter(user?.uid || '')
        ]);
        return { leads, candidates };
    }, [user, getClientLeadsForUser, getCandidatesForRecruiter]);

    const sendSms = useCallback(async (to: string, body: string) => {
        if (!userData?.twilioSid || !userData?.twilioToken || !userData?.twilioNumber) {
            return { success: false, error: 'Twilio is not configured in your profile.' };
        }
        try {
            const response = await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sid: userData.twilioSid,
                    token: userData.twilioToken,
                    from: userData.twilioNumber,
                    to,
                    body
                })
            });
            
            const result = await response.json();
            if (response.ok) return { success: true };
            
            return { success: false, error: result.details || result.error || 'Failed to send SMS' };
        } catch (err) {
            console.error("SMS Fetch Error:", err);
            return { success: false, error: 'Cannot connect to server. Ensure you are running the backend Node server.' };
        }
    }, [userData]);

    const updateDashboardLayout = useCallback(async (layout: DashboardWidgetConfig[]) => {
        const db = getFirestoreInstance();
        if (!user || !db) return;
        await updateDoc(doc(db, 'users', user.uid), { dashboardLayout: layout });
    }, [user]);

    const value = useMemo(() => ({
        user, userData, mcBranding, loading, managedAgents, loadingAgents, agentsError,
        signUpWithEmail, createAccountForAgent, signInWithEmail, logout,
        updateUserProfile, updatePassword, joinTeam, createTeam, updateTheme, getTeamById, getUsersByIds,
        getAllUsers, getUsersForMarketCenter, leaveTeam, removeAgentFromTeam, getUserById, updateUserNewAgentStatus, getNewAgentResourcesForUser,
        saveNewAgentResources, updateUserMetrics, assignHomeworkToUser, getAssignedResourcesForUser,
        getHomeworkForManagedUsers, getHabitLogsForManagedUsers, getHabitLogsForUser, deleteHomeworkForUser, getCommissionProfileForUser,
        saveCommissionProfile, getTransactionsForManagedUsers, getTransactionsForUser, getAllCommissionProfiles, addPerformanceLog, 
        getPerformanceLogsForAgent, getPerformanceLogsForCurrentUser, getPerformanceLogsForManagedUsers, updatePerformanceLog, updateContributingAgents,
        updateCoachRoster, updateUserCoachAssignment, updateUserTeamAffiliation, updateUserAssignments, getBudgetModelForUser, saveBudgetModel, getMarketCenters, createMarketCenter, deleteMarketCenter, assignMcAdmin,
        removeMcAdmin, updateUserMarketCenter, updateUserMarketCenterForAdmin, updateUserRole, updateUserRoleAndMarketCenterAffiliation, getAllTeams, getAllTransactionsForAdmin,
        updatePlaybookProgress, updateOnboardingChecklistProgress, getOrgBlueprintForUser, getPlaybooksForUser,
        getTransactionsForMarketCenter, getCommissionProfilesForMarketCenter, getBudgetModelsForMarketCenter, getCandidatesForMarketCenter,
        getCandidatesForRecruiter,
        addCandidate, updateCandidate, deleteCandidate, getCandidateActivities, addCandidateActivity,
        addClientLead, updateClientLead, deleteClientLead, getClientLeadsForUser, getClientLeadsForTeam, getClientLeadActivities, addClientLeadActivity,
        regenerateZapierApiKey, getWebhooks, saveWebhook, deleteWebhook,
        addTodo, updateTodo, deleteTodo, getTodosForUserDateRange, getUndatedTodosForUser, getLinkableContacts,
        sendSms, updateDashboardLayout
    }), [
        user, userData, mcBranding, loading, managedAgents, loadingAgents, agentsError,
        signUpWithEmail, createAccountForAgent, signInWithEmail, logout,
        updateUserProfile, updatePassword, joinTeam, createTeam, updateTheme, getTeamById, getUsersByIds,
        getAllUsers, getUsersForMarketCenter, leaveTeam, removeAgentFromTeam, getUserById, updateUserNewAgentStatus, getNewAgentResourcesForUser,
        saveNewAgentResources, updateUserMetrics, assignHomeworkToUser, getAssignedResourcesForUser,
        getHomeworkForManagedUsers, getHabitLogsForManagedUsers, getHabitLogsForUser, deleteHomeworkForUser, getCommissionProfileForUser,
        saveCommissionProfile, getTransactionsForManagedUsers, getTransactionsForUser, getAllCommissionProfiles, addPerformanceLog,
        getPerformanceLogsForAgent, getPerformanceLogsForCurrentUser, getPerformanceLogsForManagedUsers, updatePerformanceLog, updateContributingAgents,
        updateCoachRoster, updateUserCoachAssignment, updateUserTeamAffiliation, updateUserAssignments, getBudgetModelForUser, saveBudgetModel, getMarketCenters, createMarketCenter, deleteMarketCenter, assignMcAdmin,
        removeMcAdmin, updateUserMarketCenter, updateUserMarketCenterForAdmin, updateUserRole, updateUserRoleAndMarketCenterAffiliation, getAllTeams, getAllTransactionsForAdmin,
        updatePlaybookProgress, updateOnboardingChecklistProgress, getOrgBlueprintForUser, getPlaybooksForUser,
        getTransactionsForMarketCenter, getCommissionProfilesForMarketCenter, getBudgetModelsForMarketCenter, getCandidatesForMarketCenter,
        getCandidatesForRecruiter,
        addCandidate, updateCandidate, deleteCandidate, getCandidateActivities, addCandidateActivity,
        addClientLead, updateClientLead, deleteClientLead, getClientLeadsForUser, getClientLeadsForTeam, getClientLeadActivities, addClientLeadActivity,
        regenerateZapierApiKey, getWebhooks, saveWebhook, deleteWebhook,
        addTodo, updateTodo, deleteTodo, getTodosForUserDateRange, getUndatedTodosForUser, getLinkableContacts,
        sendSms, updateDashboardLayout
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};