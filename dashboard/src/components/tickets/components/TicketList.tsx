import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileAlt, faLock, faHandHolding } from '@fortawesome/free-solid-svg-icons'
import { userDataService } from '../../../utils/userDataService'
import { useEffect, useState } from 'react'
import moment from 'moment-timezone'

declare global {
    interface Window {
        USER_DATA?: {
            id: string;
        };
    }
}

interface Ticket {
    id: string | number;
    typeName?: string;
    type: string;
    status: string;
    priority: string;
    creator: string;
    assignee: string | null;
    createdAt: string;
    claimed?: boolean;
    claimedBy?: string | null;
}

const formatDateTime = (timestamp: string | undefined | null): string => {
    if (!timestamp) return 'Unknown Date';
    
    const isoDate = moment(timestamp);
    if (isoDate.isValid()) {
        return isoDate.tz(window.DASHBOARD_CONFIG.TIMEZONE).format('MMM D, YYYY [at] h:mm A z');
    }
    
    const date = moment(timestamp, ['MMM D, YYYY, hh:mm A z', 'MMM D, YYYY, HH:mm z']);
    if (date.isValid()) {
        return date.tz(window.DASHBOARD_CONFIG.TIMEZONE).format('MMM D, YYYY [at] h:mm A z');
    }
    
    return timestamp;
};

interface CachedUserData {
    avatar: string;
    displayName: string;
}

interface UserDisplayData {
    avatar: string;
    displayName: string;
    isLoading?: boolean;
}

interface TicketListProps {
    tickets: Ticket[]
}

