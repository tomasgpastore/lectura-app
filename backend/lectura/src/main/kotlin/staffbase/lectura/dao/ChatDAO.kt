package staffbase.lectura.dao

import staffbase.lectura.ai.chat.ChatMessage

interface ChatDAO {
    fun addMessage(userId: String, courseId: String, userMessage: ChatMessage, assistantMessage: ChatMessage)
    fun getLastMessages(userId: String, courseId: String, limit: Int = 100): List<ChatMessage>
    fun deleteAll(userId: String, courseId: String)
}