import React, { useState, useEffect } from 'react';
import api from '../../../lib/api/axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSmile, faChevronDown, faPlus, faTimes } from '@fortawesome/free-solid-svg-icons';
import SelectMenu from '../../../components/ui/select-menu';
import { motion } from 'framer-motion';

const standardEmojis = [
  '👍', '👎', '❤️', '🎉', '🔥', '👀', '💯', '✅', '❌', '⭐',
  '🌟', '💪', '🙏', '🤔', '😄', '😊', '🙂', '😂', '😍', '😎',
  '😢', '😭', '😤', '😠', '🎮', '🎲', '🎯', '🎨', '🎭', '🎪'
];

const safeIncludes = (str, pattern) => {
  if (!str || typeof str !== 'string') return false;
  return str.includes(pattern);
};

const getEmojiDisplay = (emoji) => {
  if (!emoji) return null;
  
  if (safeIncludes(emoji, ':')) {
    try {
      const parts = emoji.split(':');
      const id = parts[2]?.replace('>', '') || '';
      const name = parts[1] || '';
      return {
        isCustom: true,
        url: `https://cdn.discordapp.com/emojis/${id}.png`,
        name: name
      };
    } catch (err) {
      console.error('Error parsing custom emoji:', err);
      return null;
    }
  }
  
  return {
    isCustom: false,
    emoji: emoji
  };
};

