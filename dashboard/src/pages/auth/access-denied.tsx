import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faHome } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';

export default function AccessDeniedPage() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-md w-full mx-4 bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 shadow-lg border border-gray-800/50"
            >
                <div className="text-center">
                    <div className="bg-red-500/10 w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-6">
                        <FontAwesomeIcon icon={faLock} className="w-8 h-8 text-red-500" />
                    </div>
                    
                    <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                    
                    <p className="text-gray-400 mb-6">
                        You don't have permission to access this page. Please contact an administrator if you believe this is a mistake.
                    </p>

                    <Link 
                        to="/"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
                    >
                        <FontAwesomeIcon icon={faHome} className="w-4 h-4" />
                        Return Home
                    </Link>
                </div>
            </motion.div>
        </div>
    );
} 