export default function TicketList({ tickets: initialTickets = [] }: TicketListProps) {
    const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
    const [userDisplayData, setUserDisplayData] = useState<Record<string, UserDisplayData>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [supportPermissions, setSupportPermissions] = useState<Record<string, boolean>>({});
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

    useEffect(() => {
        setTickets(initialTickets);
        
        const loadPermissions = async () => {
            setIsLoadingPermissions(true);
            const uniqueTypes = Array.from(new Set(initialTickets.map(ticket => ticket.type)));
            const permissions: Record<string, boolean> = {};

            try {
                const permissionPromises = uniqueTypes.map(async (type) => {
                    try {
                        const response = await fetch(`/api/tickets/permissions/${type}`);
                        if (response.ok) {
                            const { hasSupport } = await response.json();
                            permissions[type] = hasSupport;
                        }
                    } catch (error) {
                        console.error(`Error checking permissions for type ${type}:`, error);
                        permissions[type] = false;
                    }
                });

                await Promise.all(permissionPromises);
                setSupportPermissions(permissions);
            } catch (error) {
                console.error('Error checking support permissions:', error);
            } finally {
                setIsLoadingPermissions(false);
            }
        };

        loadPermissions();
    }, [initialTickets]);

    useEffect(() => {
        const loadUserData = async () => {
            if (!tickets.length) return;

            const uniqueUsers = Array.from(new Set([
                ...tickets.map(ticket => ticket.creator),
                ...tickets.map(ticket => ticket.assignee).filter((assignee): assignee is string => assignee !== null)
            ]));

            const userDataPromises = uniqueUsers.map(async (userId) => {
                const data = await userDataService.getUserData(userId);
                return [userId, data] as const;
            });

            const userData = await Promise.all(userDataPromises);
            const initialData: Record<string, UserDisplayData> = Object.fromEntries(
                userData.map(([userId, data]) => [
                    userId,
                    {
                        avatar: data.avatar,
                        displayName: data.displayName
                    }
                ])
            );

            setUserDisplayData(initialData);
            userDataService.prefetchUsers(uniqueUsers);
        };

        loadUserData();

        const handleUserUpdate = (event: CustomEvent<{ userId: string; userData: CachedUserData }>) => {
            const { userId, userData } = event.detail;
            setUserDisplayData(prev => ({
                ...prev,
                [userId]: {
                    avatar: userData.avatar,
                    displayName: userData.displayName
                }
            }));
        };

        window.addEventListener('userDataUpdated', handleUserUpdate as EventListener);
        return () => {
            window.removeEventListener('userDataUpdated', handleUserUpdate as EventListener);
        };
    }, [tickets]);

    const handleClaimTicket = async (ticketId: string | number) => {
        try {
            setLoading(prev => ({ ...prev, [`claim-${ticketId}`]: true }));
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

            setTickets(prevTickets => 
                prevTickets.map(ticket => 
                    ticket.id === ticketId
                        ? {
                            ...ticket,
                            claimed: result.ticket.claimed,
                            claimedBy: result.ticket.claimedBy,
                            assignee: result.ticket.assignee
                        }
                        : ticket
                )
            );

            if (result.ticket.claimedBy && !userDisplayData[result.ticket.claimedBy]) {
                const userData = await userDataService.getUserData(result.ticket.claimedBy);
                setUserDisplayData(prev => ({
                    ...prev,
                    [result.ticket.claimedBy]: {
                        avatar: userData.avatar,
                        displayName: userData.displayName
                    }
                }));
            }
        } catch (error) {
            console.error('Error claiming ticket:', error);
            alert(error instanceof Error ? error.message : 'Failed to claim ticket');
        } finally {
            setLoading(prev => ({ ...prev, [`claim-${ticketId}`]: false }));
        }
    };

    const handleCloseTicket = async (ticketId: string | number) => {
        try {
            const reason = prompt('Enter a reason for closing the ticket (optional):');
            if (reason !== null) {
                setLoading(prev => ({ ...prev, [`close-${ticketId}`]: true }));

                alert('The ticket will now be closed.');

                setTickets(prevTickets => 
                    prevTickets.map(ticket => 
                        ticket.id === ticketId
                            ? { ...ticket, status: 'closing' }
                            : ticket
                    )
                );

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

                setTickets(prevTickets => 
                    prevTickets.map(ticket => 
                        ticket.id === ticketId
                            ? { 
                                ...ticket, 
                                status: 'closed',
                                statusStyle: 'bg-red-500/15 text-red-300 border border-red-500/30'
                            }
                            : ticket
                    )
                );
            }
        } catch (error) {
            console.error('Error closing ticket:', error);
            alert(error instanceof Error ? error.message : 'Failed to close ticket');
            
            setTickets(prevTickets => 
                prevTickets.map(ticket => 
                    ticket.id === ticketId
                        ? { 
                            ...ticket, 
                            status: 'open',
                            statusStyle: 'bg-green-500/15 text-green-300 border border-green-500/30'
                        }
                        : ticket
                )
            );
        } finally {
            setLoading(prev => ({ ...prev, [`close-${ticketId}`]: false }));
        }
    };

    if (!tickets?.length) {
        return (
            <div className="text-center py-8 text-gray-400">
                No tickets found
            </div>
        );
    }

    const getNumericId = (id: string | number) => {
        if (typeof id === 'number') return id;
        return id.toString().replace('#', '');
    };

    if (isLoadingPermissions) {
        return (
            <div className="overflow-hidden rounded-xl border border-gray-800/50 bg-gray-900/20 backdrop-blur-xl shadow-xl shadow-black/10">
                <table className="min-w-full divide-y divide-gray-800/50">
                    <thead>
                        <tr className="bg-gray-900/50 backdrop-blur-sm">
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">ID</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created By</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Priority</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Claimed By</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {[...Array(10)].map((_, i) => (
                            <tr key={i} className="animate-pulse">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="h-4 w-12 bg-gray-800/50 rounded"></div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="h-6 w-24 bg-gray-800/50 rounded-md"></div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-800/50"></div>
                                        <div className="h-4 w-24 bg-gray-800/50 rounded"></div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="h-6 w-16 bg-gray-800/50 rounded-full"></div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="h-6 w-16 bg-gray-800/50 rounded-full"></div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="h-4 w-32 bg-gray-800/50 rounded"></div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-800/50"></div>
                                        <div className="h-4 w-24 bg-gray-800/50 rounded"></div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-16 bg-gray-800/50 rounded-lg"></div>
                                        <div className="h-8 w-16 bg-gray-800/50 rounded-lg"></div>
                                        <div className="h-8 w-16 bg-gray-800/50 rounded-lg"></div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-800/50 bg-gray-900/20 backdrop-blur-xl shadow-xl shadow-black/10">
            <table className="min-w-full divide-y divide-gray-800/50">
                <thead>
                    <tr className="bg-gray-900/50 backdrop-blur-sm">
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">ID</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created By</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Priority</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Claimed By</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                    {tickets.map((ticket) => {
                        const numericId = getNumericId(ticket.id);
                        const userData = userDisplayData[ticket.creator] || userDataService.getDefaultUserData(ticket.creator);
                        return (
                            <tr
                                key={numericId}
                                className="group hover:bg-gray-800/40 transition-all duration-300 ease-in-out"
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <Link
                                        to={`/tickets/${numericId}/transcript`}
                                        className="text-blue-400 hover:text-blue-300 transition-all duration-200 font-medium group-hover:scale-105 inline-flex items-center gap-1.5"
                                    >
                                        <span className="text-gray-500">#</span>{numericId}
                                    </Link>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-800/50 text-gray-300 group-hover:bg-gray-800/70 transition-all duration-200 backdrop-blur-sm">
                                        {ticket.typeName || ticket.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={userData.avatar}
                                            alt={userData.displayName}
                                            className="w-8 h-8 rounded-full ring-2 ring-gray-700/50 group-hover:ring-blue-500/50 transition-all duration-200 object-cover"
                                        />
                                        <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors duration-200">
                                            {userData.displayName}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                                        ticket.status === 'open' ? 'bg-green-400/10 text-green-400 ring-1 ring-green-400/30 group-hover:bg-green-400/20 group-hover:ring-green-400/50' :
                                        ticket.status === 'closed' ? 'bg-red-400/10 text-red-400 ring-1 ring-red-400/30 group-hover:bg-red-400/20 group-hover:ring-red-400/50' :
                                        'bg-yellow-400/10 text-yellow-400 ring-1 ring-yellow-400/30 group-hover:bg-yellow-400/20 group-hover:ring-yellow-400/50'
                                    }`}>
                                        {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                                        ticket.priority === 'high' ? 'bg-rose-400/10 text-rose-400 ring-1 ring-rose-400/30 group-hover:bg-rose-400/20 group-hover:ring-rose-400/50' :
                                        ticket.priority === 'medium' ? 'bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/30 group-hover:bg-amber-400/20 group-hover:ring-amber-400/50' :
                                        'bg-teal-400/10 text-teal-400 ring-1 ring-teal-400/30 group-hover:bg-teal-400/20 group-hover:ring-teal-400/50'
                                    }`}>
                                        {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">
                                    <span className="group-hover:text-gray-300 transition-colors duration-200">
                                        {formatDateTime(ticket.createdAt)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {ticket.assignee ? (
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={userDisplayData[ticket.assignee]?.avatar || userDataService.getDefaultUserData(ticket.assignee).avatar}
                                                alt={userDisplayData[ticket.assignee]?.displayName || 'Unknown User'}
                                                className="w-8 h-8 rounded-full ring-2 ring-gray-700/50 group-hover:ring-purple-500/50 transition-all duration-200 object-cover"
                                            />
                                            <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors duration-200">
                                                {userDisplayData[ticket.assignee]?.displayName || 'Unknown User'}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-400/10 text-gray-400 ring-1 ring-gray-400/30 group-hover:bg-gray-400/20 group-hover:ring-gray-400/50 transition-all duration-200">
                                            Unclaimed
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2 opacity-90 group-hover:opacity-100 transition-all duration-200">
                                        <Link
                                            to={`/tickets/${numericId}/transcript`}
                                            className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 ring-1 ring-blue-500/30 hover:ring-blue-500/50 transition-all duration-200 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/10"
                                            title="View Transcript"
                                        >
                                            <FontAwesomeIcon icon={faFileAlt} className="w-3.5 h-3.5 mr-2" />
                                            View
                                        </Link>
                                        {ticket.status === 'open' && supportPermissions[ticket.type] && (
                                            <>
                                                <button
                                                    onClick={() => handleClaimTicket(numericId)}
                                                    disabled={loading[`claim-${numericId}`]}
                                                    className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 transform hover:scale-105 hover:shadow-lg ${
                                                        ticket.claimed
                                                            ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 ring-1 ring-amber-500/30 hover:ring-amber-500/50 hover:shadow-amber-500/10'
                                                            : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 ring-1 ring-indigo-500/30 hover:ring-indigo-500/50 hover:shadow-indigo-500/10'
                                                    }`}
                                                    title={ticket.claimed ? 'Unclaim this ticket' : 'Claim this ticket'}
                                                >
                                                    <FontAwesomeIcon 
                                                        icon={faHandHolding} 
                                                        className={`w-3.5 h-3.5 mr-2 ${loading[`claim-${numericId}`] ? 'animate-pulse' : ''}`} 
                                                    />
                                                    {ticket.claimed ? 'Unclaim' : 'Claim'}
                                                </button>
                                                <button
                                                    onClick={() => handleCloseTicket(numericId)}
                                                    disabled={loading[`close-${numericId}`]}
                                                    className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 ring-1 ring-rose-500/30 hover:ring-rose-500/50 transition-all duration-200 transform hover:scale-105 hover:shadow-lg hover:shadow-rose-500/10"
                                                    title="Close Ticket"
                                                >
                                                    <FontAwesomeIcon 
                                                        icon={faLock} 
                                                        className={`w-3.5 h-3.5 mr-2 ${loading[`close-${numericId}`] ? 'animate-pulse' : ''}`} 
                                                    />
                                                    Close
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}