function AutoReactSettings() {
  const [reactions, setReactions] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [serverData, setServerData] = useState({
    emojis: [],
    roles: [],
    channels: []
  });
  const [newReaction, setNewReaction] = useState({
    keyword: '',
    emoji: '',
    whitelistRoles: [],
    whitelistChannels: []
  });

  useEffect(() => {
    if (isExpanded) {
      fetchServerData();
      fetchReactions();
    }
  }, [isExpanded]);

  const fetchServerData = async () => {
    try {
      const response = await api.get('/settings/server-data');
      setServerData(response.data);
    } catch (err) {
      setError('Failed to fetch server data');
      console.error(err);
    }
  };

  const fetchReactions = async () => {
    try {
      const response = await api.get('/settings/auto-reacts');
      setReactions(response.data || []);
    } catch (err) {
      setError('Failed to fetch auto reactions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReaction = async (e) => {
    e.preventDefault();

    const isDuplicate = reactions.some(reaction => 
      reaction.keyword.toLowerCase() === newReaction.keyword.toLowerCase()
    );

    if (isDuplicate) {
      setError('A reaction with this keyword already exists');
      return;
    }

    try {
      await api.post('/settings/auto-reacts', newReaction);
      setShowAddModal(false);
      setNewReaction({
        keyword: '',
        emoji: '',
        whitelistRoles: [],
        whitelistChannels: []
      });
      setError('');
      fetchReactions();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add auto reaction');
      console.error(err);
    }
  };

  const handleRemoveReaction = async (id) => {
    try {
      await api.delete(`/settings/auto-reacts/${id}`);
      fetchReactions();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove auto reaction');
      console.error(err);
    }
  };

  const renderEmoji = (emoji) => {
    const display = getEmojiDisplay(emoji);
    if (!display) return null;

    return display.isCustom ? (
      <img 
        src={display.url}
        alt={display.name}
        className="w-6 h-6"
      />
    ) : (
      <span className="text-2xl">{display.emoji}</span>
    );
  };

  const standardEmojiOptions = standardEmojis.map(emoji => ({
    value: emoji,
    label: emoji,
    displayElement: (
      <div className="flex items-center space-x-2">
        <span className="text-xl">{emoji}</span>
        <span className="text-gray-400 text-sm">Emoji</span>
      </div>
    )
  }));

  const customEmojiOptions = serverData.emojis?.map(emoji => ({
    value: emoji.isStandard ? emoji.name : `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`,
    label: emoji.name,
    displayElement: (
      <div className="flex items-center space-x-2">
        {emoji.isStandard ? (
          <span className="text-xl">{emoji.name}</span>
        ) : (
          <img 
            src={emoji.imageURL ? (typeof emoji.imageURL === 'function' ? emoji.imageURL() : emoji.imageURL) : `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`} 
            alt={emoji.name} 
            className="w-5 h-5" 
          />
        )}
        <span className="text-gray-400 text-sm">{emoji.name}</span>
      </div>
    )
  })) || [];

  const allEmojiOptions = [
    ...standardEmojiOptions,
    ...customEmojiOptions
  ];

  const roleOptions = serverData.roles?.map(role => ({
    value: role.id,
    label: role.name,
    icon: <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
  })) || [];

  const channelOptions = serverData.channels?.map(channel => ({
    value: channel.id,
    label: `#${channel.name}`,
    parent: channel.parent
  })) || [];

  const groupedChannelOptions = channelOptions.reduce((acc, channel) => {
    const parent = channel.parent || 'No Category';
    if (!acc[parent]) {
      acc[parent] = [];
    }
    acc[parent].push(channel);
    return acc;
  }, {});

  const flatChannelOptions = Object.entries(groupedChannelOptions).flatMap(([category, channels]) => [
    { value: category, label: category, isCategory: true, disabled: true },
    ...channels
  ]);

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
            <div className="bg-pink-500/10 p-3 rounded-xl">
              <FontAwesomeIcon icon={faSmile} className="h-6 w-6 text-pink-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">Auto Reactions</h2>
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
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500"></div>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <>
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
            <div className="bg-pink-500/10 p-3 rounded-xl">
              <FontAwesomeIcon icon={faSmile} className="h-6 w-6 text-pink-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">Auto Reactions</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{reactions.length} reactions</span>
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

            <div className="flex justify-end mb-6">
              <motion.button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:from-pink-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                <span>Add Reaction</span>
              </motion.button>
            </div>

            <div className="space-y-4">
              {reactions.length === 0 ? (
                <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
                  <p className="text-sm text-gray-500 text-center">No auto reactions configured</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reactions.map((reaction) => (
                    <motion.div
                      key={reaction._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group bg-gray-800/30 border border-gray-700/30 rounded-xl overflow-hidden hover:bg-gray-800/50 transition-colors duration-200"
                    >
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-pink-500/10 p-2 rounded-lg">
                            {renderEmoji(reaction.emoji)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-200">{reaction.keyword}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {reaction.whitelistRoles.length > 0 && (
                                <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded">
                                  {reaction.whitelistRoles.length} role{reaction.whitelistRoles.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {reaction.whitelistChannels.length > 0 && (
                                <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded">
                                  {reaction.whitelistChannels.length} channel{reaction.whitelistChannels.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <motion.button
                          onClick={() => handleRemoveReaction(reaction.id)}
                          className="text-red-400 hover:text-red-300 focus:outline-none focus:text-red-300 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Add Reaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setShowAddModal(false)}
          />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-800/50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-gray-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-pink-500/10 p-2 rounded-lg">
                        <FontAwesomeIcon icon={faSmile} className="w-4 h-4 text-pink-500" />
                      </div>
                      <h3 className="text-lg font-medium text-white">Add Auto Reaction</h3>
                    </div>
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="text-gray-400 hover:text-gray-300 transition-colors duration-200"
                    >
                      <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleAddReaction} className="p-6 space-y-6">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Keyword
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={newReaction.keyword}
                      onChange={(e) => setNewReaction({ ...newReaction, keyword: e.target.value })}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      placeholder="Message that triggers this reaction"
                      required
                    />
                    <p className="text-xs text-gray-500">
                      The bot will react when this word or phrase appears in a message
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Emoji
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <select
                      value={newReaction.emoji}
                      onChange={(e) => setNewReaction({ ...newReaction, emoji: e.target.value })}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select an emoji</option>
                      {allEmojiOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Whitelist Roles</label>
                    <select
                      multiple
                      value={newReaction.whitelistRoles}
                      onChange={(e) => setNewReaction({
                        ...newReaction,
                        whitelistRoles: Array.from(e.target.selectedOptions, option => option.value)
                      })}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      size={4}
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500">
                      Hold Ctrl/Cmd to select multiple roles. Leave empty to allow all roles.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Whitelist Channels</label>
                    <select
                      multiple
                      value={newReaction.whitelistChannels}
                      onChange={(e) => setNewReaction({
                        ...newReaction,
                        whitelistChannels: Array.from(e.target.selectedOptions, option => option.value)
                      })}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      size={4}
                    >
                      {Object.entries(groupedChannelOptions).map(([category, channels]) => (
                        <optgroup key={category} label={category}>
                          {channels.map((channel) => (
                            <option key={channel.value} value={channel.value}>
                              {channel.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500">
                      Hold Ctrl/Cmd to select multiple channels. Leave empty to allow all channels.
                    </p>
                  </div>

                  {/* Modal Actions */}
                  <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-800/50">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-300 focus:outline-none transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <motion.button
                      type="submit"
                      className="bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:from-pink-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 flex items-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                      <span>Add Reaction</span>
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AutoReactSettings; 