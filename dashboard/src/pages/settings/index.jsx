import React from 'react';
import { motion } from 'framer-motion';
import BotActivitySettings from './modules/BotActivitySettings'
import DashboardSettings from './modules/DashboardSettings'
import AutoResponseSettings from './modules/AutoResponseSettings'
import AutoReactSettings from './modules/AutoReactSettings'
import NavigationSettings from './modules/NavigationSettings'
import ChannelStatsSettings from './modules/ChannelStatsSettings'

function SettingsPage() {
    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="p-6 space-y-6"
        >
            {/* Bot Configuration Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                    <h2 className="text-xl font-semibold text-white">Bot Configuration</h2>
                    <div className="flex-1 border-b border-gray-800/50"></div>
                </div>
                <BotActivitySettings />
                <ChannelStatsSettings />
            </div>

            {/* Dashboard Configuration Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                    <h2 className="text-xl font-semibold text-white">Dashboard Configuration</h2>
                    <div className="flex-1 border-b border-gray-800/50"></div>
                </div>
                <DashboardSettings />
                <NavigationSettings />
            </div>

            {/* Server Configuration Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                    <h2 className="text-xl font-semibold text-white">Server Configuration</h2>
                    <div className="flex-1 border-b border-gray-800/50"></div>
                </div>
                <AutoResponseSettings />
                <AutoReactSettings />
            </div>
        </motion.div>
    );
}

export default SettingsPage; 