import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faChevronDown, faPlus, faCode, faFont, faSave, faTimes } from '@fortawesome/free-solid-svg-icons';

function AutoResponseSettings() {
  const [responses, setResponses] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [responseType, setResponseType] = useState('text');
  const [currentResponse, setCurrentResponse] = useState({
    trigger: '',
    type: 'text',
    content: '',
    embed: {
      title: '',
      description: '',
      color: '#5865F2',
      author: {
        name: '',
        icon_url: ''
      },
      footer: {
        text: '',
        icon_url: ''
      },
      thumbnail: '',
      image: '',
      timestamp: false
    }
  });

  useEffect(() => {
  }, [responseType, currentResponse]);

  useEffect(() => {
    fetchResponses();
  }, []);

  useEffect(() => {
    if (currentResponse.type !== responseType) {
      console.log('Syncing responseType with currentResponse.type');
      setResponseType(currentResponse.type);
    }
  }, [currentResponse.type]);

  const fetchResponses = async () => {
    try {
      const response = await axios.get('/api/settings/auto-responses');
      setResponses(response.data || []);
    } catch (err) {
      setError('Failed to fetch auto responses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isDuplicate = responses.some(response => 
      response.trigger.toLowerCase() === currentResponse.trigger.toLowerCase() &&
      (!isEditing || response._id !== currentResponse._id)
    );

    if (isDuplicate) {
      setError('A response with this trigger already exists');
      return;
    }

    try {
      const cleanEmbed = {
        title: currentResponse.embed.title?.trim() || '',
        description: currentResponse.embed.description?.trim() || '',
        color: currentResponse.embed.color || '#5865F2',
        fields: currentResponse.embed.fields || []
      };
      
      if (currentResponse.embed.author?.name?.trim()) {
        cleanEmbed.author = {
          name: currentResponse.embed.author.name.trim(),
          icon_url: currentResponse.embed.author.icon_url?.trim() || null
        };
      }

      if (currentResponse.embed.footer?.text?.trim()) {
        cleanEmbed.footer = {
          text: currentResponse.embed.footer.text.trim(),
          icon_url: currentResponse.embed.footer.icon_url?.trim() || null
        };
      }

      if (currentResponse.embed.thumbnail?.trim()) {
        cleanEmbed.thumbnail = { url: currentResponse.embed.thumbnail.trim() };
      }
      if (currentResponse.embed.image?.trim()) {
        cleanEmbed.image = { url: currentResponse.embed.image.trim() };
      }

      if (currentResponse.embed.timestamp) {
        cleanEmbed.timestamp = true;
      }

      const responseData = {
        trigger: currentResponse.trigger.trim(),
        type: responseType,
        responseType: responseType.toUpperCase(),
        ...(responseType === 'text' ? { 
          content: currentResponse.content?.trim() || ''
        } : { 
          embed: cleanEmbed 
        })
      };

      console.log('Saving response data:', JSON.stringify(responseData, null, 2));

      if (isEditing) {
        await axios.put(`/api/settings/auto-responses/${currentResponse._id}`, responseData);
      } else {
        await axios.post('/api/settings/auto-responses', responseData);
      }

      setShowModal(false);
      resetForm();
      setError('');
      fetchResponses();
    } catch (err) {
      console.error('Error saving response:', err.response?.data || err);
      setError(`Failed to ${isEditing ? 'edit' : 'add'} auto response: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleRemoveResponse = async (responseId) => {
    if (!window.confirm('Are you sure you want to remove this auto response?')) {
      return;
    }

    try {
      setLoading(true);
      
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='))
        ?.split('=')[1];

      if (!csrfToken) {
        throw new Error('CSRF token not found');
      }

      await axios.delete(`/api/settings/auto-responses/${responseId}`, {
        headers: {
          'X-XSRF-TOKEN': csrfToken
        }
      });

      setResponses(responses.filter(response => response._id !== responseId));
      setError('');
    } catch (error) {
      console.error('Error removing auto response:', error);
      const errorMessage = error.response?.data?.error || 'Failed to remove auto response';
      setError(errorMessage);
      
      if (error.response?.status === 403) {
        setError('You do not have permission to remove auto responses');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentResponse({
      trigger: '',
      type: 'text',
      content: '',
      embed: {
        title: '',
        description: '',
        color: '#5865F2',
        author: {
          name: '',
          icon_url: ''
        },
        footer: {
          text: '',
          icon_url: ''
        },
        thumbnail: '',
        image: '',
        timestamp: false
      }
    });
    setResponseType('text');
    setIsEditing(false);
  };

  const startEdit = (response) => {
    console.log('Starting edit with response (full object):', JSON.stringify(response, null, 2));
    
    const type = response.type === 'embed' || response.responseType === 'EMBED' ? 'embed' : 'text';
    console.log('Setting type to:', type);
    
    const formattedResponse = {
        _id: response._id,
        trigger: response.trigger,
        type: type,
        content: response.content || '',
        embed: response.embed ? {
            title: response.embed.title || '',
            description: response.embed.description || '',
            color: response.embed.color || '#5865F2',
            author: {
                name: response.embed.author?.name || '',
                icon_url: response.embed.author?.icon_url || ''
            },
            footer: {
                text: response.embed.footer?.text || '',
                icon_url: response.embed.footer?.icon_url || ''
            },
            thumbnail: response.embed.thumbnail?.url || '',
            image: response.embed.image?.url || '',
            timestamp: response.embed.timestamp || false,
            fields: response.embed.fields || []
        } : {
            title: '',
            description: '',
            color: '#5865F2',
            author: { name: '', icon_url: '' },
            footer: { text: '', icon_url: '' },
            thumbnail: '',
            image: '',
            timestamp: false,
            fields: []
        }
    };

    console.log('Setting formatted response:', JSON.stringify(formattedResponse, null, 2));
    
    setResponseType(type);
    setCurrentResponse(formattedResponse);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleAddNew = () => {
    resetForm();
    setShowModal(true);
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
            <div className="bg-orange-500/10 p-3 rounded-xl">
              <FontAwesomeIcon icon={faRobot} className="h-6 w-6 text-orange-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">Auto Responses</h2>
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
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
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
            <div className="bg-orange-500/10 p-3 rounded-xl">
              <FontAwesomeIcon icon={faRobot} className="h-6 w-6 text-orange-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">Auto Responses</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{responses.length} responses</span>
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
                onClick={handleAddNew}
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                <span>Add Response</span>
              </motion.button>
            </div>

            <div className="space-y-4">
              {responses.length === 0 ? (
                <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
                  <p className="text-sm text-gray-500 text-center">No auto responses configured</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {responses.map((response) => (
                    <motion.div 
                      key={response._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group bg-gray-800/30 border border-gray-700/30 rounded-xl overflow-hidden hover:bg-gray-800/50 transition-colors duration-200"
                    >
                      <div className="p-4 flex items-center justify-between border-b border-gray-700/30">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${response.type === 'text' ? 'bg-blue-500/10' : 'bg-purple-500/10'}`}>
                            <FontAwesomeIcon 
                              icon={response.type === 'text' ? faFont : faCode} 
                              className={`w-4 h-4 ${response.type === 'text' ? 'text-blue-400' : 'text-purple-400'}`}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-200">{response.trigger}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <motion.button
                            onClick={() => startEdit(response)}
                            className="text-blue-400 hover:text-blue-300 focus:outline-none focus:text-blue-300 transition-colors duration-200 text-sm opacity-0 group-hover:opacity-100"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Edit
                          </motion.button>
                          <motion.button
                            onClick={() => handleRemoveResponse(response._id)}
                            className="text-red-400 hover:text-red-300 focus:outline-none focus:text-red-300 transition-colors duration-200 text-sm opacity-0 group-hover:opacity-100"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Remove
                          </motion.button>
                        </div>
                      </div>
                      <div className="p-4">
                        {response.type === 'text' ? (
                          <p className="text-sm text-gray-300">{response.content}</p>
                        ) : (
                          <div className="space-y-3">
                            {response.embed.title && (
                              <p className="text-sm font-medium text-gray-200">{response.embed.title}</p>
                            )}
                            {response.embed.description && (
                              <p className="text-sm text-gray-300">{response.embed.description}</p>
                            )}
                            {response.embed.fields?.map((field, index) => (
                              <div key={index} className="pl-3 border-l-2 border-gray-700/50 mt-2">
                                <p className="text-sm font-medium text-gray-200">{field.name}</p>
                                <p className="text-sm text-gray-300">{field.value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setShowModal(false)}
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
                      <div className="bg-orange-500/10 p-2 rounded-lg">
                        <FontAwesomeIcon icon={faRobot} className="w-4 h-4 text-orange-500" />
                      </div>
                      <h3 className="text-lg font-medium text-white">
                        {isEditing ? 'Edit Auto Response' : 'Add Auto Response'}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        resetForm();
                      }}
                      className="text-gray-400 hover:text-gray-300 transition-colors duration-200"
                    >
                      <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Trigger
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={currentResponse.trigger}
                      onChange={(e) => setCurrentResponse({ ...currentResponse, trigger: e.target.value })}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Message that triggers this response"
                      required
                    />
                    <p className="text-xs text-gray-500">
                      The bot will respond when this word or phrase appears in a message
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setResponseType('text')}
                      className={`flex-1 p-3 rounded-xl border ${
                        responseType === 'text'
                          ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                          : 'border-gray-700 hover:border-gray-600 text-gray-400'
                      } transition-colors duration-200 focus:outline-none`}
                    >
                      <FontAwesomeIcon icon={faFont} className="w-4 h-4 mb-2" />
                      <p className="text-sm font-medium">Text Response</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setResponseType('embed')}
                      className={`flex-1 p-3 rounded-xl border ${
                        responseType === 'embed'
                          ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                          : 'border-gray-700 hover:border-gray-600 text-gray-400'
                      } transition-colors duration-200 focus:outline-none`}
                    >
                      <FontAwesomeIcon icon={faCode} className="w-4 h-4 mb-2" />
                      <p className="text-sm font-medium">Embed Response</p>
                    </button>
                  </div>

                  {responseType === 'text' ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Response Message
                        <span className="text-red-400 ml-1">*</span>
                      </label>
                      <textarea
                        value={currentResponse.content}
                        onChange={(e) => setCurrentResponse({ ...currentResponse, content: e.target.value })}
                        className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Enter your response message"
                        rows={4}
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-300">Title</label>
                          <input
                            type="text"
                            value={currentResponse.embed.title}
                            onChange={(e) => setCurrentResponse({
                              ...currentResponse,
                              embed: { ...currentResponse.embed, title: e.target.value }
                            })}
                            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="Embed title"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-300">Color</label>
                          <input
                            type="color"
                            value={currentResponse.embed.color}
                            onChange={(e) => setCurrentResponse({
                              ...currentResponse,
                              embed: { ...currentResponse.embed, color: e.target.value }
                            })}
                            className="w-full h-[38px] bg-gray-800/50 border border-gray-700/50 rounded-xl px-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">Description</label>
                        <textarea
                          value={currentResponse.embed.description}
                          onChange={(e) => setCurrentResponse({
                            ...currentResponse,
                            embed: { ...currentResponse.embed, description: e.target.value }
                          })}
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Embed description"
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-300">Author Name</label>
                          <input
                            type="text"
                            value={currentResponse.embed.author.name}
                            onChange={(e) => setCurrentResponse({
                              ...currentResponse,
                              embed: {
                                ...currentResponse.embed,
                                author: { ...currentResponse.embed.author, name: e.target.value }
                              }
                            })}
                            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="Author name"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-300">Author Icon URL</label>
                          <input
                            type="text"
                            value={currentResponse.embed.author.icon_url}
                            onChange={(e) => setCurrentResponse({
                              ...currentResponse,
                              embed: {
                                ...currentResponse.embed,
                                author: { ...currentResponse.embed.author, icon_url: e.target.value }
                              }
                            })}
                            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="https://example.com/icon.png"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-300">Footer Text</label>
                          <input
                            type="text"
                            value={currentResponse.embed.footer.text}
                            onChange={(e) => setCurrentResponse({
                              ...currentResponse,
                              embed: {
                                ...currentResponse.embed,
                                footer: { ...currentResponse.embed.footer, text: e.target.value }
                              }
                            })}
                            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="Footer text"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-300">Footer Icon URL</label>
                          <input
                            type="text"
                            value={currentResponse.embed.footer.icon_url}
                            onChange={(e) => setCurrentResponse({
                              ...currentResponse,
                              embed: {
                                ...currentResponse.embed,
                                footer: { ...currentResponse.embed.footer, icon_url: e.target.value }
                              }
                            })}
                            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="https://example.com/icon.png"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-300">Thumbnail URL</label>
                          <input
                            type="url"
                            value={currentResponse.embed.thumbnail}
                            onChange={(e) => setCurrentResponse({
                              ...currentResponse,
                              embed: { ...currentResponse.embed, thumbnail: e.target.value }
                            })}
                            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="https://example.com/thumbnail.png"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-300">Image URL</label>
                          <input
                            type="url"
                            value={currentResponse.embed.image}
                            onChange={(e) => setCurrentResponse({
                              ...currentResponse,
                              embed: { ...currentResponse.embed, image: e.target.value }
                            })}
                            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="https://example.com/image.png"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={currentResponse.embed.timestamp}
                          onChange={(e) => setCurrentResponse({
                            ...currentResponse,
                            embed: { ...currentResponse.embed, timestamp: e.target.checked }
                          })}
                          className="rounded border-gray-700/50 bg-gray-800/50 text-orange-500 focus:ring-orange-500"
                        />
                        <label className="text-sm text-gray-300">Include timestamp</label>
                      </div>
                    </div>
                  )}

                  {/* Modal Actions */}
                  <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-800/50">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        resetForm();
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-300 focus:outline-none transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <motion.button
                      type="submit"
                      className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 flex items-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <FontAwesomeIcon icon={isEditing ? faSave : faPlus} className="w-4 h-4" />
                      <span>{isEditing ? 'Save Changes' : 'Add Response'}</span>
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

export default AutoResponseSettings; 