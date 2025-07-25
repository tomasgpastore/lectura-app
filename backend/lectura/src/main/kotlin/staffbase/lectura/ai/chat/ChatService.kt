package staffbase.lectura.ai.chat

import org.springframework.stereotype.Service
import staffbase.lectura.dao.ChatDAO

@Service
class ChatService(
    private val chatDAO: ChatDAO
) {
    fun addMessage(userId: String, courseId: String, chatTurn: ChatTurn) {
        chatDAO.addMessage(userId, courseId, chatTurn)
    }

    fun getMessages(userId: String, courseId: String): List<ChatMessage> {
        return chatDAO.getLastMessages(userId, courseId)
    }

    fun clearChat(userId: String, courseId: String) {
        chatDAO.deleteAll(userId, courseId)
    }
}
