import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faChevronDown, faTimes } from '@fortawesome/free-solid-svg-icons';

const activityTypes = [
  { value: 'PLAYING', label: 'Playing' },
  { value: 'LISTENING', label: 'Listening' },
  { value: 'WATCHING', label: 'Watching' },
  { value: 'STREAMING', label: 'Streaming' },
  { value: 'COMPETING', label: 'Competing' }
];

const statusTypes = [
  { value: 'online', label: 'Online' },
  { value: 'idle', label: 'Idle' },
  { value: 'dnd', label: 'Do Not Disturb' }
];

const placeholders = {
  'Server Stats': [
    { value: '{total-users}', label: 'Total members' },
    { value: '{online-members}', label: 'Online members' },
    { value: '{total-channels}', label: 'Total channels' },
    { value: '{total-messages}', label: 'Total messages' },
    { value: '{total-boosts}', label: 'Server boosts' }
  ],
  'Bot Stats': [
    { value: '{uptime}', label: 'Bot uptime' },
    { value: '{times-bot-started}', label: 'Start count' },
    { value: '{total-cases}', label: 'Mod cases' }
  ],
  'Tickets': [
    { value: '{open-tickets}', label: 'Open tickets' },
    { value: '{closed-tickets}', label: 'Closed tickets' },
    { value: '{deleted-tickets}', label: 'Deleted tickets' },
    { value: '{total-tickets}', label: 'Total tickets' }
  ],
  'Other': [
    { value: '{total-suggestions}', label: 'Suggestions' }
  ]
};

function BotActivitySettings() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activities, setActivities] = useState([]);
  const [newActivity, setNewActivity] = useState({
    activityType: 'PLAYING',
    statusType: 'online',
    status: '',
    streamingURL: ''
  });

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const response = await axios.get('/api/settings/bot-activity');
      setActivities(response.data.activities || []);
      setNewActivity(response.data.current || {
        activityType: 'PLAYING',
        statusType: 'online',
        status: '',
        streamingURL: ''
      });
    } catch (err) {
      setError('Failed to fetch bot activities');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    try {
      if (!newActivity.status.trim()) {
        setError('Activity message is required');
        return;
      }

      if (newActivity.activityType === 'STREAMING' && !newActivity.streamingURL) {
        setError('Streaming URL is required for streaming activity type');
        return;
      }

      const activityData = {
        ...newActivity,
        status: newActivity.status.trim(),
        streamingURL: newActivity.activityType === 'STREAMING' ? newActivity.streamingURL : null
      };

      await axios.post('/api/settings/bot-activity', activityData);
      setNewActivity({
        activityType: 'PLAYING',
        statusType: 'online',
        status: '',
        streamingURL: ''
      });
      setError('');
      fetchActivities();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add activity');
      console.error(err);
    }
  };

  const handleRemoveActivity = async (index) => {
    try {
      await axios.delete(`/api/settings/bot-activity/${index}`);
      fetchActivities();
    } catch (err) {
      setError('Failed to remove activity');
      console.error(err);
    }
  };

  if (loading && isExpanded) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-gray-800/50"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between hover:bg-gray-800/30 transition-colors duration-200 rounded-lg"
        >
          <div className="flex items-center gap-4">
            <div className="bg-blue-500/10 p-3 rounded-xl">
              <FontAwesomeIcon icon={faRobot} className="h-6 w-6 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">Bot Activity</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">Loading...</span>
            <FontAwesomeIcon
              icon={faChevronDown}
              className={`w-4 h-4 text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </div>
        </button>
        {isExpanded && (
          <div className="mt-6">
            <div className="mt-4 text-gray-300">Loading...</div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-gray-800/50"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:bg-gray-800/30 transition-colors duration-200 rounded-lg"
      >
        <div className="flex items-center gap-4">
          <div className="bg-blue-500/10 p-3 rounded-xl">
            <FontAwesomeIcon icon={faRobot} className="h-6 w-6 text-blue-500" />
          </div>
          <h2 className="text-xl font-semibold text-white">Bot Activity</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{activities.length} activities</span>
          <FontAwesomeIcon
            icon={faChevronDown}
            className={`w-4 h-4 text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="mt-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleAddActivity} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Activity Type</label>
                <select
                  value={newActivity.activityType}
                  onChange={(e) => setNewActivity({ ...newActivity, activityType: e.target.value })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {activityTypes.map((type) => (
                    <option key={type.value} value={type.value} className="bg-gray-800">
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status Type</label>
                <select
                  value={newActivity.statusType}
                  onChange={(e) => setNewActivity({ ...newActivity, statusType: e.target.value })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {statusTypes.map((type) => (
                    <option key={type.value} value={type.value} className="bg-gray-800">
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Activity Message</label>
              <input
                type="text"
                value={newActivity.status}
                onChange={(e) => setNewActivity({ ...newActivity, status: e.target.value })}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter activity message"
              />
              <div className="mt-4 space-y-4">
                {Object.entries(placeholders).map(([category, items]) => (
                  <div key={category}>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">{category}</h4>
                    <div className="flex flex-wrap gap-2">
                      {items.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setNewActivity({
                            ...newActivity,
                            status: newActivity.status + item.value
                          })}
                          className="px-2 py-1 text-xs font-medium text-gray-300 bg-gray-800/50 border border-gray-700/50 rounded-lg hover:bg-gray-700/50 transition-colors duration-200"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {newActivity.activityType === 'STREAMING' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Streaming URL</label>
                <input
                  type="url"
                  value={newActivity.streamingURL}
                  onChange={(e) => setNewActivity({ ...newActivity, streamingURL: e.target.value })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter streaming URL"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200"
            >
              Add Activity
            </button>
          </form>

          {/* Current Activities List */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Current Activities</h3>
              <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-1 rounded-lg">
                {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
              </span>
            </div>
            {activities.length === 0 ? (
              <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
                <p className="text-sm text-gray-500 text-center">No activities configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.1 }}
                    className="group bg-gray-800/30 border border-gray-700/30 rounded-xl overflow-hidden hover:bg-gray-800/50 transition-colors duration-200"
                  >
                    <div className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-sm text-gray-200">{activity.status}</p>
                        <p className="text-xs text-gray-400">
                          {activityTypes.find(t => t.value === activity.activityType)?.label} • 
                          {statusTypes.find(t => t.value === activity.statusType)?.label}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveActivity(index)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default BotActivitySettings; 