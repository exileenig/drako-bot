import React from 'react'
import { useParams } from 'react-router-dom'

function TicketPage() {
  const { id } = useParams()

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-white">Ticket #{id}</h1>
      <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/50">
        <p className="text-gray-300">Ticket details will be displayed here</p>
      </div>
    </div>
  )
}

export default TicketPage 