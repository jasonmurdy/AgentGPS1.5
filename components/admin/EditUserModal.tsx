import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../ui/Card';
import { X } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import type { TeamMember, MarketCenter } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: { newRole: TeamMember['role'], newMarketCenterId: string | null, newAssignedLearningPathId: string | null, newAssignedHabitTrackerTemplateId: string | null }) => Promise<void>;
    agent: TeamMember;
    marketCenters: MarketCenter[];
    learningPaths: LearningPath[];
    habitTrackerTemplates: HabitTrackerTemplate[];
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, onSave, agent, marketCenters, learningPaths, habitTrackerTemplates }) => {
    const { userData } = useAuth();
    const isCurrentUserSuperAdmin = userData?.isSuperAdmin;
    const [selectedRole, setSelectedRole] = useState<TeamMember['role']>(agent.role || 'agent');
    const [selectedMarketCenterId, setSelectedMarketCenterId] = useState<string>(agent.marketCenterId || '');
    const [selectedLearningPathId, setSelectedLearningPathId] = useState<string>(agent.assignedLearningPathId || '');
    const [selectedHabitTrackerTemplateId, setSelectedHabitTrackerTemplateId] = useState<string>(agent.assignedHabitTrackerTemplateId || '');
    const [loading, setLoading] = useState(false);
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSelectedRole(agent.role || 'agent');
            setSelectedMarketCenterId(agent.marketCenterId || '');
            setSelectedLearningPathId(agent.assignedLearningPathId || '');
            setSelectedHabitTrackerTemplateId(agent.assignedHabitTrackerTemplateId || '');
            setLocalError('');
        }
    }, [isOpen, agent]);

    const availableRoles: { value: TeamMember['role']; label: string }[] = [
        { value: 'agent', label: 'Agent' },
        { value: 'team_leader', 'label': 'Team Leader' },
        { value: 'productivity_coach', label: 'Productivity Coach' },
        { value: 'recruiter', label: 'Recruiter' },
        { value: 'market_center_admin', label: 'MC Admin' },
    ];
    
    // A Super Admin's role cannot be changed.
    if (agent.isSuperAdmin) {
        if(isOpen) onClose();
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setLocalError('');

        if (selectedRole === 'market_center_admin' && !selectedMarketCenterId) {
            setLocalError('Market Center must be selected for an MC Admin role.');
            setLoading(false);
            return;
        }

        try {
            await onSave({
                newRole: selectedRole,
                newMarketCenterId: selectedMarketCenterId === '' ? null : selectedMarketCenterId,
                newAssignedLearningPathId: selectedLearningPathId === '' ? null : selectedLearningPathId,
                newAssignedHabitTrackerTemplateId: selectedHabitTrackerTemplateId === '' ? null : selectedHabitTrackerTemplateId,
            });
            onClose();
        } catch (error) {
            console.error("Failed to update user:", error);
            alert("An error occurred while updating the user. Please try again.");
            setLocalError('Failed to save changes.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClasses = "w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary";
    const labelClasses = "block text-sm font-medium text-text-secondary mb-1";

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
            <Card className="w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 id="edit-user-title" className="text-xl font-bold">Edit User</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-primary/5" aria-label="Close edit user dialog"><X/></button>
                </div>
                <p className="mb-6 text-text-secondary">Editing user: <span className="font-bold text-text-primary">{agent.name}</span>.</p>
                {localError && (
                    <p className="bg-destructive-surface text-destructive text-sm text-center p-3 rounded-md mb-4">
                        {localError}
                    </p>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="role-select" className={labelClasses}>Role</label>
                            <select
                                id="role-select"
                                value={selectedRole}
                                onChange={e => setSelectedRole(e.target.value as TeamMember['role'])}
                                className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                {availableRoles.map(role => (
                                    (role.value !== 'market_center_admin' || isCurrentUserSuperAdmin) &&
                                    <option key={role.value} value={role.value}>{role.label}</option>
                                ))}
                            </select>
                        </div>
                        {selectedRole === 'market_center_admin' && (
                            <div>
                                <label htmlFor="mc-select" className={labelClasses}>Market Center</label>
                                <select
                                    id="mc-select"
                                    value={selectedMarketCenterId}
                                    onChange={e => setSelectedMarketCenterId(e.target.value)}
                                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                                    required={selectedRole === 'market_center_admin'}
                                >
                                    <option value="">-- Select Market Center --</option>
                                    {marketCenters.map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
                                </select>
                            </div>
                        )}
                        {selectedRole !== 'market_center_admin' && (
                            <div>
                                <label htmlFor="mc-select" className={labelClasses}>Market Center (Optional)</label>
                                <select
                                    id="mc-select"
                                    value={selectedMarketCenterId}
                                    onChange={e => setSelectedMarketCenterId(e.target.value)}
                                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="">-- No Market Center --</option>
                                    {marketCenters.map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label htmlFor="learning-path-select" className={labelClasses}>Learning Path</label>
                            <select
                                id="learning-path-select"
                                value={selectedLearningPathId}
                                onChange={e => setSelectedLearningPathId(e.target.value)}
                                className={inputClasses}
                            >
                                <option value="">-- No Learning Path --</option>
                                {learningPaths.map(lp => <option key={lp.id} value={lp.id}>{lp.title}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="habit-tracker-select" className={labelClasses}>Daily Tracker Template</label>
                            <select
                                id="habit-tracker-select"
                                value={selectedHabitTrackerTemplateId}
                                onChange={e => setSelectedHabitTrackerTemplateId(e.target.value)}
                                className={inputClasses}
                            >
                                <option value="">-- No Daily Tracker Template --</option>
                                {habitTrackerTemplates.map(ht => <option key={ht.id} value={ht.title}>{ht.title}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-6">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg text-text-secondary hover:bg-primary/10">Cancel</button>
                        <button type="submit" disabled={loading} className="min-w-[120px] flex justify-center items-center py-2 px-4 rounded-lg bg-primary text-on-accent font-semibold hover:bg-opacity-90 disabled:bg-opacity-50">
                            {loading ? <Spinner /> : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </Card>
        </div>,
        document.body
    );
};