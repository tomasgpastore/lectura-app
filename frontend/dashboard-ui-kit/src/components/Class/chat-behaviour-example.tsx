import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';

const Chatbot = () => {
  const [conversationGroups, setConversationGroups] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypingText, setCurrentTypingText] = useState('');
  const [containerHeight, setContainerHeight] = useState(0);
  
  const messagesContainerRef = useRef(null);
  const activeGroupRef = useRef(null);

  // Simular respuesta del bot
  const simulateBotResponse = useCallback(() => {
    const botResponses = [
      "Esta es una respuesta corta del bot.",
      "Esta es una respuesta un poco más larga que demuestra cómo funciona el scroll automático cuando el contenido empieza a crecer dentro del grupo.",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Esta es una respuesta muy larga que definitivamente hará que el grupo necesite scroll interno.",
      "Aquí hay otra respuesta. ".repeat(50) + "Este texto se repite muchas veces para demostrar el scroll.",
    ];
    
    return botResponses[Math.floor(Math.random() * botResponses.length)];
  }, []);

  // Efecto máquina de escribir
  const typewriterEffect = useCallback((text, groupId, callback) => {
    let index = 0;
    setCurrentTypingText('');
    setIsTyping(true);
    
    const interval = setInterval(() => {
      if (index < text.length) {
        setCurrentTypingText((prev) => prev + text[index]);
        index++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
        callback(text);
      }
    }, 30);
    
    return () => clearInterval(interval);
  }, []);

  // Actualizar altura del contenedor
  useEffect(() => {
    const updateHeight = () => {
      if (messagesContainerRef.current) {
        setContainerHeight(messagesContainerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Scroll al grupo activo cuando se crea uno nuevo
  useEffect(() => {
    if (activeGroupRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const activeGroup = activeGroupRef.current;
      
      // Scroll suave al nuevo grupo
      activeGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [conversationGroups.length]);

  // Auto-scroll mientras se escribe en el último grupo
  useEffect(() => {
    if (isTyping && activeGroupRef.current) {
      const groupContent = activeGroupRef.current.querySelector('.group-content');
      if (groupContent && groupContent.scrollHeight > activeGroupRef.current.clientHeight) {
        groupContent.scrollTop = groupContent.scrollHeight;
      }
    }
  }, [currentTypingText, isTyping]);

  // Manejar el envío de mensajes
  const handleSendMessage = useCallback(() => {
    if (inputValue.trim() === '' || isTyping) return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const groupId = Date.now();
    
    // Crear nuevo grupo con la pregunta del usuario
    const newGroup = {
      id: groupId,
      userMessage: {
        text: inputValue,
        timestamp: timestamp
      },
      botMessage: null,
      isActive: true
    };
    
    // Marcar todos los grupos anteriores como inactivos
    setConversationGroups(prev => [
      ...prev.map(group => ({ ...group, isActive: false })),
      newGroup
    ]);
    setInputValue('');
    
    // Simular respuesta del bot
    setTimeout(() => {
      const botResponse = simulateBotResponse();
      typewriterEffect(botResponse, groupId, (fullText) => {
        setConversationGroups(prev => 
          prev.map(group => 
            group.id === groupId 
              ? { 
                  ...group, 
                  botMessage: {
                    text: fullText,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                }
              : group
          )
        );
        setCurrentTypingText('');
      });
    }, 500);
  }, [inputValue, isTyping, simulateBotResponse, typewriterEffect]);

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg flex flex-col h-full">
        {/* Header */}
        <div className="bg-blue-500 text-white p-4 rounded-t-lg">
          <h2 className="text-xl font-semibold">Chatbot con Grupos de Conversación</h2>
          <p className="text-sm opacity-90">
            {conversationGroups.length} grupo{conversationGroups.length !== 1 ? 's' : ''} de conversación
          </p>
        </div>
        
        {/* Contenedor de grupos */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto"
        >
          {conversationGroups.map((group, index) => {
            const isLastGroup = index === conversationGroups.length - 1;
            
            return (
              <div
                key={group.id}
                ref={isLastGroup ? activeGroupRef : null}
                className={`conversation-group relative ${isLastGroup ? 'overflow-hidden' : ''}`}
                style={{ 
                  minHeight: isLastGroup ? `${containerHeight}px` : 'auto',
                  height: isLastGroup ? `${containerHeight}px` : 'auto'
                }}
              >
                <div 
                  className={`group-content flex flex-col p-4 space-y-4 ${
                    isLastGroup ? 'h-full overflow-y-auto' : ''
                  }`}
                >
                  {/* Mensaje del usuario */}
                  <div className="flex justify-end">
                    <div className="max-w-[70%] bg-blue-500 text-white rounded-lg p-3">
                      <p className="whitespace-pre-wrap">{group.userMessage.text}</p>
                      <p className="text-xs mt-1 opacity-70">{group.userMessage.timestamp}</p>
                    </div>
                  </div>
                  
                  {/* Mensaje del bot */}
                  {group.botMessage && (
                    <div className="flex justify-start">
                      <div className="max-w-[70%] bg-gray-200 text-gray-800 rounded-lg p-3">
                        <p className="whitespace-pre-wrap">{group.botMessage.text}</p>
                        <p className="text-xs mt-1 opacity-70">{group.botMessage.timestamp}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Mensaje en proceso de escritura */}
                  {isLastGroup && isTyping && currentTypingText && (
                    <div className="flex justify-start">
                      <div className="max-w-[70%] bg-gray-200 text-gray-800 rounded-lg p-3">
                        <p className="whitespace-pre-wrap">{currentTypingText}</p>
                        <span className="inline-block w-2 h-4 bg-gray-600 animate-pulse ml-1" />
                      </div>
                    </div>
                  )}
                  
                  {/* Indicador de escritura */}
                  {isLastGroup && isTyping && !currentTypingText && (
                    <div className="flex justify-start">
                      <div className="bg-gray-200 rounded-lg p-3">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Separador entre grupos (solo para grupos anteriores) */}
                {!isLastGroup && (
                  <div className="border-b border-gray-200 mx-4"></div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Escribe tu mensaje..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isTyping}
            />
            <button
              onClick={handleSendMessage}
              disabled={isTyping || inputValue.trim() === ''}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;