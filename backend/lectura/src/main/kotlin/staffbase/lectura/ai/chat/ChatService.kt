package staffbase.lectura.ai.chat

import org.springframework.stereotype.Service
import staffbase.lectura.dao.ChatDAO

@Service
class ChatService(
    private val chatDAO: ChatDAO
) {
    fun addMessage(userId: String, courseId: String, userMessage: ChatMessage, assistantMessage: ChatMessage) {
        chatDAO.addMessage(userId, courseId, userMessage, assistantMessage)
    }

    fun getLast10(userId: String, courseId: String): List<ChatMessage> {
        return chatDAO.getLastMessages(userId, courseId)
    }

    fun clearChat(userId: String, courseId: String) {
        chatDAO.deleteAll(userId, courseId)
    }
}
