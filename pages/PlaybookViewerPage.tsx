
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestoreInstance } from '../firebaseConfig';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Playbook, Module, Lesson, QuizContent, ChecklistContent, SubmissionRequirement } from '../types';
import { 
    ArrowLeft, BookOpen, Link as LinkIcon, Video, FileText, 
    BrainCircuit, ListChecks, CheckSquare, CheckCircle, XCircle, 
    ArrowRight, ArrowLeft as ArrowLeftIcon, ChevronDown, ChevronUp, 
    Presentation, Upload, Eye, ExternalLink, X, AlertTriangle,
    Maximize2, Minimize2, Copy, Share2
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { processPlaybookDoc } from '../lib/firestoreUtils';
import { createPortal } from 'react-dom';

/**
 * Robust Video Parser for YouTube, Loom, and Vimeo
 */
const parseVideoUrl = (url: string): { type: 'youtube' | 'loom' | 'vimeo' | 'invalid', id: string | null, embedUrl: string | null } => {
    if (!url) return { type: 'invalid', id: null, embedUrl: null };

    // YouTube
    const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const ytMatch = url.match(ytRegExp);
    if (ytMatch && ytMatch[2].length === 11) {
        return { type: 'youtube', id: ytMatch[2], embedUrl: `https://www.youtube.com/embed/${ytMatch[2]}` };
    }

    // Loom
    const loomRegExp = /loom\.com\/(share|embed)\/([a-f0-9]+)/;
    const loomMatch = url.match(loomRegExp);
    if (loomMatch) {
        return { type: 'loom', id: loomMatch[2], embedUrl: `https://www.loom.com/embed/${loomMatch[2]}` };
    }

    // Vimeo
    const vimeoRegExp = /vimeo\.com\/(?:.*\/)?([0-9]+)/;
    const vimeoMatch = url.match(vimeoRegExp);
    if (vimeoMatch) {
        return { type: 'vimeo', id: vimeoMatch[1], embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
    }

    return { type: 'invalid', id: null, embedUrl: null };
};

const VideoPlayer: React.FC<{ url: string; title: string }> = ({ url, title }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [copied, setCopied] = useState(false);
    const videoData = useMemo(() => parseVideoUrl(url), [url]);

    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const playerContent = (
        <div className={`relative group w-full bg-black overflow-hidden shadow-2xl ${isFocused ? 'h-full' : 'aspect-video rounded-2xl'}`}>
            {videoData.type !== 'invalid' ? (
                <iframe 
                    className="w-full h-full border-none"
                    src={videoData.embedUrl!}
                    title={title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                ></iframe>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/50 gap-4 p-8 text-center">
                    <AlertTriangle size={48} className="text-warning" />
                    <div>
                        <p className="font-bold text-lg">Unsupported Video Source</p>
                        <p className="text-sm">We currently support YouTube, Loom, and Vimeo.</p>
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-white text-sm font-bold flex items-center gap-2">
                        <ExternalLink size={16} /> Open External Link
                    </a>
                </div>
            )}

            {/* Overlay Controls */}
            <div className={`absolute top-4 right-4 flex gap-2 transition-opacity duration-300 ${isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button 
                    onClick={handleCopy}
                    className="p-2 bg-black/60 backdrop-blur-md text-white rounded-lg hover:bg-black/80 transition-colors"
                    title="Copy Video URL"
                >
                    {copied ? <CheckCircle size={18} className="text-success" /> : <Share2 size={18} />}
                </button>
                <button 
                    onClick={() => setIsFocused(!isFocused)}
                    className="p-2 bg-black/60 backdrop-blur-md text-white rounded-lg hover:bg-black/80 transition-colors"
                    title={isFocused ? "Exit Focus Mode" : "Enter Focus Mode"}
                >
                    {isFocused ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                {isFocused && (
                    <button 
                        onClick={() => setIsFocused(false)}
                        className="p-2 bg-destructive/80 backdrop-blur-md text-white rounded-lg hover:bg-destructive transition-colors"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>
    );

    if (isFocused) {
        return createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-12 animate-in fade-in duration-300">
                <div className="w-full h-full max-w-6xl relative flex flex-col gap-4">
                    <div className="flex items-center justify-between text-white px-2">
                        <h3 className="text-xl font-bold truncate pr-8">{title}</h3>
                        <div className="flex items-center gap-4 text-sm font-medium opacity-60">
                            Focus Mode Active
                        </div>
                    </div>
                    <div className="flex-1 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        {playerContent}
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return playerContent;
};

const DrivePreviewModal: React.FC<{ url: string; title: string; onClose: () => void }> = ({ url, title, onClose }) => {
    const embedUrl = getEmbeddableDriveUrl(url);

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8">
            <div className="w-full h-full max-w-6xl bg-surface rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <FileText size={20} className="text-primary" />
                        </div>
                        <h3 className="font-bold text-lg truncate max-w-[200px] md:max-w-md">{title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg hover:bg-primary/5 text-text-secondary transition-colors"
                        >
                            <ExternalLink size={16} /> <span className="hidden sm:inline">Open in Drive</span>
                        </a>
                        <button 
                            onClick={onClose} 
                            className="p-2 hover:bg-destructive/10 text-text-secondary hover:text-destructive rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-background relative">
                    {embedUrl ? (
                        <iframe 
                            src={embedUrl} 
                            className="w-full h-full border-none" 
                            title={title}
                            allow="autoplay"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                            <AlertTriangle size={48} className="text-warning" />
                            <div>
                                <p className="font-bold text-xl">Preview Unavailable</p>
                                <p className="text-text-secondary">This link format might not support in-app previewing.</p>
                            </div>
                            <a 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="bg-primary text-on-accent px-6 py-2 rounded-lg font-bold"
                            >
                                Open External Resource
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const getEmbeddableDriveUrl = (url: string): string | null => {
    if (!url || !url.includes('drive.google.com') && !url.includes('docs.google.com')) return null;

    try {
        if (url.includes('/file/d/')) {
            return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
        }
        if (url.includes('/document/d/') || url.includes('/spreadsheets/d/') || url.includes('/presentation/d/')) {
            const baseUrl = url.split(/[?#]/)[0];
            if (baseUrl.endsWith('/edit')) {
                return baseUrl.replace(/\/edit$/, '/preview');
            }
            if (!baseUrl.endsWith('/preview')) {
                return `${baseUrl}/preview`;
            }
            return baseUrl;
        }
    } catch (e) {
        console.error("Error parsing Drive URL", e);
    }
    return url;
};

const SlideViewer: React.FC<{ content: string }> = ({ content }) => {
    const isEmbed = content.trim().startsWith('<iframe');
    if (isEmbed) {
        return (
            <div
                className="aspect-video w-full rounded-lg overflow-hidden border border-border bg-black [&>iframe]:w-full [&>iframe]:h-full"
                dangerouslySetInnerHTML={{ __html: content }}
            />
        );
    }
    return (
        <iframe src={content} className="w-full aspect-video rounded-lg border border-border bg-surface" title="Slide Deck" />
    );
};

const ChecklistViewer: React.FC<{
    lesson: Lesson;
    completedLessons: string[];
    onProgressUpdate: (completedIds: string[]) => void;
}> = ({ lesson, completedLessons, onProgressUpdate }) => {
    const content = Array.isArray(lesson.content) ? lesson.content as ChecklistContent : [];
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

    const handleCheckChange = (itemId: string) => {
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    useEffect(() => {
        if (content.length > 0 && checkedItems.size === content.length && !completedLessons.includes(lesson.id)) {
            onProgressUpdate([...completedLessons, lesson.id]);
        }
    }, [checkedItems, content.length, lesson.id, completedLessons, onProgressUpdate]);
    
    return (
         <div className="space-y-3">
            {content.map(item => (
                <label key={item.id} htmlFor={`checklist-${item.id}`} className="flex items-start gap-3 p-3 bg-background/50 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
                    <input
                        type="checkbox"
                        id={`checklist-${item.id}`}
                        checked={checkedItems.has(item.id)}
                        onChange={() => handleCheckChange(item.id)}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                    />
                    <span className={`flex-1 ${checkedItems.has(item.id) ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                        {item.text}
                    </span>
                </label>
            ))}
        </div>
    );
};

const QuizViewer: React.FC<{
    lesson: Lesson;
    completedLessons: string[];
    onProgressUpdate: (completedIds: string[]) => void;
}> = ({ lesson, completedLessons, onProgressUpdate }) => {
    const content = Array.isArray(lesson.content) ? lesson.content as QuizContent : [];
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);

    const score = useMemo(() => {
        if (!isSubmitted || content.length === 0) return 0;
        const correctCount = content.reduce((count, question) => {
            const correctAnswer = question.options.find(opt => opt.isCorrect)?.id;
            if (selectedAnswers[question.id] === correctAnswer) {
                return count + 1;
            }
            return count;
        }, 0);
        return (correctCount / content.length) * 100;
    }, [isSubmitted, content, selectedAnswers]);

    const handleAnswerSelect = (questionId: string, optionId: string) => {
        if (isSubmitted) return;
        setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    const handleSubmit = () => {
        setIsSubmitted(true);
        if (!completedLessons.includes(lesson.id)) {
            onProgressUpdate([...completedLessons, lesson.id]);
        }
    };
    
    return (
        <div className="space-y-6">
            {content.map(q => {
                const correctAnswerId = q.options.find(opt => opt.isCorrect)?.id;
                const userAnswerId = selectedAnswers[q.id];
                return (
                    <div key={q.id} className={`p-4 rounded-lg border ${isSubmitted ? (userAnswerId === correctAnswerId ? 'border-success bg-success/5' : 'border-destructive bg-destructive/5') : 'border-border'}`}>
                        <p className="font-bold mb-3">{q.questionText}</p>
                        <div className="space-y-2">
                            {q.options.map(opt => {
                                let feedbackIcon = null;
                                if (isSubmitted) {
                                    if (opt.isCorrect) {
                                        feedbackIcon = <CheckCircle size={16} className="text-success" />;
                                    } else if (userAnswerId === opt.id) {
                                        feedbackIcon = <XCircle size={16} className="text-destructive" />;
                                    }
                                }
                                return (
                                    <label key={opt.id} className={`flex items-center gap-3 p-2 rounded-md transition-colors ${!isSubmitted ? 'cursor-pointer hover:bg-primary/5' : 'cursor-default'}`}>
                                        <input type="radio" name={`quiz-${q.id}`} checked={selectedAnswers[q.id] === opt.id} onChange={() => handleAnswerSelect(q.id, opt.id)} disabled={isSubmitted} className="h-4 w-4 text-primary focus:ring-primary"/>
                                        <span className="flex-1">{opt.text}</span>
                                        {feedbackIcon}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
            <div className="flex flex-col items-center gap-4 mt-6">
                {!isSubmitted ? (
                     <button onClick={handleSubmit} className="bg-primary text-on-accent font-semibold py-2 px-6 rounded-lg">Submit Quiz</button>
                ): (
                    <div className="text-center p-4 bg-background/50 rounded-lg">
                        <p className="text-lg font-bold">Your Score</p>
                        <p className={`text-4xl font-black ${score >= 70 ? 'text-success' : 'text-warning'}`}>{score.toFixed(0)}%</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const PlaybookViewerPage: React.FC = () => {
    const { playbookId } = useParams<{ playbookId: string }>();
    const [searchParams] = useSearchParams();
    const lessonIdParam = searchParams.get('lessonId');
    const { user, userData, updatePlaybookProgress } = useAuth();
    const [playbook, setPlaybook] = useState<Playbook | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
    const [isMobileListVisible, setIsMobileListVisible] = useState(true);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    
    const handleLessonSelect = (lesson: Lesson | null) => {
        setActiveLesson(lesson);
        if (lesson && window.innerWidth < 768) {
            setIsMobileListVisible(false);
        }
    };
    const [submissionText, setSubmissionText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const completedLessons = useMemo(() => {
        if (!userData || !playbookId || !userData.playbookProgress) return [];
        return userData.playbookProgress[playbookId] || [];
    }, [userData, playbookId]);

    const handleProgressUpdate = useCallback(async (newCompletedIds: string[]) => {
        if (!playbookId) return;
        try {
            await updatePlaybookProgress(playbookId, newCompletedIds);
        } catch (error) {
            console.error("Failed to update playbook progress:", error);
        }
    }, [playbookId, updatePlaybookProgress]);

    const allLessonsFlat = useMemo(() => {
        if (!playbook) return [];
        return playbook.modules.flatMap(m => m.lessons);
    }, [playbook]);

    const { currentIndex, prevLesson, nextLesson } = useMemo(() => {
        if (!activeLesson || allLessonsFlat.length === 0) return { currentIndex: -1, prevLesson: null, nextLesson: null };
        const idx = allLessonsFlat.findIndex(l => l.id === activeLesson.id);
        return {
            currentIndex: idx,
            prevLesson: idx > 0 ? allLessonsFlat[idx - 1] : null,
            nextLesson: idx < allLessonsFlat.length - 1 ? allLessonsFlat[idx + 1] : null,
        };
    }, [activeLesson, allLessonsFlat]);


    useEffect(() => {
        const fetchPlaybook = async () => {
            if (!playbookId) { setError("Playbook ID is missing."); setLoading(false); return; }
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(getFirestoreInstance(), 'playbooks', playbookId));
                if (docSnap.exists()) {
                    const pb = processPlaybookDoc(docSnap);
                    setPlaybook(pb);

                    const allLessons = pb.modules.flatMap(m => m.lessons);
                    const targetLesson = lessonIdParam ? allLessons.find(l => l.id === lessonIdParam) : null;
                    const firstUncompleted = allLessons.find(l => !userData?.playbookProgress?.[playbookId]?.includes(l.id));
                    
                    handleLessonSelect(targetLesson || firstUncompleted || pb.modules?.[0]?.lessons?.[0] || null);
                    
                    const initialExpanded: Record<string, boolean> = {};
                    pb.modules.forEach(m => initialExpanded[m.id] = true);
                    setExpandedModules(initialExpanded);

                } else { setError('Playbook not found.'); }
            } catch (err) { console.error(err); setError('Failed to load playbook.'); }
             finally { setLoading(false); }
        };
        fetchPlaybook();
    }, [playbookId, userData, lessonIdParam]);

    const handleMarkComplete = () => {
        if (!activeLesson || completedLessons.includes(activeLesson.id)) return;
        handleProgressUpdate([...completedLessons, activeLesson.id]);
    };

    const handleSubmitWork = async (lessonId: string) => {
        if (!user || !playbookId) return;
        setSubmitting(true);
        try {
            await addDoc(collection(getFirestoreInstance(), 'submissions'), {
                userId: user.uid,
                lessonId: lessonId,
                playbookId: playbookId,
                content: submissionText,
                status: 'pending',
                submittedAt: serverTimestamp()
            });
            handleProgressUpdate([...completedLessons, lessonId]);
            setSubmissionText('');
            alert('Assignment submitted successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to submit assignment.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderLessonContent = (lesson: Lesson) => {
        const isCompleted = completedLessons.includes(lesson.id);
        const canMarkComplete = ['text', 'video', 'link', 'presentation'].includes(lesson.type);

        const sanitizedHtml = lesson.type === 'text' ? DOMPurify.sanitize(marked(lesson.content as string)) : '';
        const isDriveLink = lesson.type === 'link' && ((lesson.content as string).includes('drive.google.com') || (lesson.content as string).includes('docs.google.com'));

        return (
            <>
                {lesson.type === 'video' && (
                     <VideoPlayer url={lesson.content as string} title={lesson.title} />
                )}
                {lesson.type === 'link' && (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <div className="p-8 bg-surface border-2 border-dashed border-border rounded-3xl flex flex-col items-center text-center max-w-md w-full">
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                                {isDriveLink ? <FileText size={32} className="text-primary" /> : <LinkIcon size={32} className="text-primary" />}
                            </div>
                            <h3 className="font-bold text-xl mb-2">{lesson.title}</h3>
                            <p className="text-sm text-text-secondary mb-6">
                                {isDriveLink ? 'This resource is a Google Drive document.' : 'This resource is an external link.'}
                            </p>
                            
                            <div className="flex flex-col w-full gap-3">
                                {isDriveLink && (
                                    <button 
                                        onClick={() => setPreviewUrl(lesson.content as string)} 
                                        className="flex items-center justify-center gap-2 bg-primary text-on-accent font-bold py-3 px-6 rounded-xl hover:bg-opacity-90 transition-all shadow-lg shadow-primary/20"
                                    >
                                        <Eye size={18} /> Preview Document
                                    </button>
                                )}
                                <a 
                                    href={lesson.content as string} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className={`flex items-center justify-center gap-2 font-bold py-3 px-6 rounded-xl transition-all ${isDriveLink ? 'bg-surface border border-border hover:bg-primary/5 text-text-primary' : 'bg-primary text-on-accent shadow-lg shadow-primary/20 hover:bg-opacity-90'}`}
                                >
                                    <ExternalLink size={18} /> {isDriveLink ? 'Open in Drive' : 'Open Resource'}
                                </a>
                            </div>
                        </div>
                    </div>
                )}
                {lesson.type === 'presentation' && (
                    <SlideViewer content={lesson.content as string} />
                )}
                {lesson.type === 'text' && (
                    <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                )}
                {lesson.type === 'quiz' && (
                    <QuizViewer lesson={lesson} completedLessons={completedLessons} onProgressUpdate={handleProgressUpdate} />
                )}
                {lesson.type === 'checklist' && (
                    <ChecklistViewer lesson={lesson} completedLessons={completedLessons} onProgressUpdate={handleProgressUpdate} />
                )}
                {lesson.type === 'submission' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-surface border border-border rounded-lg">
                            <h3 className="font-bold mb-2">Assignment:</h3>
                            <p>{(lesson.content as SubmissionRequirement).prompt}</p>
                        </div>
                        {isCompleted ? (
                            <div className="p-4 bg-success/10 border border-success/30 rounded-lg text-success flex items-center gap-2">
                                <CheckCircle size={20} />
                                <span className="font-semibold">Assignment Submitted</span>
                            </div>
                        ) : (
                            <>
                                <textarea
                                    className="w-full min-h-[150px] bg-input border border-border rounded-lg p-3 text-sm"
                                    placeholder="Type your response or paste your link here..."
                                    value={submissionText}
                                    onChange={e => setSubmissionText(e.target.value)}
                                />
                                <button
                                    onClick={() => handleSubmitWork(lesson.id)}
                                    disabled={submitting || !submissionText.trim()}
                                    className="bg-primary text-on-accent px-6 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
                                >
                                    {submitting ? <Spinner className="w-4 h-4" /> : 'Submit Assignment'}
                                </button>
                            </>
                        )}
                    </div>
                )}
                {canMarkComplete && (
                    <div className="mt-8 pt-6 border-t border-border flex justify-center">
                        <button onClick={handleMarkComplete} disabled={isCompleted} className="flex items-center gap-2 py-2 px-6 rounded-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed bg-success text-on-success">
                           <CheckSquare size={16}/> {isCompleted ? 'Completed' : 'Mark as Complete'}
                        </button>
                    </div>
                )}
            </>
        );
    };
    
    if (loading) return <div className="flex h-full w-full items-center justify-center"><Spinner className="w-8 h-8" /></div>;
    if (error) return <Card className="m-8 text-center text-destructive">{error}</Card>;
    if (!playbook) return null;
    
    const LessonIcon = { link: LinkIcon, video: Video, text: FileText, quiz: BrainCircuit, checklist: ListChecks, presentation: Presentation, submission: Upload };
    const totalLessons = allLessonsFlat.length;

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <header className="p-4 sm:px-6 lg:px-8 py-4 flex-shrink-0">
                <Link to="/resource-library" className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline mb-4"><ArrowLeft size={16}/> Back to My Growth</Link>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary">{playbook.title}</h1>
                <p className="text-sm text-text-secondary mt-1">{playbook.description}</p>
            </header>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden px-4 sm:px-6 lg:px-8 pb-8 gap-6 min-h-0">
                <nav className={`${isMobileListVisible ? 'block' : 'hidden'} md:block w-full md:w-1/3 lg:w-1/4 bg-surface rounded-2xl p-4 flex flex-col overflow-y-auto min-h-0`}>
                    <h2 className="text-lg font-bold mb-3 flex-shrink-0">Contents</h2>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                        {playbook.modules.map(module => (
                            <div key={module.id}>
                                <button onClick={() => setExpandedModules(p => ({...p, [module.id]: !p[module.id]}))} className="w-full flex justify-between items-center font-semibold text-text-primary">
                                    {module.title}
                                    <ChevronDown size={16} className={`transition-transform ${expandedModules[module.id] ? 'rotate-180' : ''}`} />
                                </button>
                                {expandedModules[module.id] && (
                                    <div className="mt-2 space-y-1 pl-2 border-l-2 border-border">
                                        {module.lessons.map(lesson => {
                                            const Icon = LessonIcon[lesson.type];
                                            const isCompleted = completedLessons.includes(lesson.id);
                                            return (
                                                <button key={lesson.id} onClick={() => handleLessonSelect(lesson)} className={`w-full text-left flex items-center gap-2 p-2 rounded-md text-sm transition-colors ${activeLesson?.id === lesson.id ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5'}`}>
                                                    {isCompleted ? <CheckCircle size={14} className="text-success flex-shrink-0" /> : <Icon size={14} className="text-text-secondary flex-shrink-0" />}
                                                    <span className={`truncate ${isCompleted ? 'text-text-secondary' : ''}`}>{lesson.title}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </nav>

                <main className={`${isMobileListVisible ? 'hidden' : 'block'} md:block w-full md:w-2/3 lg:w-3/4 bg-surface rounded-2xl flex flex-col overflow-hidden min-h-0`}>
                    {activeLesson ? (
                        <>
                            <div className="p-6 pb-12 flex-grow overflow-y-auto min-h-0">
                                <button onClick={() => setIsMobileListVisible(true)} className="md:hidden flex items-center gap-2 text-sm font-semibold text-primary hover:underline mb-4">
                                    <ArrowLeft size={16}/> Back to Contents
                                </button>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-2xl font-bold">{activeLesson.title}</h2>
                                    <button 
                                        onClick={() => {
                                            const url = `${window.location.origin}/playbook/${playbookId}?lessonId=${activeLesson.id}`;
                                            navigator.clipboard.writeText(url);
                                            alert('Link copied to clipboard!');
                                        }}
                                        className="p-2 hover:bg-surface-hover rounded-lg text-text-secondary hover:text-primary transition-colors"
                                        title="Copy link to this lesson"
                                    >
                                        <Share2 size={20} />
                                    </button>
                                </div>
                                {renderLessonContent(activeLesson)}
                            </div>
                            <div className="flex justify-between items-center p-4 border-t border-border flex-shrink-0">
                                <button onClick={() => handleLessonSelect(prevLesson)} disabled={!prevLesson} className="flex items-center gap-2 py-2 px-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/5 transition-colors">
                                   <ArrowLeftIcon size={16}/> Previous
                                </button>
                                <span className="text-sm text-text-secondary">{currentIndex + 1} / {totalLessons}</span>
                                <button onClick={() => handleLessonSelect(nextLesson)} disabled={!nextLesson} className="flex items-center gap-2 py-2 px-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/5 transition-colors">
                                   Next <ArrowRight size={16}/>
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <BookOpen size={48} className="text-text-secondary mb-4" />
                            <h2 className="text-2xl font-bold">Welcome to the Playbook</h2>
                            <p className="text-text-secondary mt-2">Select a lesson from the left to get started.</p>
                        </div>
                    )}
                </main>
            </div>
            
            {/* Modal for Google Drive Preview */}
            {previewUrl && activeLesson && (
                <DrivePreviewModal 
                    url={previewUrl} 
                    title={activeLesson.title} 
                    onClose={() => setPreviewUrl(null)} 
                />
            )}
        </div>
    );
};

export default PlaybookViewerPage;
