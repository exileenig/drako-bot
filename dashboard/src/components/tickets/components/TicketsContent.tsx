import React, { useState, useEffect, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import TicketList from './TicketList'
import TicketStats from './TicketStats'
import TicketFilters from './TicketFilters'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { Ticket, TicketStats as ITicketStats, TicketFilters as ITicketFilters, TicketPagination } from '../../../types/ticket'
import { ticketService } from '../../../services/ticketService'

export default function TicketsContent() {
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true)
    const [pageLoading, setPageLoading] = useState(false)
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [stats, setStats] = useState<ITicketStats>({
        totalTickets: 0,
        openTickets: 0,
        avgResponseTime: 0,
        satisfactionRate: 0,
        weeklyChanges: {
            totalTickets: 0,
            openTickets: 0,
            avgResponseTime: 0,
            satisfactionRate: 0
        }
    })
    const [pagination, setPagination] = useState<TicketPagination>({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0
    })
    const [filters, setFilters] = useState<ITicketFilters>({
        status: searchParams.get('status') || 'all',
        priority: searchParams.get('priority') || 'all',
        type: searchParams.get('type') || 'all',
        search: searchParams.get('search') || '',
        sortBy: searchParams.get('sortBy') || 'newest'
    })

    useEffect(() => {
        setFilters({
            status: searchParams.get('status') || 'all',
            priority: searchParams.get('priority') || 'all',
            type: searchParams.get('type') || 'all',
            search: searchParams.get('search') || '',
            sortBy: searchParams.get('sortBy') || 'newest'
        });
    }, [searchParams]);

    useEffect(() => {
        fetchTickets(1)
    }, [filters])

    async function fetchTickets(page: number) {
        if (pageLoading) return;

        try {
            setPageLoading(true)
            setPagination(prev => ({ ...prev, currentPage: page }))

            const data = await ticketService.getTickets(filters, page)
            if (data.tickets) {
                setTickets(data.tickets)
                setPagination({
                    currentPage: data.pagination.page,
                    totalPages: data.pagination.pages,
                    totalItems: data.pagination.total
                })

                const totalTickets = data.stats?.totalTickets || data.pagination.total || 0
                const openTickets = data.stats?.openTickets || data.tickets.filter(t => t.status === 'open').length || 0

                setStats({
                    totalTickets: Number(totalTickets),
                    openTickets: Number(openTickets),
                    avgResponseTime: Number(data.stats?.avgResponseTime || 0),
                    satisfactionRate: data.stats?.satisfactionRate ?? 96.83,
                    weeklyChanges: data.stats?.weeklyChanges || {
                        totalTickets: 0,
                        openTickets: 0,
                        avgResponseTime: 0,
                        satisfactionRate: 0
                    }
                })
            }
        } catch (error) {
            console.error('Failed to fetch tickets:', error)
        } finally {
            setPageLoading(false)
            setLoading(false)
        }
    }

    if (loading) {
        return <LoadingSpinner />
    }

    return (
        <div className="space-y-6 min-w-0">
            <TicketStats
                tickets={tickets}
                totalTickets={stats.totalTickets}
                openTickets={stats.openTickets}
                avgResponseTime={stats.avgResponseTime}
                satisfactionRate={stats.satisfactionRate}
                weeklyChanges={stats.weeklyChanges}
            />

            <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-gray-800/50">
                <TicketFilters filters={filters} setFilters={setFilters} />

                <div className="relative">
                    {pageLoading && (
                        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
                            <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    )}
                    <div className="overflow-x-auto rounded-lg">
                        <div className="inline-block min-w-full align-middle">
                            <div className="mb-4 relative">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <FontAwesomeIcon icon={faSearch} className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by display name, Discord username, ticket content, or channel..."
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                    className="bg-gray-800/30 border border-gray-700/50 rounded-xl pl-10 pr-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-800/50 focus:border-blue-500/30 hover:bg-gray-800/40 w-full placeholder-gray-500 text-white"
                                />
                            </div>
                            <div className="overflow-hidden">
                                <TicketList tickets={tickets} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-gray-400 w-full sm:w-auto text-center sm:text-left">
                        Showing {tickets.length} of {pagination.totalItems} tickets
                        {pageLoading && <span className="ml-2">Loading...</span>}
                    </div>
                    <div className="flex flex-wrap justify-center sm:justify-end gap-2">
                        <button
                            onClick={() => !pageLoading && fetchTickets(pagination.currentPage - 1)}
                            disabled={pagination.currentPage === 1 || pageLoading}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 
                                ${pagination.currentPage === 1 || pageLoading
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                        >
                            Previous
                        </button>
                        <div className="flex flex-wrap justify-center gap-2">
                            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                                .filter(page => {
                                    const current = pagination.currentPage;
                                    return page === 1 ||
                                        page === pagination.totalPages ||
                                        (page >= current - 1 && page <= current + 1);
                                })
                                .map((page, index, array) => (
                                    <Fragment key={page}>
                                        {index > 0 && array[index - 1] !== page - 1 && (
                                            <span className="text-gray-500">...</span>
                                        )}
                                        <button
                                            onClick={() => !pageLoading && fetchTickets(page)}
                                            disabled={pageLoading}
                                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 
                                                ${pagination.currentPage === page
                                                    ? 'bg-blue-500 text-white'
                                                    : pageLoading
                                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                                        >
                                            {page}
                                        </button>
                                    </Fragment>
                                ))}
                        </div>
                        <button
                            onClick={() => !pageLoading && fetchTickets(pagination.currentPage + 1)}
                            disabled={pagination.currentPage === pagination.totalPages || pageLoading}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 
                                ${pagination.currentPage === pagination.totalPages || pageLoading
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
} 