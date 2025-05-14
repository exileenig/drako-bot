import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faChevronDown, faTimes, faPen } from '@fortawesome/free-solid-svg-icons';

const statTypes = [
  { value: 'MemberCount', label: 'Member Count' },
  { value: 'NitroBoosterCount', label: 'Nitro Booster Count' },
  { value: 'ServerCreationDate', label: 'Server Creation Date' },
  { value: 'TotalRolesCount', label: 'Total Roles Count' },
  { value: 'TotalEmojisCount', label: 'Total Emojis Count' },
  { value: 'TotalChannelsCount', label: 'Total Channels Count' },
  { value: 'OnlineMembersCount', label: 'Online Members Count' },
  { value: 'ServerRegion', label: 'Server Region' },
  { value: 'TotalBannedMembers', label: 'Total Banned Members' },
  { value: 'TotalMembersWithRole', label: 'Total Members With Role' },
  { value: 'OnlineMembersWithRole', label: 'Online Members With Role' },
  { value: 'TotalTickets', label: 'Total Tickets' },
  { value: 'OpenTickets', label: 'Open Tickets' },
  { value: 'ClosedTickets', label: 'Closed Tickets' },
  { value: 'DeletedTickets', label: 'Deleted Tickets' }
];

function ChannelStatsSettings() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState([]);
  const [voiceChannels, setVoiceChannels] = useState([]);
  const [editingStat, setEditingStat] = useState(null);
  const [newStat, setNewStat] = useState({
    type: 'MemberCount',
    channelName: '',
    roleId: '',
    existingChannelId: '',
    createNewChannel: true
  });

  useEffect(() => {
    fetchStats();
    fetchVoiceChannels();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/settings/channel-stats');
      setStats(response.data || []);
    } catch (err) {
      setError('Failed to fetch channel stats');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVoiceChannels = async () => {
    try {
      const response = await axios.get('/api/settings/server-data');
      const channels = response.data.channels.filter(channel => channel.type === 'GUILD_VOICE');
      setVoiceChannels(channels);
    } catch (err) {
      console.error('Failed to fetch voice channels:', err);
    }
  };

  const handleAddStat = async (e) => {
    e.preventDefault();
    try {
      if (newStat.createNewChannel) {
        if (!newStat.channelName.trim()) {
          setError('Channel name is required');
          return;
        }

        if (!newStat.channelName.includes('{stats}')) {
          setError('Channel name must include the {stats} placeholder');
          return;
        }
      } else {
        if (!newStat.existingChannelId) {
          setError('Please select a voice channel');
          return;
        }
      }

      if ((newStat.type === 'TotalMembersWithRole' || newStat.type === 'OnlineMembersWithRole') && !newStat.roleId) {
        setError('Role ID is required for role-based stats');
        return;
      }

      await axios.post('/api/settings/channel-stats', {
        type: newStat.type,
        channelName: newStat.createNewChannel ? newStat.channelName : null,
        roleId: newStat.roleId || null,
        existingChannelId: newStat.createNewChannel ? null : newStat.existingChannelId,
        createNewChannel: newStat.createNewChannel
      });

      setNewStat({
        type: 'MemberCount',
        channelName: '',
        roleId: '',
        existingChannelId: '',
        createNewChannel: true
      });
      setError('');
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add channel stat');
      console.error(err);
    }
  };

  const handleRemoveStat = async (channelId) => {
    try {
      await axios.delete(`/api/settings/channel-stats/${channelId}`);
      fetchStats();
    } catch (err) {
      setError('Failed to remove channel stat');
      console.error(err);
    }
  };

  const handleEditStat = async (stat) => {
    try {
      const channelName = editingStat?.channelName?.trim();
      
      if (!channelName) {
        setError('Channel name is required');
        return;
      }

      if (!channelName.includes('{stats}')) {
        setError('Channel name must include the {stats} placeholder');
        return;
      }

      const templateParts = channelName.split('{stats}');
      const formattedTemplate = templateParts.length === 2 
        ? `${templateParts[0]}{stats}${templateParts[1]}`
        : channelName;

      const response = await axios.put(`/api/settings/channel-stats/${stat.channelId}`, {
        channelName: formattedTemplate
      });

      if (response.data) {
        setStats(prevStats => {
          const newStats = prevStats.map(s => 
            s.channelId === stat.channelId ? response.data : s
          );
          return newStats;
        });
        setEditingStat(null);
        setError('');
      }
    } catch (error) {
      console.error('Failed to update channel stat:', error);
      setError(error.response?.data?.error || 'Failed to update channel stat');
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
            <div className="bg-purple-500/10 p-3 rounded-xl">
              <FontAwesomeIcon icon={faChartLine} className="h-6 w-6 text-purple-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">Channel Stats</h2>
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
          <div className="bg-purple-500/10 p-3 rounded-xl">
            <FontAwesomeIcon icon={faChartLine} className="h-6 w-6 text-purple-500" />
          </div>
          <h2 className="text-xl font-semibold text-white">Channel Stats</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{stats.length} stats</span>
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

          <form onSubmit={handleAddStat} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Stat Type</label>
              <select
                value={newStat.type}
                onChange={(e) => setNewStat({ ...newStat, type: e.target.value })}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {statTypes.map((type) => (
                  <option key={type.value} value={type.value} className="bg-gray-800">
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-300">Channel</label>
                <button
                  type="button"
                  onClick={() => setNewStat(prev => ({ ...prev, createNewChannel: !prev.createNewChannel }))}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors duration-200 ${
                    newStat.createNewChannel
                      ? 'bg-gray-800/50 text-gray-400 hover:bg-gray-800/70'
                      : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                  }`}
                >
                  {newStat.createNewChannel ? 'Use Existing' : 'Create New'}
                </button>
              </div>

              {newStat.createNewChannel ? (
                <div>
                  <input
                    type="text"
                    value={newStat.channelName}
                    onChange={(e) => setNewStat({ ...newStat, channelName: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter channel name with {stats} placeholder"
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    Use {'{stats}'} as a placeholder where you want the stat value to appear
                  </p>
                </div>
              ) : (
                <select
                  value={newStat.existingChannelId}
                  onChange={(e) => setNewStat({ ...newStat, existingChannelId: e.target.value })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="" className="bg-gray-800">Select a channel</option>
                  {voiceChannels.map((channel) => (
                    <option key={channel.id} value={channel.id} className="bg-gray-800">
                      {channel.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {(newStat.type === 'TotalMembersWithRole' || newStat.type === 'OnlineMembersWithRole') && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Role ID</label>
                <input
                  type="text"
                  value={newStat.roleId}
                  onChange={(e) => setNewStat({ ...newStat, roleId: e.target.value })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter role ID"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:from-purple-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200"
            >
              Add Channel Stat
            </button>
          </form>

          {/* Current Stats List */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Current Stats</h3>
              <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-1 rounded-lg">
                {stats.length} {stats.length === 1 ? 'stat' : 'stats'}
              </span>
            </div>
            {stats.length === 0 ? (
              <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
                <p className="text-sm text-gray-500 text-center">No channel stats configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.map((stat) => (
                  <motion.div
                    key={stat.channelId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group bg-gray-800/30 border border-gray-700/30 rounded-xl overflow-hidden hover:bg-gray-800/50 transition-colors duration-200"
                  >
                    <div className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        {editingStat?.channelId === stat.channelId ? (
                          <input
                            type="text"
                            value={editingStat.channelName}
                            onChange={(e) => setEditingStat({ ...editingStat, channelName: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleEditStat(stat);
                              } else if (e.key === 'Escape') {
                                setEditingStat(null);
                              }
                            }}
                            className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Channel name with {stats}"
                            autoFocus
                          />
                        ) : (
                          <p className="font-medium text-sm text-gray-200">{stat.channelName}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {statTypes.find(t => t.value === stat.type)?.label}
                          {stat.roleId && ` • Role ID: ${stat.roleId}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingStat?.channelId === stat.channelId ? (
                          <>
                            <button
                              onClick={() => handleEditStat(stat)}
                              className="p-2 text-green-400 hover:text-green-300 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStat(null)}
                              className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                const templateName = stat.channelName.trim();
                                setEditingStat({
                                  ...stat,
                                  channelName: templateName
                                });
                              }}
                              className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
                            >
                              <FontAwesomeIcon icon={faPen} className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveStat(stat.channelId)}
                              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                            >
                              <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
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

export default ChannelStatsSettings; 