import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { userDataService } from '../../../utils/userDataService'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileAlt } from '@fortawesome/free-solid-svg-icons'

interface UserDisplayData {
    avatar: string
    displayName: string
}

interface RecentTicketsProps {
    tickets: Array<{
        id: string | number
        typeName?: string
        type: string
        status: string
        priority: string
        date: string
        creator: string
    }>
}

export default function RecentTickets({ tickets = [] }: RecentTicketsProps) {
    const [userDisplayData, setUserDisplayData] = useState<Record<string, UserDisplayData>>({})

    useEffect(() => {
        const loadUserData = async () => {
            if (!tickets.length) return

            const uniqueCreators = Array.from(new Set(tickets.map(ticket => ticket.creator)))

            const initialData: Record<string, UserDisplayData> = {}
            for (const creator of uniqueCreators) {
                const data = await userDataService.getUserData(creator)
                initialData[creator] = {
                    avatar: data.avatar,
                    displayName: data.displayName
                }
            }
            setUserDisplayData(initialData)

            userDataService.prefetchUsers(uniqueCreators)
        }

        loadUserData()

        const handleUserUpdate = (event: CustomEvent<{ userId: string; userData: { avatar: string; displayName: string } }>) => {
            const { userId, userData } = event.detail
            setUserDisplayData(prev => ({
                ...prev,
                [userId]: {
                    avatar: userData.avatar,
                    displayName: userData.displayName
                }
            }))
        }

        window.addEventListener('userDataUpdated', handleUserUpdate as EventListener)
        return () => {
            window.removeEventListener('userDataUpdated', handleUserUpdate as EventListener)
        }
    }, [tickets])

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className="overflow-hidden rounded-xl border border-gray-800/50 bg-gray-900/20 backdrop-blur-xl shadow-xl shadow-black/10"
        >
            <div className="flex justify-between items-center p-6 border-b border-gray-800/50">
                <h3 className="text-lg font-medium text-gray-200">Recent Tickets</h3>
                <Link
                    to="/tickets"
                    className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 ring-1 ring-blue-500/30 hover:ring-blue-500/50 transition-all duration-200 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/10"
                >
                    View All
                </Link>
            </div>
            {tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-gray-400 text-sm">No Recent Tickets Available</p>
                    <p className="text-gray-500 text-xs mt-1">You don't have any tickets to display at the moment</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-800/50">
                        <thead>
                            <tr className="bg-gray-900/50 backdrop-blur-sm">
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">ID</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created By</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Priority</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {tickets.map((ticket) => {
                                const userData = userDisplayData[ticket.creator] || userDataService.getDefaultUserData(ticket.creator);
                                return (
                                    <motion.tr
                                        key={ticket.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="group hover:bg-gray-800/40 transition-all duration-300 ease-in-out"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link
                                                to={`/tickets/${ticket.id}/transcript`}
                                                className="text-blue-400 hover:text-blue-300 transition-all duration-200 font-medium group-hover:scale-105 inline-flex items-center gap-1.5"
                                            >
                                                <span className="text-gray-500">#</span>{ticket.id}
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
                                                {ticket.date}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 opacity-90 group-hover:opacity-100 transition-all duration-200">
                                                <Link
                                                    to={`/tickets/${ticket.id}/transcript`}
                                                    className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 ring-1 ring-blue-500/30 hover:ring-blue-500/50 transition-all duration-200 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/10"
                                                    title="View Transcript"
                                                >
                                                    <FontAwesomeIcon icon={faFileAlt} className="w-3.5 h-3.5 mr-2" />
                                                    View
                                                </Link>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </motion.div>
    )
}
