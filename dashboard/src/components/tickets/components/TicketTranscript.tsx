import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
    faArrowLeft, faPaperclip, faQuestionCircle, faCheckCircle, 
    faPaperPlane, faBars, faTicket, faUser, faClock, 
    faCircle, faExclamationCircle, faThumbsUp, faComments,
    faHandHolding, faLock
} from '@fortawesome/free-solid-svg-icons'
import { userDataService } from '../../../utils/userDataService'
import { motion, AnimatePresence } from 'framer-motion'
import moment from 'moment-timezone'
import { parse } from 'discord-markdown-parser'

declare global {
    interface Window {
        socket: any;
    }
}

interface Message {
    author: string
    authorId: string
    content: string
    timestamp: string
    attachments?: Array<{
        url?: string;
        name: string;
        contentType: string;
        binaryData?: string;
        width?: number;
        height?: number;
    }>;
    avatarUrl: string
    displayName?: string
}

interface GroupedMessage {
    author: string
    authorId: string
    displayName: string
    messages: {
        content: string
        timestamp: string
        attachments?: any[]
    }[]
    firstTimestamp: string
    avatarUrl: string
}

interface Question {
    question: string
    answer: string
}

interface TranscriptData {
    id: string
    type: string
    typeName?: string
    status: string
    priority: string
    creator: string
    creatorData?: {
        displayName: string
        avatar: string
    }
    claimer: string | null
    claimerData?: {
        displayName: string
        avatar: string
    }
    claimed?: boolean
    created: string
    closed: string | null
    rating: string
    feedback: string
    questions: Question[]
    messages: Message[]
    closeReason: string
    canSendMessages: boolean;
}

interface ImageViewerProps {
    src: string;
    alt: string;
    onClose: () => void;
}

interface LoadingState {
    fetch: boolean;
    claim: boolean;
    close: boolean;
}

const ImageViewer = ({ src, alt, onClose }: ImageViewerProps) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="relative max-w-[90vw] max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute -top-4 -right-4 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-full p-2 transition-all duration-200 shadow-lg z-10"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <img
                    src={src}
                    alt={alt}
                    className="rounded-lg max-w-full max-h-[90vh] object-contain shadow-2xl"
                    style={{ margin: 'auto' }}
                />
            </div>
        </div>
    );
};

function groupMessages(messages: Message[]): GroupedMessage[] {
    return messages.reduce((groups: GroupedMessage[], message) => {
        const lastGroup = groups[groups.length - 1]

        if (lastGroup && lastGroup.authorId === message.authorId) {
            lastGroup.messages.push({
                content: message.content,
                timestamp: message.timestamp,
                attachments: message.attachments
            })
            return groups
        } else {
            groups.push({
                author: message.author,
                authorId: message.authorId,
                displayName: message.displayName || message.author,
                avatarUrl: message.avatarUrl,
                messages: [{
                    content: message.content,
                    timestamp: message.timestamp,
                    attachments: message.attachments
                }],
                firstTimestamp: message.timestamp
            })
            return groups
        }
    }, [])
}

