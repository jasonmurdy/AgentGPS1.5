import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { Goal } from '../types';
import { useAuth, P } from './AuthContext';
import { getFirestoreInstance } from '../firebaseConfig';
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    addDoc, 
    doc, 
    updateDoc, 
    increment,
    getDocs,
    serverTimestamp,
    orderBy,
    Timestamp,
    deleteDoc,
    runTransaction,
    limit
} from 'firebase/firestore';
import { createNotification } from '../lib/notifications';
import { processGoalDoc } from '../lib/firestoreUtils';

interface GoalContextType {
  goals: Goal[];
  personalGoals: Goal[];
  addGoal: (goal: Omit<Goal, 'id' | 'currentValue' | 'userId' | 'teamId' | 'marketCenterId' | 'createdAt' | 'userName' | 'startDate' | 'endDate' | 'coachId'> & { startDate?: string, endDate?: string }, targetUserId?: string) => Promise<void>;
  updateGoal: (goalId: string, updates: Partial<Omit<Goal, 'id'>>) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  updateGoalProgress: (goalId: string, valueToAdd: number) => Promise<void>;
  resetGoalProgress: (goalId: string) => Promise<void>;
  toggleGoalArchiveStatus: (goalId: string, currentStatus: boolean) => Promise<void>;
  loading: boolean;
  getGoalsForUser: (userId: string) => Promise<Goal[]>;
  getPublicGoals: () => Promise<Goal[]>;
  getAllGoals: () => Promise<Goal[]>;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

export const GoalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [personalGoals, setPersonalGoals] = useState<Goal[]>([]);
  const [teamSharedGoals, setTeamSharedGoals] = useState<Goal[]>([]);
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const { user, userData, managedAgents, loading: authLoading, getUserById } = useAuth();

  // Effect for fetching personal goals, depends only on user auth state
  useEffect(() => {
    const db = getFirestoreInstance();
    if (authLoading || !db) {
      setLoadingPersonal(true);
      return;
    }
    if (!user) {
      setPersonalGoals([]);
      setLoadingPersonal(false);
      return;
    }

    setLoadingPersonal(true);
    const goalsCollectionRef = collection(db, 'goals');
    const personalQuery = query(goalsCollectionRef, where("userId", "==", user.uid));
    
    const unsubscribe = onSnapshot(personalQuery, (querySnapshot) => {
      setPersonalGoals(querySnapshot.docs.map(processGoalDoc));
      setLoadingPersonal(false);
    }, (error) => {
      console.error("Error fetching personal goals:", error.message);
      setPersonalGoals([]);
      setLoadingPersonal(false);
    });
    
    return () => unsubscribe();
  }, [user, authLoading]);

