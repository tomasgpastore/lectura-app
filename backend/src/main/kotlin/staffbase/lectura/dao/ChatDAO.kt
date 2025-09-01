package staffbase.lectura.dao

import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.ai.chat.ChatTurn

interface ChatDAO {
    fun addMessage(userId: String, courseId: String, chatTurn: ChatTurn)
    fun getLastMessages(userId: String, courseId: String, limit: Int = 100): List<ChatMessage>
    fun deleteAll(userId: String, courseId: String)
}