const MessagePreview = ({ message, sending }: { message: string; sending: boolean }) => {
    if (!message.trim()) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="px-6 py-4 border-t border-gray-800/50 bg-gray-900/50 backdrop-blur-xl"
        >
            <div className="flex gap-4">
                <div className="flex-shrink-0">
                    <motion.div
                        className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/5"
                        animate={sending ? {
                            scale: [1, 1.1, 1],
                            borderColor: ['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.5)', 'rgba(59, 130, 246, 0.3)']
                        } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                    >
                        <FontAwesomeIcon 
                            icon={faPaperPlane} 
                            className={`w-4 h-4 text-blue-400 transition-transform ${sending ? 'rotate-12' : ''}`} 
                        />
                    </motion.div>
                </div>
                <div className="flex-grow space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-400">Message Preview</span>
                            {sending && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex items-center gap-2"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                                    <span className="text-xs text-blue-400 font-medium">Sending...</span>
                                </motion.div>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded-md">
                            {message.length} characters
                        </div>
                    </div>
                    <motion.div
                        className="bg-gradient-to-br from-gray-800/50 to-gray-800/30 backdrop-blur-xl border border-gray-700/30 rounded-xl p-4 relative overflow-hidden group"
                        animate={sending ? {
                            boxShadow: ['0 0 0 rgba(59, 130, 246, 0)', '0 0 20px rgba(59, 130, 246, 0.2)', '0 0 0 rgba(59, 130, 246, 0)']
                        } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        <p className="text-gray-300 whitespace-pre-wrap break-words text-sm leading-relaxed relative">
                            {message}
                        </p>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};

const MessageContent = ({ content }: { content: string }) => {
    const renderMarkdown = (text: string) => {
        const parsed = parse(text);
        let html = '';

        const processNode = (node: any) => {
            if (typeof node === 'string') return node;

            switch (node.type) {
                case 'text':
                    return node.content;
                case 'em':
                    return `<em>${node.content.map(processNode).join('')}</em>`;
                case 'strong':
                    return `<strong>${node.content.map(processNode).join('')}</strong>`;
                case 'underline':
                    return `<u>${node.content.map(processNode).join('')}</u>`;
                case 'strike':
                    return `<del>${node.content.map(processNode).join('')}</del>`;
                case 'inlineCode':
                    return `<code class="bg-gray-800 px-1.5 py-0.5 rounded text-sm">${node.content}</code>`;
                case 'codeBlock':
                    return `<pre class="bg-gray-800 p-3 rounded-lg my-2 overflow-x-auto"><code>${node.content}</code></pre>`;
                case 'blockQuote':
                    return `<blockquote class="border-l-4 border-gray-600 pl-3 my-2 italic text-gray-400">${node.content.map(processNode).join('')}</blockquote>`;
                case 'link':
                    return `<a href="${node.url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${node.content.map(processNode).join('')}</a>`;
                case 'emoji':
                    return node.name;
                case 'mention':
                    return `<span class="text-blue-400">@${node.content}</span>`;
                case 'channelMention':
                    return `<span class="text-blue-400">#${node.content}</span>`;
                case 'roleMention':
                    return `<span class="text-blue-400">@${node.content}</span>`;
                case 'spoiler':
                    return `<span class="bg-gray-800 hover:bg-transparent cursor-pointer transition-colors duration-200">${node.content.map(processNode).join('')}</span>`;
                case 'paragraph':
                    return `<p>${node.content.map(processNode).join('')}</p>`;
                default:
                    return node.content ? node.content.map(processNode).join('') : '';
            }
        };

        if (Array.isArray(parsed)) {
            html = parsed.map(processNode).join('');
        } else {
            html = processNode(parsed);
        }

        return html;
    };

    return (
        <div 
            className="whitespace-pre-wrap break-words text-gray-200"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
    );
};

const formatDateTime = (timestamp: string) => {
    if (!timestamp) return 'Unknown Date';
    const parsedDate = moment.tz(timestamp, [
        'MMM D, YYYY [at] h:mm A z',
        'MMM D, YYYY, hh:mm A z',
        'MMM D, YYYY, HH:mm z',
        'YYYY-MM-DD HH:mm:ss.SSSSZ'
    ], window.DASHBOARD_CONFIG.TIMEZONE);
    
    if (parsedDate.isValid()) {
        return parsedDate.format('MMM D, YYYY [at] h:mm A z');
    }
    
    const isoDate = moment.tz(timestamp, window.DASHBOARD_CONFIG.TIMEZONE);
    if (isoDate.isValid()) {
        return isoDate.format('MMM D, YYYY [at] h:mm A z');
    }
    
    return timestamp;
};

const MessageGroup = ({ group, isLast }: { group: GroupedMessage; isLast: boolean }) => {
    return (
        <div className={`flex gap-4 px-4 py-2 hover:bg-gray-800/30 ${isLast ? 'rounded-b-xl' : ''}`}>
            <div className="flex-shrink-0">
                <img
                    src={group.avatarUrl || getAvatarUrl(group.authorId, group.author, null)}
                    alt={group.displayName}
                    className="w-10 h-10 rounded-full"
                />
            </div>
            <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{group.displayName}</span>
                    <span className="text-xs text-gray-400">
                        {formatDateTime(group.firstTimestamp)}
                    </span>
                </div>
                <div className="space-y-1">
                    {group.messages.map((message, index) => (
                        <div key={index} className="text-gray-200">
                            <MessageContent content={message.content} />
                            {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-1 space-y-1">
                                    {message.attachments.map((attachment, attIndex) => (
                                        <AttachmentDisplay key={attIndex} attachment={attachment} />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const getAvatarUrl = (userId: string, username: string, customUrl: string | null) => {
    if (customUrl) return customUrl;
    const discriminator = parseInt(userId) % 5;
    return `https://cdn.discordapp.com/avatars/${userId}/${discriminator}.png`;
}

const AttachmentDisplay = ({ attachment }: { 
    attachment: { 
        url?: string; 
        name: string; 
        contentType?: string;
        binaryData?: string;
        width?: number;
        height?: number;
    } 
}) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

    if (attachment.contentType?.startsWith('image/')) {
        const imageSrc = attachment.binaryData 
            ? `data:${attachment.contentType};base64,${attachment.binaryData}`
            : attachment.url;

        return (
            <div className="relative group">
                <img
                    src={imageSrc}
                    alt={attachment.name}
                    className="max-w-full h-auto rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-colors cursor-pointer"
                    onLoad={() => setImageLoading(false)}
                    onClick={() => setSelectedImage({ src: imageSrc!, alt: attachment.name })}
                    style={attachment.width && attachment.height ? {
                        maxWidth: Math.min(attachment.width, 800),
                        maxHeight: Math.min(attachment.height, 600)
                    } : undefined}
                />
                {imageLoading && (
                    <div className="flex items-center justify-center p-4">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
        );
    }

    if (attachment.url) {
        return (
            <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-gray-700/50 transition-all duration-200 group hover:scale-[1.02] hover:border-gray-600/50"
            >
                <FontAwesomeIcon 
                    icon={faPaperclip} 
                    className="w-4 h-4 text-blue-400 group-hover:rotate-12 transition-transform" 
                />
                <span className="text-sm text-gray-300 truncate flex-1">
                    {attachment.name}
                </span>
            </a>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <FontAwesomeIcon 
                icon={faPaperclip} 
                className="w-4 h-4 text-blue-400" 
            />
            <span className="text-sm text-gray-300 truncate flex-1">
                {attachment.name}
            </span>
        </div>
    );
}

export default function TicketTranscript({ ticketId }: { ticketId: string }) {
    const [data, setData] = useState<TranscriptData | null>(null)
    const [loading, setLoading] = useState<LoadingState>({
        fetch: false,
        claim: false,
        close: false
    })
    const [error, setError] = useState<string | null>(null)
    const [supportPermissions, setSupportPermissions] = useState<Record<string, boolean>>({})
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [sendingEnabled, setSendingEnabled] = useState(true)
    const [imageLoading, setImageLoading] = useState<{[key: string]: boolean}>({})
    const [retryCount, setRetryCount] = useState(0)
    const maxRetries = 3
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
    const [lastMessageCount, setLastMessageCount] = useState(0);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [data?.messages, message])

    const fetchTicketData = async () => {
        try {
            setLoading({ fetch: true, claim: false, close: false });
            const response = await fetch(`/api/tickets/${ticketId}/transcript`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch ticket data');
            }

            setData(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching ticket data:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch ticket data');
        } finally {
            setLoading({ fetch: false, claim: false, close: false });
        }
    };

    useEffect(() => {
        fetchTicketData();
        let isMounted = true;

        async function fetchTranscript() {
            try {
                const response = await fetch(`/api/tickets/${ticketId}/transcript`);
                if (!response.ok) {
                    if (response.status === 403) {
                        setError("You don't have permission to view this ticket transcript");
                        return;
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                const creatorData = await userDataService.getUserData(result.creator);
                
                let claimerData;
                if (result.claimer && result.claimer !== 'Unclaimed') {
                    claimerData = await userDataService.getUserData(result.claimer);
                }
                
                const enhancedMessages = await Promise.all(
                    result.messages.map(async (msg: Message) => {
                        const userData = await userDataService.getUserData(msg.authorId);
                        return {
                            ...msg,
                            displayName: userData?.displayName || msg.author,
                            avatarUrl: userData?.avatar || getAvatarUrl(msg.authorId, msg.author, null)
                        };
                    })
                );

                if (isMounted) {
                    setData({
                        ...result,
                        creatorData: creatorData || undefined,
                        claimerData: claimerData || undefined,
                        claimed: Boolean(result.claimer) && result.claimer !== 'Unclaimed',
                        messages: enhancedMessages
                    });
                    
                    if (enhancedMessages.length > lastMessageCount) {
                        setLastMessageCount(enhancedMessages.length);
                        scrollToBottom();
                    }
                    
                    setLoading({ fetch: false, claim: false, close: false });
                }
            } catch (error) {
                console.error('Failed to load transcript:', error);
                if (isMounted) {
                    setError('Failed to load transcript. Please try again later.');
                    setLoading({ fetch: false, claim: false, close: false });
                }
            }
        }

        fetchTranscript();

        const pollInterval = setInterval(fetchTranscript, 3000);

        return () => {
            isMounted = false;
            clearInterval(pollInterval);
        };
    }, [ticketId]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [message])

    useEffect(() => {
        const handleUserDataUpdate = (event: CustomEvent<{ userId: string; userData: any }>) => {
            const { userId, userData } = event.detail;
            
            setData(prevData => {
                if (!prevData) return prevData;
                
                let updatedData = { ...prevData };
                let hasChanges = false;

                if (prevData.creator === userId) {
                    updatedData.creatorData = {
                        displayName: userData.displayName,
                        avatar: userData.avatar
                    };
                    hasChanges = true;
                }
                
                const updatedMessages = prevData.messages.map(msg => {
                    if (msg.authorId === userId) {
                        hasChanges = true;
                        return {
                            ...msg,
                            displayName: userData.displayName,
                            avatarUrl: userData.avatar
                        };
                    }
                    return msg;
                });
                
                if (hasChanges) {
                    updatedData.messages = updatedMessages;
                    return updatedData;
                }
                
                return prevData;
            });
        };

        window.addEventListener('userDataUpdated', handleUserDataUpdate as EventListener);
        
        return () => {
            window.removeEventListener('userDataUpdated', handleUserDataUpdate as EventListener);
        };
    }, []);

    const sendMessage = async () => {
        if (!message.trim() || !sendingEnabled) return;

        setSending(true);
        setSendingEnabled(false);
        const messageContent = message;
        
        try {
            const response = await fetch(`/api/tickets/${ticketId}/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: messageContent }),
            });

            if (!response.ok) {
                throw new Error(`Failed to send message: ${response.status}`);
            }

            const responseData = await response.json();

            setMessage('');
            setRetryCount(0);
            
            const currentUser = await userDataService.getCurrentUser();
            const newMessage: Message = {
                author: responseData.message?.author || currentUser?.displayName || 'You',
                authorId: responseData.message?.authorId || currentUser?.id || 'local',
                content: messageContent,
                timestamp: moment().tz(window.DASHBOARD_CONFIG.TIMEZONE).format(),
                avatarUrl: responseData.message?.avatarUrl || currentUser?.avatar || '/default-avatar.png',
                displayName: responseData.message?.displayName || currentUser?.displayName || 'You'
            };

            setData(prev => {
                if (!prev) return prev;
                const newMessages = [...prev.messages, newMessage];
                setLastMessageCount(newMessages.length);
                return {
                    ...prev,
                    messages: newMessages
                };
            });
        } catch (error) {
            if (retryCount < maxRetries) {
                setRetryCount(prev => prev + 1);
                setTimeout(() => {
                    setSendingEnabled(true);
                }, 2000);
            }
        } finally {
            setSending(false);
            setTimeout(() => setSendingEnabled(true), 500);
        }
    };

    const handleImageLoad = (attachmentUrl: string) => {
        setImageLoading(prev => ({
            ...prev,
            [attachmentUrl]: false
        }));
    };

    const handleClaimTicket = async () => {
        try {
            setLoading({ fetch: false, claim: true, close: false });
            const response = await fetch(`/api/tickets/claim/${ticketId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to claim ticket');
            }

            const result = await response.json();
            
            setData(prevData => {
                if (!prevData) return prevData;
                
                if (result.action === 'unclaimed') {
                    return {
                        ...prevData,
                        claimed: false,
                        claimer: null,
                        claimerData: undefined,
                        status: prevData.status,
                        canSendMessages: prevData.canSendMessages
                    };
                }
                
                return {
                    ...prevData,
                    claimed: true,
                    claimer: result.ticket.claimedBy,
                    status: prevData.status,
                    canSendMessages: prevData.canSendMessages
                };
            });
        } catch (error) {
            console.error('Error claiming ticket:', error);
            alert(error instanceof Error ? error.message : 'Failed to claim ticket');
        } finally {
            setLoading({ fetch: false, claim: false, close: false });
        }
    };

    useEffect(() => {
    }, [data]);

    const handleCloseTicket = async () => {
        try {
            const reason = prompt('Enter a reason for closing the ticket (optional):');
            if (reason !== null) {
                setLoading({ fetch: false, claim: false, close: true });

                const response = await fetch(`/api/tickets/close/${ticketId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ reason })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to close ticket');
                }

                setData(prevData => {
                    if (!prevData) return prevData;
                    return {
                        ...prevData,
                        status: 'closed',
                        closed: new Date().toISOString(),
                        closeReason: reason || ''
                    };
                });
            }
        } catch (error) {
            console.error('Error closing ticket:', error);
            alert(error instanceof Error ? error.message : 'Failed to close ticket');
        } finally {
            setLoading({ fetch: false, claim: false, close: false });
        }
    };

    useEffect(() => {
        const checkSupportPermissions = async () => {
            if (!data?.type) return;
            try {
                const response = await fetch(`/api/tickets/permissions/${data.type}`);
                if (response.ok) {
                    const { hasSupport } = await response.json();
                    setSupportPermissions(prev => ({ ...prev, [data.type]: hasSupport }));
                }
            } catch (error) {
                console.error('Error checking support permissions:', error);
            }
        };

        checkSupportPermissions();
    }, [data?.type]);

    useEffect(() => {
        if (data?.status === 'open' && supportPermissions[data?.type]) {
        }
    }, [data?.claimed, data?.claimer, data?.status, data?.type, loading.claim, supportPermissions]);

    const loadClaimerData = async () => {
        if (data?.claimer) {
            try {
                if (data.claimer === 'Unclaimed') {
                    setData(prevData => {
                        if (!prevData) return prevData;
                        return {
                            ...prevData,
                            claimed: false,
                            claimerData: undefined
                        };
                    });
                    return;
                }

                const userData = await userDataService.getUserData(data.claimer);
                
                if (userData) {
                    setData(prevData => {
                        if (!prevData) return prevData;
                        return {
                            ...prevData,
                            claimed: Boolean(data.claimer) && data.claimer !== 'Unclaimed',
                            claimerData: {
                                displayName: userData.displayName,
                                avatar: userData.avatar
                            }
                        };
                    });
                } else {
                    setData(prevData => {
                        if (!prevData) return prevData;
                        return {
                            ...prevData,
                            claimed: false,
                            claimerData: undefined
                        };
                    });
                }
            } catch (error) {
                console.error('Error loading claimer data:', error);
                setData(prevData => {
                    if (!prevData) return prevData;
                    return {
                        ...prevData,
                        claimed: false,
                        claimerData: undefined
                    };
                });
            }
        } else {
            setData(prevData => {
                if (!prevData) return prevData;
                return {
                    ...prevData,
                    claimed: false,
                    claimerData: undefined
                };
            });
        }
    };

    useEffect(() => {
    }, [data?.claimer, data?.claimerData]);

    if (loading.fetch) return (
        <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                <p className="text-gray-400 animate-pulse">Loading transcript...</p>
            </div>
        </div>
    )

    if (error) return (
        <div className="h-full p-4">
            <div className="max-w-[2000px] mx-auto">
                <div className="flex items-center mb-6">
                    <Link
                        to="/tickets"
                        className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors duration-200 flex items-center gap-2 text-gray-200"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="w-5 h-5" />
                        <span>Back to Tickets</span>
                    </Link>
                </div>
                <div className="bg-red-500/10 text-red-400 p-4 rounded-lg border border-red-500/20 text-center">
                    {error}
                </div>
            </div>
        </div>
    )

    if (!data) return <div className="flex items-center justify-center h-full text-red-500">Failed to load transcript</div>

    const groupedMessages = groupMessages(data.messages)

    return (
        <div className="flex flex-col h-full bg-gray-950/30">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur-xl border-b border-gray-800/50 shadow-lg">
                <div className="max-w-[1920px] mx-auto px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                            <Link
                                to="/tickets"
                                className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors group"
                            >
                                <FontAwesomeIcon 
                                    icon={faArrowLeft} 
                                    className="w-4 h-4 group-hover:-translate-x-1 transition-transform" 
                                />
                                <span className="text-sm font-medium">Back to Tickets</span>
                            </Link>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/20 flex items-center justify-center shadow-lg shadow-indigo-500/5">
                                    <FontAwesomeIcon icon={faTicket} className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 text-transparent bg-clip-text">
                                        Ticket #{data?.id}
                                    </h1>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                            data?.status === 'open' 
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                : data?.status === 'closed'
                                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                        }`}>
                                            <FontAwesomeIcon icon={faCircle} className="w-2 h-2" />
                                            {data?.status?.charAt(0).toUpperCase() + data?.status?.slice(1)}
                                        </span>
                                        {data?.status === 'open' && supportPermissions[data?.type] && (
                                            <>
                                                <button
                                                    onClick={handleClaimTicket}
                                                    disabled={loading.claim}
                                                    className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 transform hover:scale-105 hover:shadow-lg ${
                                                        Boolean(data.claimer) && data.claimer !== 'Unclaimed'
                                                            ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 ring-1 ring-amber-500/30 hover:ring-amber-500/50 hover:shadow-amber-500/10'
                                                            : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 ring-1 ring-indigo-500/30 hover:ring-indigo-500/50 hover:shadow-indigo-500/10'
                                                    }`}
                                                    title={Boolean(data.claimer) && data.claimer !== 'Unclaimed' ? 'Unclaim this ticket' : 'Claim this ticket'}
                                                >
                                                    <FontAwesomeIcon 
                                                        icon={faHandHolding} 
                                                        className={`w-3.5 h-3.5 mr-2 ${loading.claim ? 'animate-pulse' : ''}`} 
                                                    />
                                                    {loading.claim ? 'Processing...' : (Boolean(data.claimer) && data.claimer !== 'Unclaimed' ? 'Unclaim' : 'Claim')}
                                                </button>
                                                <button
                                                    onClick={handleCloseTicket}
                                                    disabled={loading.close}
                                                    className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 ring-1 ring-rose-500/30 hover:ring-rose-500/50 transition-all duration-200 transform hover:scale-105 hover:shadow-lg hover:shadow-rose-500/10"
                                                    title="Close Ticket"
                                                >
                                                    <FontAwesomeIcon 
                                                        icon={faLock} 
                                                        className={`w-3.5 h-3.5 mr-2 ${loading.close ? 'animate-pulse' : ''}`} 
                                                    />
                                                    {loading.close ? 'Processing...' : 'Close'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="max-w-[1920px] mx-auto px-4 py-6">
                    <div className="grid grid-cols-12 gap-6">
                        {/* Main Content */}
                        <div className="col-span-12 lg:col-span-8 xl:col-span-9">
                            <div className="space-y-6">
                                {/* Messages Panel */}
                                <motion.div 
                                    className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800/50 overflow-hidden shadow-lg shadow-black/5"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="px-6 py-4 border-b border-gray-800/50">
                                        <h2 className="text-lg font-semibold flex items-center gap-2">
                                            <FontAwesomeIcon icon={faComments} className="w-4 h-4 text-blue-400" />
                                            <span className="text-gray-200">Conversation</span>
                                        </h2>
                                    </div>
                                    <div className="divide-y divide-gray-800/50">
                                        {groupedMessages.map((group, index) => (
                                            <MessageGroup key={`${group.authorId}-${index}`} group={group} isLast={index === groupedMessages.length - 1} />
                                        ))}
                                        {message.trim() && (
                                            <MessagePreview message={message} sending={sending} />
                                        )}
                                    </div>

                                    {/* Message Input */}
                                    {data.canSendMessages && data.status === 'open' && (
                                        <div className="sticky bottom-0 p-4 border-t border-gray-800/50 bg-gray-900/95 backdrop-blur-xl">
                                            <div className="flex gap-4">
                                                <div className="flex-grow relative">
                                                    <textarea
                                                        ref={textareaRef}
                                                        value={message}
                                                        onChange={(e) => setMessage(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                if (message.trim() && sendingEnabled) {
                                                                    sendMessage();
                                                                }
                                                            }
                                                        }}
                                                        placeholder="Type your message... (Shift + Enter for new line)"
                                                        className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 text-sm min-h-[44px]"
                                                        rows={1}
                                                        style={{
                                                            resize: 'none',
                                                            maxHeight: '200px'
                                                        }}
                                                    />
                                                    {message.length > 0 && (
                                                        <div className="absolute right-3 bottom-2.5 text-xs text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
                                                            {message.length} chars
                                                        </div>
                                                    )}
                                                </div>
                                                <motion.button
                                                    onClick={sendMessage}
                                                    disabled={!message.trim() || !sendingEnabled}
                                                    className={`h-[44px] px-4 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                                                        message.trim() && sendingEnabled
                                                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/20'
                                                            : 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
                                                    }`}
                                                    whileHover={{ scale: message.trim() && sendingEnabled ? 1.02 : 1 }}
                                                    whileTap={{ scale: message.trim() && sendingEnabled ? 0.98 : 1 }}
                                                >
                                                    <FontAwesomeIcon 
                                                        icon={faPaperPlane} 
                                                        className={`w-4 h-4 ${sending ? 'animate-spin' : ''}`} 
                                                    />
                                                    <span className="text-sm">
                                                        {sending ? 'Sending...' : 'Send Message'}
                                                    </span>
                                                </motion.button>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </div>
                        </div>

                        {/* Sidebar - Now always visible on desktop */}
                        <div className="hidden lg:block lg:col-span-4 xl:col-span-3">
                            <div className="sticky top-[92px]">
                                <motion.div 
                                    className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800/50 overflow-hidden shadow-lg shadow-black/5"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                >
                                    <div className="px-6 py-4 border-b border-gray-800/50">
                                        <h2 className="text-lg font-semibold flex items-center gap-2">
                                            <FontAwesomeIcon icon={faTicket} className="w-4 h-4 text-blue-400" />
                                            <span className="bg-gradient-to-r from-white to-gray-300 text-transparent bg-clip-text">
                                                Ticket Details
                                            </span>
                                        </h2>
                                    </div>
                                    <div className="p-6 space-y-6">
                                        {/* Type and Priority */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <h3 className="text-sm font-medium text-gray-400">Type</h3>
                                                <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
                                                    <p className="text-gray-200">{data.typeName || data.type}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-sm font-medium text-gray-400">Priority</h3>
                                                <div className={`p-3 rounded-xl border ${
                                                    data.priority.toLowerCase() === 'high' 
                                                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                                        : data.priority.toLowerCase() === 'medium'
                                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                                        : 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                                                }`}>
                                                    <p className="font-medium">{data.priority}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Claimed By Info */}
                                        {data.claimer && data.claimer !== 'Unclaimed' && (
                                            <div className="space-y-2">
                                                <h3 className="text-sm font-medium text-gray-400">Claimed By</h3>
                                                <div className="p-3 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-xl border border-indigo-500/20">
                                                    <div className="flex items-center gap-3">
                                                        {data.claimerData ? (
                                                            <>
                                                                <img
                                                                    src={data.claimerData.avatar}
                                                                    alt="Claimer"
                                                                    className="w-10 h-10 rounded-lg ring-2 ring-indigo-500/20"
                                                                    onError={(e) => {
                                                                        const target = e.target as HTMLImageElement;
                                                                        target.src = `https://cdn.discordapp.com/avatars/${data.claimer}/${parseInt(data.claimer || '0') % 5}.png`;
                                                                    }}
                                                                />
                                                                <div>
                                                                    <p className="text-gray-200 font-medium">
                                                                        {data.claimerData.displayName}
                                                                    </p>
                                                                    <p className="text-sm text-gray-400">
                                                                        Support Staff
                                                                    </p>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                                                    <FontAwesomeIcon icon={faUser} className="w-5 h-5 text-indigo-400" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-gray-200">Loading...</p>
                                                                    <p className="text-sm text-gray-400">Support Staff</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Creator Info */}
                                        <div className="space-y-2">
                                            <h3 className="text-sm font-medium text-gray-400">Creator</h3>
                                            <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
                                                {data.creatorData ? (
                                                    <>
                                                        <img
                                                            src={data.creatorData.avatar}
                                                            alt="Creator"
                                                            className="w-10 h-10 rounded-lg"
                                                        />
                                                        <div>
                                                            <p className="text-gray-200 font-medium">
                                                                {data.creatorData.displayName}
                                                            </p>
                                                            <p className="text-sm text-gray-500">
                                                                {data.creator}
                                                            </p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                                                            <FontAwesomeIcon icon={faUser} className="w-5 h-5 text-gray-600" />
                                                        </div>
                                                        <span className="text-gray-400">{data.creator}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Timestamps */}
                                        <div className="space-y-2">
                                            <h3 className="text-sm font-medium text-gray-400">Timeline</h3>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                                        <FontAwesomeIcon icon={faClock} className="w-4 h-4 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-400">Created</p>
                                                        <p className="text-gray-200">{formatDateTime(data.created)}</p>
                                                    </div>
                                                </div>
                                                {data.closed && (
                                                    <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
                                                        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                                            <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4 text-red-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm text-gray-400">Closed</p>
                                                            <p className="text-gray-200">{formatDateTime(data.closed)}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Rating & Feedback */}
                                        {(data.rating !== 'No Rating' || data.feedback) && (
                                            <div className="space-y-2">
                                                <h3 className="text-sm font-medium text-gray-400">Feedback</h3>
                                                <div className="space-y-3">
                                                    {data.rating !== 'No Rating' && (
                                                        <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
                                                            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                                                <FontAwesomeIcon icon={faThumbsUp} className="w-4 h-4 text-yellow-400" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-gray-400">Rating</p>
                                                                <p className="text-gray-200">{data.rating}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {data.feedback && (
                                                        <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
                                                            <p className="text-sm text-gray-400 mb-2">Comment</p>
                                                            <p className="text-gray-300">{data.feedback}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Close Reason */}
                                        {data.closeReason && (
                                            <div className="space-y-2">
                                                <h3 className="text-sm font-medium text-gray-400">Close Reason</h3>
                                                <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
                                                    <p className="text-gray-300">{data.closeReason}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Participants */}
                                        <div className="space-y-2">
                                            <h3 className="text-sm font-medium text-gray-400">Participants</h3>
                                            <div className="space-y-2">
                                                {Array.from(new Set(data.messages.map(msg => msg.authorId))).map((authorId) => {
                                                    const message = data.messages.find(msg => msg.authorId === authorId);
                                                    if (!message) return null;
                                                    
                                                    return (
                                                        <div key={authorId} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
                                                            <img
                                                                src={message.avatarUrl}
                                                                alt={message.displayName || message.author}
                                                                className="w-10 h-10 rounded-lg"
                                                            />
                                                            <div>
                                                                <p className="text-gray-200 font-medium">
                                                                    {message.displayName || message.author}
                                                                </p>
                                                                <p className="text-sm text-gray-500">
                                                                    {message.authorId}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Viewer Modal */}
            <AnimatePresence>
                {selectedImage && (
                    <ImageViewer
                        src={selectedImage.src}
                        alt={selectedImage.alt}
                        onClose={() => setSelectedImage(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}