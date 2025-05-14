import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faSignOut, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { auth } from '../../lib/auth/auth';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../lib/auth/auth';
import { socket } from '../../socket';

interface UserStatus {
    status: 'online' | 'idle' | 'dnd' | 'offline';
}

interface ProfileButtonProps {
    className?: string;
    minimal?: boolean;
}

export function ProfileButton({ className = '', minimal = false }: ProfileButtonProps) {
    const [user, setUser] = useState<User | null>(null);
    const [userStatus, setUserStatus] = useState<UserStatus>({ status: 'offline' });
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const loadUser = async () => {
            try {
                const userData = await auth.getUser();
                setUser(userData);

                if (userData) {
                    await fetchUserStatus();
                }
            } catch (error) {
                console.error('Failed to load user:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadUser();

        socket.on('presenceUpdate', (data: { userId: string; status: string }) => {
            if (user && data.userId === user.id) {
                setUserStatus({ status: data.status as UserStatus['status'] });
            }
        });

        const statusInterval = setInterval(fetchUserStatus, 30000);

        return () => {
            clearInterval(statusInterval);
            socket.off('presenceUpdate');
        };
    }, [user]);

    const fetchUserStatus = async () => {
        if (!user) return;
        
        try {
            const response = await fetch(`${window.DASHBOARD_CONFIG?.API_URL}/auth/status`, {
                credentials: 'include'
            });
            if (response.ok) {
                const status = await response.json();
                setUserStatus(status);
            }
        } catch (error) {
            console.error('Failed to fetch user status:', error);
        }
    };

    const handleLogout = async () => {
        await auth.logout();
        navigate('/auth/signin');
    };

    if (isLoading) {
        return minimal ? (
            <div className={`flex items-center space-x-3 animate-pulse ${className}`}>
                <div className="w-8 h-8 rounded-full bg-gray-700/50" />
                <div className="h-4 w-24 bg-gray-700/50 rounded" />
            </div>
        ) : (
            <div className={`flex items-center space-x-3 p-2 rounded-xl bg-gray-800/30 border border-gray-700/30 animate-pulse ${className}`}>
                <div className="w-8 h-8 rounded-full bg-gray-700/50" />
                <div className="flex-1">
                    <div className="h-4 w-24 bg-gray-700/50 rounded" />
                    <div className="h-3 w-16 bg-gray-700/50 rounded mt-1" />
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <button
                onClick={() => auth.login()}
                className="relative group flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-[#5865F2] to-[#4752C4] text-white rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-[#5865F2]/20 hover:scale-[1.02]"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-[#5865F2]/50 to-[#4752C4]/50 rounded-xl blur opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
                <FontAwesomeIcon icon={faUser} className="relative h-4 w-4" />
                <span className="relative font-medium">Sign In with Discord</span>
            </button>
        );
    }

    const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;

    const displayName = user.global_name || user.username;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online':
                return 'bg-green-500';
            case 'idle':
                return 'bg-yellow-500';
            case 'dnd':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };

    if (minimal) {
        return (
            <div className={`group transition-all duration-200 ${className}`}>
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <img
                            src={avatarUrl}
                            alt={displayName}
                            className="w-8 h-8 rounded-full ring-2 transition-all duration-200 ring-gray-700/50 group-hover:ring-indigo-500/50"
                            onError={(e) => {
                                (e.target as HTMLImageElement).onerror = null;
                                (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/0.png`;
                            }}
                        />
                        <motion.div
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${getStatusColor(userStatus.status)} rounded-full ring-2 ring-gray-900`}
                            animate={{
                                scale: [1, 1.1, 1],
                                opacity: [1, 0.8, 1],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors duration-200">
                            {displayName}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="group flex items-center space-x-3 px-4 py-2 bg-gray-900/50 rounded-xl border border-gray-800/50 backdrop-blur-xl transition-all duration-300 hover:bg-gray-800/50"
            >
                <div className="relative">
                    {/* Status indicator */}
                    <motion.div
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${getStatusColor(userStatus.status)} rounded-full ring-2 ring-gray-900 z-10`}
                        animate={{
                            scale: [1, 1.1, 1],
                            opacity: [1, 0.8, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                    
                    {/* Avatar container with hover effect */}
                    <div className="relative overflow-hidden rounded-lg transition-transform duration-300 group-hover:scale-105">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <img
                            src={avatarUrl}
                            alt="Profile"
                            className="relative w-9 h-9 rounded-lg ring-2 ring-gray-700/50 transition-all duration-300 group-hover:ring-blue-500/50"
                            onError={(e) => {
                                (e.target as HTMLImageElement).onerror = null;
                                (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/0.png`;
                            }}
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="flex flex-col items-start">
                        <span className="text-gray-200 font-medium text-sm transition-colors duration-300 group-hover:text-white">
                            {displayName}
                        </span>
                        <span className="text-gray-500 text-xs transition-colors duration-300 group-hover:text-gray-400">
                            @{user.username}
                        </span>
                    </div>
                    <FontAwesomeIcon 
                        icon={faChevronDown} 
                        className={`w-3 h-3 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 shadow-xl z-50 overflow-hidden">
                        <div className="p-2">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                            >
                                <FontAwesomeIcon icon={faSignOut} className="w-4 h-4" />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
} 