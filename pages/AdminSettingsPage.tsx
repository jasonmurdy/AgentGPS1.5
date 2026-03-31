
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Link } from 'react-router-dom';
import { 
    Settings, 
    SlidersHorizontal, 
    Users, 
    Building, 
    Plus, 
    Trash2, 
    ClipboardCopy, 
    Link as LinkIcon, 
    Megaphone, 
    Send, 
    Calendar as CalendarIcon, 
    CheckCircle, 
    Image as ImageIcon, 
    Video as VideoIcon, 
    MinusCircle, 
    Info, 
    HelpCircle, 
    RefreshCw, 
    Save, 
    Zap, 
    KeyRound, 
    User,
    Palette
} from 'lucide-react';
import { useAuth, P } from '../contexts/AuthContext';
import type { MarketCenter, Announcement, LiveSession, MarketCenterBranding } from '../types';
import { Spinner } from '../components/ui/Spinner';
import { getFirestoreInstance, getStorageInstance } from '../firebaseConfig';
import { collection, getDocs, addDoc, serverTimestamp, orderBy, query, deleteDoc, doc, where, updateDoc, getDoc, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { RichTextEditor } from '../components/ui/RichTextEditor';
import { BrandedLogo } from '../components/ui/BrandedLogo';
import { ScheduleSessionModal } from '../components/launchpad/ScheduleSessionModal';
import { CURATED_FONTS, CURATED_PALETTES, CURATED_CORNER_STYLES } from '../constants/branding';

const getContrastColor = (hex: string) => {
    if (!hex) return 'white';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
};

const ConnectionCenter: React.FC = () => {
    const { userData, regenerateZapierApiKey, getWebhooks, saveWebhook, deleteWebhook } = useAuth();
    const [apiKey, setApiKey] = useState(userData?.zapierApiKey || '');
    const [loadingKey, setLoadingKey] = useState(!userData?.zapierApiKey);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
    const [webhooks, setWebhooks] = useState<Record<string, string>>({});
    const [webhookInputs, setWebhookInputs] = useState<Record<string, string>>({});
    const [loadingWebhooks, setLoadingWebhooks] = useState(true);
    const [savingWebhook, setSavingWebhook] = useState<string | null>(null);

    const AVAILABLE_TRIGGERS = {
        'new_goal': 'New Goal Created',
        'new_transaction': 'New Transaction Logged',
        'new_client_lead': 'New Client Lead Added',
    };

    useEffect(() => {
        if (!userData?.zapierApiKey) {
            regenerateZapierApiKey().then(newKey => {
                setApiKey(newKey);
                setLoadingKey(false);
            });
        }
    }, [userData?.zapierApiKey, regenerateZapierApiKey]);

    useEffect(() => {
        getWebhooks().then(fetchedWebhooks => {
            setWebhooks(fetchedWebhooks);
            setWebhookInputs(fetchedWebhooks);
            setLoadingWebhooks(false);
        });
    }, [getWebhooks]);

    const handleRegenerateKey = async () => {
        if (window.confirm("Are you sure? Regenerating your API key will break any existing integrations.")) {
            setLoadingKey(true);
            const newKey = await regenerateZapierApiKey();
            setApiKey(newKey);
            setLoadingKey(false);
        }
    };

    const handleCopyKey = () => {
        navigator.clipboard.writeText(apiKey);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000);
    };
    
    const handleWebhookInputChange = (eventKey: string, value: string) => {
        setWebhookInputs(prev => ({ ...prev, [eventKey]: value }));
    };

    const handleSaveWebhook = async (eventKey: string) => {
        const url = webhookInputs[eventKey];
        if (!url || !url.startsWith('https://hooks.zapier.com/')) {
            alert('Please enter a valid Zapier webhook URL.');
            return;
        }
        setSavingWebhook(eventKey);
        await saveWebhook(eventKey, url);
        setWebhooks(prev => ({ ...prev, [eventKey]: url }));
        setSavingWebhook(null);
    };

    const handleDeleteWebhook = async (eventKey: string) => {
        if (window.confirm("Are you sure you want to remove this webhook?")) {
            setSavingWebhook(eventKey);
            await deleteWebhook(eventKey);
            setWebhooks(prev => {
                const newWebhooks = { ...prev };
                delete newWebhooks[eventKey];
                return newWebhooks;
            });
            setWebhookInputs(prev => {
                const newInputs = { ...prev };
                delete newInputs[eventKey];
                return newInputs;
            });
            setSavingWebhook(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card className="bg-primary/5 border-primary/20">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <Zap size={24}/>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Zapier Connection</h2>
                        <p className="text-sm text-text-secondary">Sync your production and leads with 6,000+ apps.</p>
                    </div>
                </div>
                
                <div className="p-4 bg-surface rounded-xl border border-border">
                    <h3 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2 uppercase tracking-widest"><KeyRound size={14}/> Your Private API Key</h3>
                    <p className="text-xs text-text-secondary mb-3">Keep this key secret. Use it when setting up "AgentGPS" actions in your Zapier account.</p>
                    <div className="flex items-center gap-2 bg-input p-2 rounded-lg border border-border">
                        {loadingKey ? <Spinner /> : <input type="text" readOnly value={apiKey} className="flex-1 bg-transparent text-sm font-mono text-text-primary outline-none" />}
                        <button onClick={handleCopyKey} className="p-2 rounded-md text-text-secondary hover:bg-primary/10 hover:text-primary transition-colors">{copyStatus === 'copied' ? <CheckCircle size={20} className="text-success" /> : <ClipboardCopy size={20} />}</button>
                    </div>
                    <button onClick={handleRegenerateKey} disabled={loadingKey} className="mt-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-destructive hover:underline"><RefreshCw size={10}/> Regenerate Key</button>
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-bold mb-4">Automated Triggers</h3>
                <p className="text-sm text-text-secondary mb-6">Create a "Webhook" trigger in Zapier, then paste the unique URL for each event type below.</p>
                {loadingWebhooks ? <Spinner/> : (
                    <div className="space-y-6">
                        {Object.entries(AVAILABLE_TRIGGERS).map(([eventKey, eventLabel]) => (
                            <div key={eventKey} className="group">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm font-bold text-text-primary">{eventLabel}</label>
                                    {webhooks[eventKey] && <span className="text-[10px] font-black text-success uppercase bg-success/10 px-2 py-0.5 rounded-full">Connected</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                                        <input 
                                            type="url" 
                                            value={webhookInputs[eventKey] || ''} 
                                            onChange={e => handleWebhookInputChange(eventKey, e.target.value)} 
                                            placeholder="https://hooks.zapier.com/..." 
                                            className="w-full bg-input border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
                                        />
                                    </div>
                                    {webhooks[eventKey] ? (
                                        <button onClick={() => handleDeleteWebhook(eventKey)} disabled={savingWebhook === eventKey} className="p-3 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors">{savingWebhook === eventKey ? <Spinner className="w-5 h-5"/> : <Trash2 size={20}/>}</button>
                                    ) : (
                                        <button onClick={() => handleSaveWebhook(eventKey)} disabled={savingWebhook === eventKey} className="p-3 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors">{savingWebhook === eventKey ? <Spinner className="w-5 h-5"/> : <Save size={20}/>}</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

const CommunicationCenter: React.FC = () => {
    const { userData, user } = useAuth();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [importance, setImportance] = useState<'normal' | 'high'>('normal');
    const [mediaType, setMediaType] = useState<'none' | 'image' | 'video'>('none');
    const [mediaUrl, setMediaUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const canPost = P.isSuperAdmin(userData) || P.isMcAdmin(userData) || P.isCoach(userData) || P.isTeamLeader(userData);

    useEffect(() => {
        const fetchAnnouncements = async () => {
            if (!userData) return;
            const db = getFirestoreInstance();
            if (!db) return;
            
            let q;
            if (userData.marketCenterId) {
                q = query(
                    collection(db, 'announcements'), 
                    where('marketCenterId', '==', userData.marketCenterId),
                    orderBy('date', 'desc')
                );
            } else {
                q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
            }

            try {
                const snap = await getDocs(q);
                setAnnouncements(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as Announcement)));
            } catch (error) {
                console.error("Error fetching announcements:", error);
            }
        };
        fetchAnnouncements();
    }, [refreshTrigger, userData]);

    const handlePost = async () => {
        if (!title || !body || !user) return;
        if (mediaType !== 'none' && !mediaUrl) {
            alert("Please provide a media URL for the selected media type.");
            return;
        }
        setLoading(true);
        try {
            const db = getFirestoreInstance();
            if (!db) throw new Error("Database not connected");
            const targetMcId = userData?.marketCenterId || null;

            await addDoc(collection(db, 'announcements'), {
                title,
                body,
                importance,
                mediaType,
                mediaUrl: mediaType !== 'none' ? mediaUrl : '',
                date: serverTimestamp(),
                authorId: user.uid,
                authorName: userData?.name || 'Admin',
                marketCenterId: targetMcId
            });
            setTitle('');
            setBody('');
            setImportance('normal');
            setMediaType('none');
            setMediaUrl('');
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error(error);
            alert('Failed to post announcement.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Delete this announcement?")) return;
        const db = getFirestoreInstance();
        if (!db) return;
        await deleteDoc(doc(db, 'announcements', id));
        setRefreshTrigger(prev => prev + 1);
    };

    if (!canPost) return null;

    return (
        <Card className="mt-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Megaphone /> Communication Center</h2>
            <p className="text-sm text-text-secondary mb-4">Post updates and news to the Dashboard feed for your Market Center.</p>
            
            <div className="space-y-4 mb-8 p-4 bg-background/50 rounded-lg border border-border">
                <h3 className="font-semibold text-lg">Create New Announcement</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold mb-1">Title</label>
                        <input 
                            type="text" 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary"
                            placeholder="e.g., Weekly Team Meeting Moved"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1">Importance</label>
                        <select 
                            value={importance} 
                            onChange={e => setImportance(e.target.value as 'normal' | 'high')}
                            className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary"
                        >
                            <option value="normal">Normal</option>
                            <option value="high">High (Red Alert)</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold mb-2">Media Attachment</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                        <button 
                            type="button"
                            onClick={() => setMediaType('none')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${mediaType === 'none' ? 'bg-primary text-white border-primary' : 'bg-input text-text-secondary border-border hover:border-primary'}`}
                        >
                            <MinusCircle size={14}/> No Media
                        </button>
                        <button 
                            type="button"
                            onClick={() => setMediaType('image')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${mediaType === 'image' ? 'bg-primary text-white border-primary' : 'bg-input text-text-secondary border-border hover:border-primary'}`}
                        >
                            <ImageIcon size={14}/> Image
                        </button>
                        <button 
                            type="button"
                            onClick={() => setMediaType('video')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${mediaType === 'video' ? 'bg-primary text-white border-primary' : 'bg-input text-text-secondary border-border hover:border-primary'}`}
                        >
                            <VideoIcon size={14}/> Video (YouTube)
                        </button>
                    </div>

                    {mediaType !== 'none' && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                            <label className="block text-xs font-semibold mb-1">
                                {mediaType === 'image' ? 'Image URL (Direct link to .jpg, .png, .webp)' : 'YouTube URL'}
                            </label>
                            <input 
                                type="url" 
                                value={mediaUrl} 
                                onChange={e => setMediaUrl(e.target.value)} 
                                className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary"
                                placeholder={mediaType === 'image' ? 'https://example.com/image.jpg' : 'https://youtube.com/watch?v=...'}
                            />
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-semibold mb-1">Message Body</label>
                    <RichTextEditor content={body} onChange={setBody} placeholder="Write your announcement here..." />
                </div>
                <button 
                    onClick={handlePost} 
                    disabled={loading || !title || !body}
                    className="flex items-center gap-2 bg-primary text-on-accent px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                >
                    {loading ? <Spinner className="w-4 h-4" /> : <Send size={16} />} Post Announcement
                </button>
            </div>

            <h3 className="font-semibold text-lg mb-2">Recent Posts</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
                {announcements.map(a => (
                    <div key={a.id} className="flex justify-between items-center p-3 bg-input rounded-md border border-border">
                        <div>
                            <p className="font-bold text-sm">
                                {a.title} 
                                {a.importance === 'high' && <span className="text-destructive text-xs ml-2">(High)</span>}
                                {a.mediaType !== 'none' && <span className="text-accent-secondary text-xs ml-2">({a.mediaType})</span>}
                            </p>
                            <p className="text-xs text-text-secondary">Posted by {a.authorName}</p>
                        </div>
                        <button onClick={() => handleDelete(a.id)} className="text-destructive hover:bg-destructive/10 p-2 rounded-full"><Trash2 size={16}/></button>
                    </div>
                ))}
                {announcements.length === 0 && <p className="text-sm text-text-secondary">No recent announcements found.</p>}
            </div>
        </Card>
    );
};

const LiveSessionsManagement: React.FC = () => {
    const { userData } = useAuth();
    const [sessions, setSessions] = useState<LiveSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const isLeadership = P.isTeamLeader(userData) || P.isCoach(userData);

    useEffect(() => {
        const fetchSessions = async () => {
            const db = getFirestoreInstance();
            if (!db || !userData) return;
            
            try {
                let q;
                if (userData.isSuperAdmin) {
                    q = query(collection(db, 'liveSessions'), orderBy('startTime', 'desc'), limit(20));
                } else if (userData.marketCenterId) {
                    q = query(
                        collection(db, 'liveSessions'), 
                        where('marketCenterId', '==', userData.marketCenterId),
                        orderBy('startTime', 'desc'), 
                        limit(20)
                    );
                } else {
                    setLoading(false);
                    return;
                }

                const snap = await getDocs(q);
                setSessions(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as LiveSession)));
            } catch (error) {
                console.error("Error fetching sessions in Admin:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, [userData]);

    const handleDelete = async (id: string) => {
        if (!window.confirm("Cancel this session?")) return;
        const db = getFirestoreInstance();
        if (!db) return;
        await deleteDoc(doc(db, 'liveSessions', id));
        setSessions(sessions.filter(s => s.id !== id));
    };

    const handleEndSession = async (id: string) => {
        if (!window.confirm("Mark this session as ended?")) return;
        const db = getFirestoreInstance();
        if (!db) return;
        await updateDoc(doc(db, 'liveSessions', id), { status: 'ended' });
        setSessions(sessions.map(s => s.id === id ? { ...s, status: 'ended' } : s));
    };

    return (
        <Card className="mt-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <VideoIcon className="text-accent-secondary" />
                    <h2 className="text-2xl font-bold">Live Sessions</h2>
                </div>
                {isLeadership && (
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-primary text-on-accent px-4 py-2 rounded-xl font-bold text-sm hover:bg-opacity-90 transition-all"
                    >
                        <Plus size={18} /> Schedule New Session
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {loading ? <Spinner /> : sessions.map(session => (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-surface-hover rounded-xl border border-border">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${session.sessionType === 'client-consult' ? 'bg-accent-secondary/10 text-accent-secondary' : 'bg-primary/10 text-primary'}`}>
                                {session.sessionType === 'client-consult' ? <User size={20}/> : <Users size={20}/>}
                            </div>
                            <div>
                                <h4 className="font-bold text-sm">{session.title}</h4>
                                <p className="text-xs text-text-secondary">
                                    {new Date(session.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                                session.status === 'scheduled' ? 'bg-blue-500/10 text-blue-500' : 
                                session.status === 'live' ? 'bg-success/10 text-success' : 
                                'bg-text-secondary/10 text-text-secondary'
                            }`}>
                                {session.status}
                            </span>
                            {session.status !== 'ended' && session.status !== 'completed' && (
                                <button 
                                    onClick={() => handleEndSession(session.id)} 
                                    className="p-2 text-success hover:bg-success/10 rounded-full transition-colors"
                                    title="Mark as Ended"
                                >
                                    <CheckCircle size={16} />
                                </button>
                            )}
                            <button onClick={() => handleDelete(session.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
                {!loading && sessions.length === 0 && (
                    <p className="text-sm text-text-secondary text-center py-8">No live sessions scheduled yet.</p>
                )}
            </div>

            <ScheduleSessionModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={(newSession) => setSessions([newSession, ...sessions])}
            />
        </Card>
    );
};

const MarketCenterLeadershipSettings: React.FC = () => {
    const { userData } = useAuth();
    const [mcData, setMcData] = useState<MarketCenter | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<'light' | 'dark' | null>(null);
    const [calendarUrl, setCalendarUrl] = useState('');
    const [branding, setBranding] = useState<MarketCenterBranding>({
        colors: { primary: '#B40101', secondary: '#333333', accent: '#F5F5F5', surface: '#FFFFFF' },
        typography: { headingFont: 'Inter', bodyFont: 'Inter' },
        logoUrl: '',
        darkLogoUrl: '',
        style: { borderRadius: '12px', navStyle: 'solid' }
    });
    const [feedback, setFeedback] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        const fetchMc = async () => {
            if (!userData?.marketCenterId) return;
            const db = getFirestoreInstance();
            if (!db) return;
            const mcDoc = await getDoc(doc(db, 'marketCenters', userData.marketCenterId));
            if (mcDoc.exists()) {
                const data = mcDoc.data() as MarketCenter;
                setMcData({ id: mcDoc.id, ...data });
                setCalendarUrl(data.calendarEmbedUrl || '');
                if (data.branding) {
                    setBranding(data.branding);
                }
            }
            setLoading(false);
        };
        fetchMc();
    }, [userData]);

    const handleUrlChange = (val: string) => {
        // Automatically extract src if an iframe tag is pasted
        if (val.includes('<iframe')) {
            const match = val.match(/src=["']([^"']+)["']/);
            if (match && match[1]) {
                setCalendarUrl(match[1]);
                return;
            }
        }
        setCalendarUrl(val);
    };

    const handleSave = async () => {
        if (!userData?.marketCenterId) return;
        setSaving(true);
        setFeedback('');
        try {
            const db = getFirestoreInstance();
            if (!db) return;
            await updateDoc(doc(db, 'marketCenters', userData.marketCenterId), {
                calendarEmbedUrl: calendarUrl,
                branding: branding
            });
            setFeedback('Settings updated!');
            setTimeout(() => setFeedback(''), 3000);
        } catch (error) {
            console.error(error);
            setFeedback('Update failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'light' | 'dark') => {
        const file = e.target.files?.[0];
        if (!file || !userData?.marketCenterId) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            alert("Please upload an image file.");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert("File size must be less than 2MB.");
            return;
        }

        setUploading(type);
        try {
            const storage = getStorageInstance();
            if (!storage) throw new Error("Storage not initialized");

            const fileExt = file.name.split('.').pop();
            const fileName = `mc_logos/${userData.marketCenterId}/${type}_logo_${Date.now()}.${fileExt}`;
            const storageRef = ref(storage, fileName);

            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);

            setBranding(prev => ({
                ...prev,
                [type === 'light' ? 'logoUrl' : 'darkLogoUrl']: downloadUrl
            }));
            
            setFeedback(`${type === 'light' ? 'Primary' : 'Dark'} logo uploaded!`);
            setTimeout(() => setFeedback(''), 3000);
        } catch (error) {
            console.error("Logo upload failed:", error);
            alert("Failed to upload logo. Please try again.");
        } finally {
            setUploading(null);
        }
    };

    if (loading) return <div className="flex justify-center p-4"><Spinner /></div>;
    if (!mcData) return null;

    return (
        <Card className="mt-6">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2"><CalendarIcon /> Market Center Configuration</h2>
                <button 
                    onClick={() => setShowHelp(!showHelp)} 
                    className="flex items-center gap-1 text-sm font-semibold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                    <HelpCircle size={16} /> Setup Guide
                </button>
            </div>
            
            <p className="text-sm text-text-secondary mb-6">Manage settings for <strong>{mcData.name}</strong>.</p>
            
            {showHelp && (
                <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                    <h3 className="font-bold flex items-center gap-2"><Info size={18} className="text-primary"/> How to connect your Google Calendar</h3>
                    <ol className="text-sm space-y-3 list-decimal list-inside text-text-secondary">
                        <li>Open your <strong>Google Calendar</strong> on a computer.</li>
                        <li>Click the <Settings size={14} className="inline"/> icon and go to <strong>Settings</strong>.</li>
                        <li>On the left sidebar, find <strong>Settings for my calendars</strong> and select your MC calendar.</li>
                        <li>Under <strong>Access permissions for events</strong>, check <strong>Make available to public</strong>. 
                            <p className="ml-5 text-[10px] text-destructive font-bold uppercase mt-1 italic">
                                * Note: If your Google Workspace admin has disabled this, you must ask them to allow "Public Sharing" for your domain.
                            </p>
                        </li>
                        <li>Scroll down to <strong>Integrate calendar</strong> and find the <strong>Embed code</strong>.</li>
                        <li>Copy the entire code and paste it below. We will extract the link for you!</li>
                    </ol>
                </div>
            )}

            <div className="space-y-8">
                {/* Branding Section */}
                <div className="p-6 bg-surface border border-border rounded-2xl">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Palette size={20} className="text-primary"/> Branding & White Labeling</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-widest">Market Center Logo</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-text-secondary uppercase opacity-50">Light Mode Logo</p>
                                        <div className="flex flex-col gap-2">
                                            <div className="h-16 bg-white border border-border rounded-xl flex items-center justify-center p-2 overflow-hidden">
                                                <BrandedLogo logoUrl={branding.logoUrl} className="max-h-full w-auto" />
                                            </div>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text"
                                                    value={branding.logoUrl || ''}
                                                    onChange={e => setBranding(prev => ({ ...prev, logoUrl: e.target.value }))}
                                                    className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-xs"
                                                    placeholder="URL or Storage Path"
                                                />
                                                <label className="cursor-pointer bg-primary/10 text-primary p-2 rounded-lg hover:bg-primary/20 transition-colors">
                                                    {uploading === 'light' ? <Spinner className="w-4 h-4" /> : <Plus size={16} />}
                                                    <input type="file" className="hidden" onChange={e => handleLogoUpload(e, 'light')} accept="image/*" />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-text-secondary uppercase opacity-50">Dark Mode Logo (Optional)</p>
                                        <div className="flex flex-col gap-2">
                                            <div className="h-16 bg-slate-900 border border-border rounded-xl flex items-center justify-center p-2 overflow-hidden">
                                                <BrandedLogo logoUrl={branding.darkLogoUrl} isDarkMode={true} className="max-h-full w-auto" />
                                            </div>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text"
                                                    value={branding.darkLogoUrl || ''}
                                                    onChange={e => setBranding(prev => ({ ...prev, darkLogoUrl: e.target.value }))}
                                                    className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-xs"
                                                    placeholder="URL or Storage Path"
                                                />
                                                <label className="cursor-pointer bg-primary/10 text-primary p-2 rounded-lg hover:bg-primary/20 transition-colors">
                                                    {uploading === 'dark' ? <Spinner className="w-4 h-4" /> : <Plus size={16} />}
                                                    <input type="file" className="hidden" onChange={e => handleLogoUpload(e, 'dark')} accept="image/*" />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-text-secondary mt-3">Recommended: Transparent PNG, approx. 200x50px. Max 2MB.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-text-secondary mb-3 uppercase tracking-widest">Corner Style</label>
                                <div className="flex flex-wrap gap-2">
                                    {CURATED_CORNER_STYLES.map(style => (
                                        <button
                                            key={style.name}
                                            onClick={() => setBranding(prev => ({ ...prev, style: { ...prev.style, borderRadius: style.value } }))}
                                            className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all ${branding.style?.borderRadius === style.value ? 'bg-primary text-on-accent border-primary' : 'bg-surface border-border hover:border-primary/50'}`}
                                        >
                                            {style.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-text-secondary mb-3 uppercase tracking-widest">Color Palette</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {CURATED_PALETTES.map(palette => (
                                        <button
                                            key={palette.name}
                                            onClick={() => setBranding(prev => ({ ...prev, colors: palette.colors }))}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${JSON.stringify(branding.colors) === JSON.stringify(palette.colors) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                                        >
                                            <div className="flex -space-x-2">
                                                <div className="w-6 h-6 rounded-full border border-white" style={{ backgroundColor: palette.colors.primary }}></div>
                                                <div className="w-6 h-6 rounded-full border border-white" style={{ backgroundColor: palette.colors.secondary }}></div>
                                            </div>
                                            <span className="text-xs font-bold">{palette.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-text-secondary mb-3 uppercase tracking-widest">Typography</label>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-text-secondary mb-2 uppercase opacity-50">Heading Font</p>
                                        <div className="flex flex-wrap gap-2">
                                            {[...CURATED_FONTS.sans, ...CURATED_FONTS.serif].map(font => (
                                                <button
                                                    key={font.name}
                                                    onClick={() => setBranding(prev => ({ ...prev, typography: { ...prev.typography, headingFont: font.value } }))}
                                                    className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${branding.typography.headingFont === font.value ? 'bg-primary text-on-accent border-primary' : 'bg-surface border-border hover:border-primary/50'}`}
                                                    style={{ fontFamily: font.value }}
                                                >
                                                    {font.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-text-secondary mb-2 uppercase opacity-50">Body Font</p>
                                        <div className="flex flex-wrap gap-2">
                                            {CURATED_FONTS.sans.map(font => (
                                                <button
                                                    key={font.name}
                                                    onClick={() => setBranding(prev => ({ ...prev, typography: { ...prev.typography, bodyFont: font.value } }))}
                                                    className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${branding.typography.bodyFont === font.value ? 'bg-primary text-on-accent border-primary' : 'bg-surface border-border hover:border-primary/50'}`}
                                                    style={{ fontFamily: font.value }}
                                                >
                                                    {font.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview Area */}
                        <div className="bg-background rounded-2xl p-6 border border-border flex flex-col items-center justify-center text-center space-y-4" style={{ borderRadius: branding.style?.borderRadius }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-2">Live Preview</p>
                            <div className="w-full max-w-[200px] h-12 bg-surface border border-border flex items-center justify-center mb-4 overflow-hidden" style={{ borderRadius: branding.style?.borderRadius }}>
                                <BrandedLogo logoUrl={branding.logoUrl} className="max-h-8 w-auto" />
                            </div>
                            <h4 className="text-2xl font-bold" style={{ color: branding.colors.primary, fontFamily: branding.typography.headingFont }}>Sample Heading</h4>
                            <p className="text-sm text-text-secondary max-w-[250px]" style={{ fontFamily: branding.typography.bodyFont }}>
                                This is how your market center's typography and primary color will look in the application.
                            </p>
                            <div className="flex gap-2">
                                <button 
                                    className="px-6 py-2 font-bold text-sm shadow-lg transition-all"
                                    style={{ 
                                        backgroundColor: branding.colors.primary, 
                                        color: getContrastColor(branding.colors.primary),
                                        borderRadius: branding.style?.borderRadius
                                    }}
                                >
                                    Primary Action
                                </button>
                                <button 
                                    className="px-6 py-2 font-bold text-sm border border-border transition-all"
                                    style={{ 
                                        borderRadius: branding.style?.borderRadius
                                    }}
                                >
                                    Secondary
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Calendar Section */}
                <div className="p-6 bg-surface border border-border rounded-2xl">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><CalendarIcon size={20} className="text-primary"/> Shared Calendar</h3>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Google Calendar Embed URL or Code</label>
                        <textarea 
                            value={calendarUrl} 
                            onChange={e => handleUrlChange(e.target.value)} 
                            className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary min-h-[80px] font-mono text-xs"
                            placeholder="Paste <iframe ...> code or the src URL here..."
                        />
                        <div className="flex items-start gap-2 mt-2">
                            <Info size={14} className="text-text-secondary mt-0.5" />
                            <p className="text-[11px] text-text-secondary">
                                This calendar will be visible to every agent in your Market Center. 
                                Ensure the calendar's <strong>Public Sharing</strong> is turned on in Google.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                    {feedback && <span className="text-sm text-success flex items-center gap-1"><CheckCircle size={14}/> {feedback}</span>}
                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="bg-primary text-on-accent px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 min-w-[160px]"
                    >
                        {saving ? <Spinner className="mx-auto" /> : 'Save All Settings'}
                    </button>
                </div>
            </div>
        </Card>
    );
};

const MarketCenterManagement: React.FC = () => {
    const { getMarketCenters, createMarketCenter, deleteMarketCenter } = useAuth();
    const [marketCenters, setMarketCenters] = useState<MarketCenter[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newMcName, setNewMcName] = useState('');
    const [newMcNumber, setNewMcNumber] = useState('');
    const [newMcLocation, setNewMcLocation] = useState('');
    const [newMcAgentCount, setNewMcAgentCount] = useState('');
    
    const fetchMarketCenters = useCallback(async () => {
        setLoading(true);
        try {
            const mcs = await getMarketCenters();
            setMarketCenters(mcs);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [getMarketCenters]);
    
    useEffect(() => { fetchMarketCenters(); }, [fetchMarketCenters]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMcName || !newMcNumber || !newMcLocation || !newMcAgentCount) return;
        setLoading(true);
        await createMarketCenter({ 
            name: newMcName, 
            marketCenterNumber: newMcNumber, 
            location: newMcLocation, 
            agentCount: parseInt(newMcAgentCount, 10) || 0,
            branding: {
                colors: { primary: '#B40101', secondary: '#333333' },
                typography: { headingFont: 'Poppins', bodyFont: 'Roboto' }
            }
        });
        setIsCreateModalOpen(false);
        setNewMcName('');
        setNewMcNumber('');
        setNewMcLocation('');
        setNewMcAgentCount('');
        fetchMarketCenters();
    };

    const handleDelete = async (mcId: string) => {
        if (window.confirm("Are you sure? This will delete the market center.")) {
            setLoading(true);
            await deleteMarketCenter(mcId);
            fetchMarketCenters();
        }
    };
    
    if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

    return (
        <div className="space-y-4 mt-6 pt-6 border-t border-border">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-3"><Building/> Market Center Management (Global)</h2>
                <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 text-sm bg-primary/10 text-primary font-semibold py-1.5 px-3 rounded-lg hover:bg-primary/20"><Plus size={16}/> Create MC</button>
            </div>

            {isCreateModalOpen && (
                <Card className="p-6 border-primary/30 bg-primary/5">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">MC Name</label>
                                <input type="text" value={newMcName} onChange={e => setNewMcName(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary" placeholder="e.g. KW Central" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">MC Number</label>
                                <input type="text" value={newMcNumber} onChange={e => setNewMcNumber(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary" placeholder="e.g. 123" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Location</label>
                                <input type="text" value={newMcLocation} onChange={e => setNewMcLocation(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary" placeholder="e.g. Austin, TX" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Agent Count</label>
                                <input type="number" value={newMcAgentCount} onChange={e => setNewMcAgentCount(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-text-primary" placeholder="e.g. 150" required />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-sm font-bold text-text-secondary hover:text-text-primary">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-primary text-on-accent rounded-lg font-bold text-sm">Create Market Center</button>
                        </div>
                    </form>
                </Card>
            )}

            {marketCenters.map(mc => (
                <Card key={mc.id} className="bg-background/50">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="text-lg font-bold">{mc.name}</h4>
                            <p className="text-sm text-text-secondary">MC #{mc.marketCenterNumber} &bull; {mc.location} &bull; {mc.agentCount} Agents</p>
                        </div>
                        <button onClick={() => handleDelete(mc.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-full"><Trash2 size={16}/></button>
                    </div>
                </Card>
            ))}
        </div>
    );
};

const AdminSettingsPage: React.FC = () => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<'general' | 'integrations'>('general');
    const isSuperAdmin = P.isSuperAdmin(userData);
    const isLeadership = P.isMcAdmin(userData) || P.isCoach(userData);

    return (
        <div className="h-full flex flex-col">
            <header className="p-4 sm:p-6 lg:p-8">
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-text-primary flex items-center gap-4">
                    <SlidersHorizontal className="text-accent-secondary" size={48} />
                    Settings
                </h1>
                <p className="text-lg text-text-secondary mt-1">
                    {isSuperAdmin ? 'Platform-wide configuration and administration.' : 'Market Center management and communication center.'}
                </p>
                <div className="mt-8 flex border-b border-border">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'general' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-text-secondary hover:border-border'}`}
                    >
                        <Settings size={16} /> General Admin
                    </button>
                    <button
                        onClick={() => setActiveTab('integrations')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'integrations' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-text-secondary hover:border-border'}`}
                    >
                        <Zap size={16} /> Connection Center
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-8">
                {activeTab === 'general' ? (
                    <div className="space-y-6">
                        {isLeadership && (
                            <>
                                <MarketCenterLeadershipSettings />
                                <LiveSessionsManagement />
                                <CommunicationCenter />
                            </>
                        )}
                        
                        {isSuperAdmin && (
                            <>
                                <Link to="/habit-settings" className="block p-6 bg-surface border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Settings className="text-primary" />
                                        <h3 className="text-lg font-bold text-text-primary">Habit Tracker Settings</h3>
                                    </div>
                                    <p className="text-sm text-text-secondary">Configure platform-wide default activities.</p>
                                </Link>
                                <MarketCenterManagement />
                            </>
                        )}
                    </div>
                ) : (
                    <ConnectionCenter />
                )}
            </div>
        </div>
    );
};

export default AdminSettingsPage;