  // Effect for fetching team/managed goals, depends on user data and managed agents list
  useEffect(() => {
    const db = getFirestoreInstance();
    if (authLoading || !user || !userData || !db) {
      setLoadingTeam(true);
      return;
    }

    const isManager = P.isTeamLeader(userData); // Includes coach, mc admin, super admin

    // For regular agents, fetch only visible goals from their team
    if (!isManager) {
        const fetchTeamGoals = async () => {
            if (!userData.teamId) {
                setTeamSharedGoals([]);
                setLoadingTeam(false);
                return;
            }
            setLoadingTeam(true);
            try {
                const q = query(
                    collection(db, 'goals'), 
                    where("teamId", "==", userData.teamId), 
                    where("visibility", "in", ["public", "team_view_only"])
                );
                const snapshot = await getDocs(q);
                const sharedGoals = snapshot.docs.map(processGoalDoc).filter(g => g.userId !== user?.uid);
                setTeamSharedGoals(sharedGoals);
            } catch (error) {
                console.error("Error fetching team goals for agent:", error);
                setTeamSharedGoals([]);
            } finally {
                setLoadingTeam(false);
            }
        };
        fetchTeamGoals();
        return; // No unsubscribe needed for getDocs
    }
    
    // For managers, fetch all goals for their managed agents
    if (managedAgents.length === 0) {
        setTeamSharedGoals([]);
        setLoadingTeam(false);
        return;
    }

    const agentIds = managedAgents.map(a => a.id);
    if (agentIds.length === 0) {
        setTeamSharedGoals([]);
        setLoadingTeam(false);
        return;
    }

    setLoadingTeam(true);
    const goalsCollectionRef = collection(db, 'goals');
    let q;

    if (P.isSuperAdmin(userData)) {
        // Super Admin can see everything, but let's limit to something reasonable or just personal for now
        // if they want to see all, they can use getAllGoals
        q = query(goalsCollectionRef, limit(100)); 
    } else if (P.isMcAdmin(userData) && userData.marketCenterId) {
        // MC Admin and Coaches can see all goals in their Market Center
        q = query(goalsCollectionRef, where('marketCenterId', '==', userData.marketCenterId));
    } else if (userData.role === 'team_leader' && userData.teamId) {
        // Team Leaders can see all goals in their Team
        q = query(goalsCollectionRef, where('teamId', '==', userData.teamId));
    }
    
    if (!q) {
        setTeamSharedGoals([]);
        setLoadingTeam(false);
        return;
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setTeamSharedGoals(snapshot.docs.map(processGoalDoc));
        setLoadingTeam(false);
    }, (error) => {
        console.error("Error fetching goals for managed agents:", error.message);
        setTeamSharedGoals([]);
        setLoadingTeam(false);
    });

    return () => unsubscribe();

  }, [authLoading, user, userData, managedAgents]);


  const goals = useMemo(() => {
    const allGoalsMap = new Map<string, Goal>();
    [...personalGoals, ...teamSharedGoals].forEach(g => allGoalsMap.set(g.id, g));
    return Array.from(allGoalsMap.values());
  }, [personalGoals, teamSharedGoals]);

  const loading = useMemo(() => authLoading || loadingPersonal || loadingTeam, [authLoading, loadingPersonal, loadingTeam]);

  const addGoal = useCallback(async (newGoal: Omit<Goal, 'id' | 'currentValue' | 'userId' | 'teamId' | 'marketCenterId' | 'createdAt' | 'userName' | 'startDate' | 'endDate' | 'coachId'> & { startDate?: string, endDate?: string }, targetUserId?: string) => {
    const db = getFirestoreInstance();
    if (!user || !db) throw new Error("User not authenticated or Firebase not configured.");
    
    const finalUserId = targetUserId || user.uid;
    let targetUserData = null;

    if (finalUserId === user.uid) {
        targetUserData = userData;
    } else if (finalUserId) {
        targetUserData = await getUserById(finalUserId);
    }

    const goalToAdd: any = {
      ...newGoal,
      currentValue: 0,
      userId: finalUserId,
      userName: targetUserData?.name,
      teamId: targetUserData?.teamId || null,
      marketCenterId: targetUserData?.marketCenterId || null,
      coachId: targetUserData?.coachId || null, // Add coachId
      createdAt: serverTimestamp(),
      isArchived: false,
    };
    
    if (newGoal.startDate) {
        goalToAdd.startDate = Timestamp.fromDate(new Date(newGoal.startDate));
    }
    if (newGoal.endDate) {
        goalToAdd.endDate = Timestamp.fromDate(new Date(newGoal.endDate));
    }
    
    await addDoc(collection(db, 'goals'), goalToAdd);
    
    if (targetUserId && user && targetUserId !== user.uid) {
        const message = `${userData?.name || 'A coach'} assigned you a new goal: "${newGoal.title}".`;
        const link = targetUserData?.role === 'agent' ? '/goals' : '/coach-goals';
        await createNotification({
            userId: targetUserId,
            message: message,
            link: link,
            triggeredByUserId: user.uid,
            triggeredByUserName: userData?.name
        });
    }

  }, [user, userData, getUserById]);

  const updateGoal = useCallback(async (goalId: string, updates: Partial<Omit<Goal, 'id'>>) => {
    const db = getFirestoreInstance();
    if (!user || !db) throw new Error("User not authenticated or Firebase not configured.");
    const goalDocRef = doc(db, 'goals', goalId);
    
    const updatesWithTimestamp: any = { ...updates };
    if (updates.startDate) {
        updatesWithTimestamp.startDate = Timestamp.fromDate(new Date(updates.startDate));
    }
    if (updates.endDate) {
        updatesWithTimestamp.endDate = Timestamp.fromDate(new Date(updates.endDate));
    }

    await updateDoc(goalDocRef, updatesWithTimestamp);
  }, [user]);

  const deleteGoal = useCallback(async (goalId: string) => {
    const db = getFirestoreInstance();
    if (!user || !db) throw new Error("User not authenticated or Firebase not configured.");
    const goalDocRef = doc(db, 'goals', goalId);
    await deleteDoc(goalDocRef);
  }, [user]);

  const toggleGoalArchiveStatus = useCallback(async (goalId: string, currentStatus: boolean) => {
    const db = getFirestoreInstance();
    if (!user || !db) throw new Error("User not authenticated or Firebase not configured.");
    const goalDocRef = doc(db, 'goals', goalId);
    await updateDoc(goalDocRef, { isArchived: !currentStatus });
  }, [user]);


  const updateGoalProgress = useCallback(async (goalId: string, valueToAdd: number) => {
    const db = getFirestoreInstance();
    if (!user?.uid || !db) throw new Error("User not authenticated or Firebase not configured.");
    const goalDocRef = doc(db, 'goals', goalId);

    try {
        await runTransaction(db, async (transaction) => {
            const goalDoc = await transaction.get(goalDocRef);
            if (!goalDoc.exists()) {
                throw "Goal document does not exist!";
            }

            const goalData = goalDoc.data();
            const goalOwnerId = goalData.userId;
            if (!goalOwnerId) {
                throw "Goal has no owner!";
            }

            const userDocRef = doc(db, 'users', goalOwnerId);

            transaction.update(goalDocRef, { currentValue: increment(valueToAdd) });
            transaction.update(userDocRef, { goalScore: increment(valueToAdd) });
        });
    } catch (error) {
        console.error("Failed to update goal progress in transaction:", (error as Error).message);
        throw error;
    }
  }, [user]);

  const resetGoalProgress = useCallback(async (goalId: string) => {
    const db = getFirestoreInstance();
    if (!user?.uid || !db) throw new Error("User not authenticated or Firebase not configured.");
    const goalDocRef = doc(db, 'goals', goalId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const goalDoc = await transaction.get(goalDocRef);
            if (!goalDoc.exists()) {
                throw "Goal document does not exist!";
            }
            
            const goalData = goalDoc.data();
            const valueToDecrement = Number(goalData.currentValue) || 0;
            
            if (valueToDecrement === 0) {
                return;
            }
            
            const goalOwnerId = goalData.userId;
            if (!goalOwnerId) {
                throw "Goal has no owner!";
            }

            const userDocRef = doc(db, 'users', goalOwnerId);
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw "User to update does not exist!";
            }

            transaction.update(goalDocRef, { currentValue: 0 });
            transaction.update(userDocRef, { goalScore: increment(-valueToDecrement) });
        });
    } catch (error) {
        console.error("Failed to reset goal progress in transaction:", (error as Error).message);
        throw error;
    }
  }, [user]);

  const getGoalsForUser = useCallback(async (userId: string): Promise<Goal[]> => {
    const db = getFirestoreInstance();
    if (!user || !userData || !db) return [];

    const goalsCollectionRef = collection(db, 'goals');
    let q;
    const isManagerViewing = userId !== user.uid;

    if (isManagerViewing) {
        const agentProfile = await getUserById(userId);
        if (!agentProfile) return [];

        try {
            if (P.isSuperAdmin(userData)) {
                q = query(goalsCollectionRef, where("userId", "==", userId));
            } else if (P.isMcAdmin(userData) && userData.marketCenterId === agentProfile.marketCenterId) {
                q = query(goalsCollectionRef, where("userId", "==", userId), where("marketCenterId", "==", userData.marketCenterId));
            } else if (P.isCoach(userData) && agentProfile.coachId === user.uid) {
                q = query(goalsCollectionRef, where("userId", "==", userId), where("coachId", "==", user.uid));
            } else if (P.isTeamLeader(userData) && userData.teamId === agentProfile.teamId) {
                q = query(goalsCollectionRef, where("userId", "==", userId), where("teamId", "==", userData.teamId));
            } else {
                return []; // Not a manager of this agent, return empty array.
            }

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(processGoalDoc);
        } catch (error) {
            console.warn("Collection query failed for goals, falling back to individual fetch:", error);
            // Fallback: If collection query fails (likely due to rules), we can't easily fetch all goals
            // unless we know the IDs. Since we don't, we return empty or try a broader query if allowed.
            return [];
        }
    } else {
        // Fetching own goals
        q = query(goalsCollectionRef, where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(processGoalDoc);
    }
  }, [user, userData, getUserById]);

  const getPublicGoals = useCallback(async (): Promise<Goal[]> => {
    const db = getFirestoreInstance();
    if (!db) return [];
    const goalsCollectionRef = collection(db, 'goals');
    const q = query(
        goalsCollectionRef, 
        where("visibility", "==", "public"),
        orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(processGoalDoc);
  }, []);

  const getAllGoals = useCallback(async (): Promise<Goal[]> => {
    const db = getFirestoreInstance();
    // Prevent the query from even running if the user is not a super admin
    if (!db || !userData || !P.isSuperAdmin(userData)) {
        console.warn("Unauthorized or missing db instance for getAllGoals.");
        return [];
    }

    try {
        const goalsCollectionRef = collection(db, 'goals');
        const querySnapshot = await getDocs(goalsCollectionRef);
        return querySnapshot.docs.map(processGoalDoc);
    } catch (error) {
        console.error("Error fetching all goals:", error);
        return [];
    }
  }, [userData]);


  const value = useMemo(() => ({ goals, personalGoals, addGoal, updateGoal, deleteGoal, loading, updateGoalProgress, resetGoalProgress, toggleGoalArchiveStatus, getGoalsForUser, getPublicGoals, getAllGoals }),
    [goals, personalGoals, addGoal, updateGoal, deleteGoal, loading, updateGoalProgress, resetGoalProgress, toggleGoalArchiveStatus, getGoalsForUser, getPublicGoals, getAllGoals]
  );

  return (
    <GoalContext.Provider value={value}>
      {children}
    </GoalContext.Provider>
  );
};

export const useGoals = (): GoalContextType => {
  const context = useContext(GoalContext);
  if (!context) {
    throw new Error('useGoals must be used within a GoalProvider');
  }
  return context;
};