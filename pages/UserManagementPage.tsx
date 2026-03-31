import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import type { TeamMember, Team, MarketCenter, LearningPath, HabitTrackerTemplate } from '../types';
import { Users as UsersIcon, Search, SlidersHorizontal, Edit, UserPlus, X } from 'lucide-react';
import { EditUserModal } from '../components/admin/EditUserModal';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, getDocs } from 'firebase/firestore';
// Fix: 'db' is not an exported member of '../firebaseConfig'. Replaced with 'getFirestoreInstance'.
import { getFirestoreInstance } from '../firebaseConfig';
import { createPortal } from 'react-dom';

const formatRole = (role: TeamMember['role'], isSuperAdmin?: boolean) => {
    if (isSuperAdmin) return 'Super Admin';
    if (role === 'team_leader') return 'Team Leader';
    if (role === 'productivity_coach') return 'Productivity Coach';
    if (role === 'market_center_admin') return 'MC Admin';
    if (role === 'recruiter') return 'Recruiter';
    return 'Agent';
};

const RoleBadge: React.FC<{ role: TeamMember['role'], isSuperAdmin?: boolean }> = ({ role, isSuperAdmin }) => {
    const roleConfig = {
        'Super Admin': 'bg-red-500 text-white',
        'MC Admin': 'bg-purple-500 text-white',
        'Productivity Coach': 'bg-blue-500 text-white',
        'Team Leader': 'bg-green-500 text-white',
        'Recruiter': 'bg-yellow-400 text-black',
        'Agent': 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200',
    };
    const roleText = formatRole(role, isSuperAdmin);
    const classes = roleConfig[roleText as keyof typeof roleConfig] || roleConfig['Agent'];

    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${classes}`}>{roleText}</span>;
}

// New Mobile Card Component for each user
const UserMobileCard: React.FC<{
    user: TeamMember;
    teams: Map<string, string>;
    marketCenters: Map<string, MarketCenter>;
    currentUserData: TeamMember | null;
    onOpenEditModal: (user: TeamMember) => void;
}> = ({ user, teams, marketCenters, currentUserData, onOpenEditModal }) => {
    const canEdit = currentUserData?.isSuperAdmin && user.id !== currentUserData?.id;
    return (
        <Card className="mb-4">
            <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-lg text-text-primary">{user.name}</p>
                {canEdit && (
                    <button
                        onClick={() => onOpenEditModal(user)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-full"
                        title="Edit User"
                    >
                        <Edit size={16} />
                    </button>
                )}
            </div>
            <p className="text-sm text-text-secondary">{user.email}</p>
            <div className="mt-2 text-sm">
                <p className="flex items-center gap-2"><strong>Role:</strong> <RoleBadge role={user.role} isSuperAdmin={user.isSuperAdmin} /></p>
                <p><strong>Market Center:</strong> {user.marketCenterId ? (marketCenters.get(user.marketCenterId)?.name || 'N/A') : 'N/A'}</p>
                <p><strong>Team:</strong> {user.teamId ? (teams.get(user.teamId) || 'N/A') : 'N/A'}</p>
            </div>
        </Card>
    );
};

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string; email: string; password: string; role: TeamMember['role']; teamId: string | null; marketCenterId: string | null; }) => Promise<void>;
    teams: Team[];
    marketCenters: MarketCenter[];
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSave, teams, marketCenters }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<TeamMember['role']>('agent');
    const [teamId, setTeamId] = useState('');
    const [marketCenterId, setMarketCenterId] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave({ name, email, password, role, teamId: teamId || null, marketCenterId: marketCenterId || null });
            onClose();
            // Reset form fields
            setName('');
            setEmail('');
            setPassword('');
            setRole('agent');
            setTeamId('');
            setMarketCenterId('');
        } catch (error: any) {
            alert("Error creating user: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm";
    const labelClasses = "block text-xs font-medium text-text-secondary mb-1";

    return createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Create New User</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-primary/5"><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelClasses}>Full Name</label>
                        <input type="text" required value={name} onChange={e => setName(e.target.value)} className={inputClasses} placeholder="John Doe"/>
                    </div>
                    <div>
                        <label className={labelClasses}>Email</label>
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClasses} placeholder="john@example.com"/>
                    </div>
                    <div>
                        <label className={labelClasses}>Temporary Password</label>
                        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClasses} placeholder="******"/>
                    </div>
                    <div>
                        <label className={labelClasses}>Role</label>
                        <select value={role} onChange={e => setRole(e.target.value as any)} className={inputClasses}>
                            <option value="agent">Agent</option>
                            <option value="team_leader">Team Leader</option>
                            <option value="productivity_coach">Productivity Coach</option>
                            <option value="recruiter">Recruiter</option>
                            <option value="market_center_admin">MC Admin</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClasses}>Market Center</label>
                            <select value={marketCenterId} onChange={e => setMarketCenterId(e.target.value)} className={inputClasses}>
                                <option value="">None</option>
                                {marketCenters.map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Team</label>
                            <select value={teamId} onChange={e => setTeamId(e.target.value)} className={inputClasses}>
                                <option value="">None</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-text-secondary hover:bg-primary/5">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-primary text-on-accent font-semibold flex items-center justify-center min-w-[100px]">
                            {loading ? <Spinner className="w-4 h-4"/> : 'Create User'}
                        </button>
                    </div>
                </form>
            </Card>
        </div>,
        document.body
    );
};


const UserManagementPage: React.FC = () => {
    const { getAllUsers, getAllTeams, getMarketCenters, updateUserRoleAndMarketCenterAffiliation, createAccountForAgent, userData: currentUserData } = useAuth();
    const [users, setUsers] = useState<TeamMember[]>([]);
    const [teams, setTeams] = useState<Map<string, string>>(new Map());
    const [allTeams, setAllTeams] = useState<Team[]>([]); // Keep raw array for modal
    const [marketCenters, setMarketCenters] = useState<Map<string, MarketCenter>>(new Map());
    const [allMarketCenters, setAllMarketCenters] = useState<MarketCenter[]>([]); // Keep raw array for modal
    const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
    const [habitTrackerTemplates, setHabitTrackerTemplates] = useState<HabitTrackerTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [filters, setFilters] = useState({ role: 'all', mcId: 'all', teamId: 'all', search: '' });
    type SortKey = keyof TeamMember | 'teamName' | 'mcName';
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<TeamMember | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const mcId = currentUserData?.role === 'market_center_admin' ? currentUserData.marketCenterId : undefined;
            const [usersData, teamsData, mcData, learningPathsSnap, habitTrackerSnap] = await Promise.all([
                getAllUsers(mcId),
                getAllTeams(mcId),
                getMarketCenters(),
                getDocs(collection(getFirestoreInstance(), 'learningPaths')),
                getDocs(collection(getFirestoreInstance(), 'habitTrackerTemplates')),
            ]);
            
            setUsers(usersData);
            setAllTeams(teamsData);
            setTeams(new Map(teamsData.map(t => [t.id, t.name])));
            setAllMarketCenters(mcData);
            setMarketCenters(new Map(mcData.map(mc => [mc.id, mc])));
            setLearningPaths(learningPathsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearningPath)));
            setHabitTrackerTemplates(habitTrackerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HabitTrackerTemplate)));

        } catch (error) {
            console.error("Failed to fetch user management data:", error);
            // Critical Directive: Error Handling Spec
            const errInfo = {
                error: error instanceof Error ? error.message : String(error),
                operationType: 'list',
                path: 'UserManagementPage',
                authInfo: {
                    userId: 'unknown', // Need to get auth.currentUser
                    email: 'unknown',
                    // ...
                }
            };
            console.error('Firestore Error: ', JSON.stringify(errInfo));
        } finally {
            setLoading(false);
        }
    }, [getAllUsers, getAllTeams, getMarketCenters, currentUserData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1); // Reset to first page on filter change
    };

    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleOpenEditModal = (user: TeamMember) => {
        setUserToEdit(user);
        setIsEditModalOpen(true);
    };

    const handleSaveUser = async (updates: { newRole: TeamMember['role'], newMarketCenterId: string | null, newAssignedLearningPathId: string | null, newAssignedHabitTrackerTemplateId: string | null }) => {
        if (!userToEdit) return;

        // Use the comprehensive function to update role AND handle MC adminIds array
        await updateUserRoleAndMarketCenterAffiliation(userToEdit.id, updates.newRole, updates.newMarketCenterId);
        await updateUserAssignments(userToEdit.id, updates.newAssignedLearningPathId, updates.newAssignedHabitTrackerTemplateId);
        
        fetchData(); // Refetch all data to ensure consistency
    };

    const handleCreateUser = async (data: any) => {
        await createAccountForAgent(data.email, data.password, data.name, data.role, data.teamId, data.marketCenterId);
        fetchData();
    };

    const processedUsers = useMemo(() => {
        let filtered = [...users];
        
        // Filter logic
        if (filters.search) {
            const lowercasedSearch = filters.search.toLowerCase();
            filtered = filtered.filter(u => 
                u.name?.toLowerCase().includes(lowercasedSearch) ||
                u.email?.toLowerCase().includes(lowercasedSearch)
            );
        }
        if (filters.role !== 'all') {
            if (filters.role === 'super_admin') {
                filtered = filtered.filter(u => u.isSuperAdmin);
            } else {
                 filtered = filtered.filter(u => u.role === filters.role && !u.isSuperAdmin);
            }
        }
        if (filters.mcId !== 'all') {
            filtered = filtered.filter(u => u.marketCenterId === filters.mcId);
        }
        if (filters.teamId !== 'all') {
            filtered = filtered.filter(u => u.teamId === filters.teamId);
        }

        // Sorting logic
        filtered.sort((a, b) => {
            const key = sortConfig.key;
            const aVal = a[key as keyof TeamMember] ?? '';
            const bVal = b[key as keyof TeamMember] ?? '';
            
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [users, filters, sortConfig]);

    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return processedUsers.slice(startIndex, startIndex + itemsPerPage);
    }, [processedUsers, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(processedUsers.length / itemsPerPage);

    const SortableHeader: React.FC<{ sortKey: SortKey, children: React.ReactNode, className?: string }> = ({ sortKey, children, className }) => {
        const isSorted = sortConfig.key === sortKey;
        const icon = isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '';
        return (
            <th className={`p-3 font-semibold text-text-primary cursor-pointer ${className}`} onClick={() => requestSort(sortKey)}>
                {children} <span className="text-xs">{icon}</span>
            </th>
        );
    };

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Spinner className="w-10 h-10" /></div>;
    }

    return (
        <div className="h-full flex flex-col">
            <header className="p-4 sm:p-6 lg:p-8">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-text-primary flex items-center gap-4">
                            <UsersIcon className="text-accent-secondary" size={48} />
                            User Roster
                        </h1>
                        <p className="text-lg text-text-secondary mt-1">View, filter, and manage all users across the platform.</p>
                    </div>
                    {currentUserData?.isSuperAdmin && (
                        <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 bg-primary text-on-accent font-semibold py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors">
                            <UserPlus size={20} /> Create User
                        </button>
                    )}
                </div>
            </header>
            
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
                 <Card>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative">
                            <label htmlFor="search" className="text-xs font-semibold text-text-secondary">Search</label>
                            <Search size={16} className="absolute left-3 bottom-2.5 text-text-secondary" />
                            <input
                                id="search"
                                name="search"
                                type="text"
                                placeholder="Name or email..."
                                value={filters.search}
                                onChange={handleFilterChange}
                                className="w-full bg-input border border-border rounded-md pl-9 pr-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label htmlFor="role" className="text-xs font-semibold text-text-secondary">Role</label>
                            <select id="role" name="role" value={filters.role} onChange={handleFilterChange} className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary">
                                <option value="all">All Roles</option>
                                <option value="super_admin">Super Admin</option>
                                <option value="market_center_admin">MC Admin</option>
                                <option value="productivity_coach">Productivity Coach</option>
                                <option value="recruiter">Recruiter</option>
                                <option value="team_leader">Team Leader</option>
                                <option value="agent">Agent</option>
                            </select>
                        </div>
                         <div>
                            <label htmlFor="mcId" className="text-xs font-semibold text-text-secondary">Market Center</label>
                            <select id="mcId" name="mcId" value={filters.mcId} onChange={handleFilterChange} className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary">
                                <option value="all">All Market Centers</option>
                                {Array.from(marketCenters.entries()).map(([id, mc]) => <option key={id} value={id}>{mc.name} (#{mc.marketCenterNumber})</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="teamId" className="text-xs font-semibold text-text-secondary">Team</label>
                            <select id="teamId" name="teamId" value={filters.teamId} onChange={handleFilterChange} className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary">
                                <option value="all">All Teams</option>
                                {Array.from(teams.entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                            </select>
                        </div>
                    </div>
                </Card>

                <Card>
                    {/* Mobile View: Cards */}
                    <div className="block md:hidden space-y-4">
                        {paginatedUsers.length > 0 ? (
                            paginatedUsers.map(user => (
                                <UserMobileCard
                                    key={user.id}
                                    user={user}
                                    teams={teams}
                                    marketCenters={marketCenters}
                                    currentUserData={currentUserData}
                                    onOpenEditModal={handleOpenEditModal}
                                />
                            ))
                        ) : (
                            <p className="text-center text-text-secondary py-8">No users found matching your filters.</p>
                        )}
                    </div>

                    {/* Desktop View: Table */}
                    <div className="overflow-x-auto hidden md:block">
                         <table className="w-full text-sm text-left">
                            <thead className="bg-background/50">
                                <tr>
                                    <SortableHeader sortKey="name">Name</SortableHeader>
                                    <SortableHeader sortKey="email">Email</SortableHeader>
                                    <SortableHeader sortKey="role">Role</SortableHeader>
                                    <SortableHeader sortKey="marketCenterId">Market Center</SortableHeader>
                                    <SortableHeader sortKey="teamId">Team</SortableHeader>
                                    <th className="p-3 font-semibold text-text-primary">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedUsers.map(user => (
                                    <tr key={user.id} className="border-t border-border">
                                        <td className="p-3 font-semibold">{user.name}</td>
                                        <td className="p-3 text-text-secondary">{user.email}</td>
                                        <td className="p-3"><RoleBadge role={user.role} isSuperAdmin={user.isSuperAdmin} /></td>
                                        <td className="p-3 text-text-secondary">{user.marketCenterId ? (marketCenters.get(user.marketCenterId)?.name || 'N/A') : 'N/A'}</td>
                                        <td className="p-3 text-text-secondary">{user.teamId ? (teams.get(user.teamId) || 'N/A') : 'N/A'}</td>
                                        <td className="p-3">
                                            {(currentUserData?.isSuperAdmin) && (
                                                <button
                                                    onClick={() => handleOpenEditModal(user)}
                                                    className="p-2 text-primary hover:bg-primary/10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Edit User"
                                                    disabled={user.id === currentUserData?.id}
                                                >
                                                    <Edit size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>
                    {processedUsers.length === 0 && (
                        <p className="text-center text-text-secondary py-8">No users found matching your filters.</p>
                    )}
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-4">
                            <div>
                                <span className="text-sm text-text-secondary">
                                    Page {currentPage} of {totalPages} ({processedUsers.length} users)
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm rounded-md border border-border disabled:opacity-50">Prev</button>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-sm rounded-md border border-border disabled:opacity-50">Next</button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {userToEdit && (
                <EditUserModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveUser}
                    agent={userToEdit}
                    marketCenters={Array.from(marketCenters.values())}
                    learningPaths={learningPaths}
                    habitTrackerTemplates={habitTrackerTemplates}
                />
            )}
            <CreateUserModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={handleCreateUser}
                teams={allTeams}
                marketCenters={allMarketCenters}
            />
        </div>
    );
};

export default UserManagementPage;