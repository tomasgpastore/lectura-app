package staffbase.lectura.infrastructure.database.local

import org.springframework.context.annotation.Profile
import org.springframework.expression.spel.ast.Assign
import org.springframework.stereotype.Component
import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.dao.ChatDAO
import java.util.concurrent.ConcurrentHashMap

@Component
@Profile("local")
class ChatInMemoryDAO : ChatDAO {

    private fun key(userId: String, courseId: String): String =
        "chat:$userId:$courseId"

    override fun addMessage(userId: String, courseId: String, userMessage: ChatMessage, assistantMessage: ChatMessage) {
        val storageKey = key(userId, courseId)
        val messages = DataStore.messages.computeIfAbsent(storageKey) { mutableListOf() }
        
        // Add message to the beginning (like Redis leftPush)
        messages.add(0, userMessage)
        messages.add(0, assistantMessage)
        
        // Keep only last 10 messages
        if (messages.size > 10) {
            messages.removeAt(messages.size - 1)
            messages.removeAt(messages.size - 1)
        }
    }

    override fun getLastMessages(userId: String, courseId: String, limit: Int): List<ChatMessage> {
        val storageKey = key(userId, courseId)
        val messages = DataStore.messages[storageKey] ?: return emptyList()
        return messages.take(limit)
    }

    override fun deleteAll(userId: String, courseId: String) {
        DataStore.messages.remove(key(userId, courseId))
    }
} 