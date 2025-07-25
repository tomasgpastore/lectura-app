package staffbase.lectura.infrastructure.database.local

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.ai.chat.ChatTurn
import staffbase.lectura.dao.ChatDAO
import java.util.concurrent.ConcurrentHashMap

@Component
@Profile("local")
class ChatInMemoryDAO : ChatDAO {

    private fun key(userId: String, courseId: String): String =
        "chat:$userId:$courseId"

    override fun addMessage(userId: String, courseId: String, chatTurn: ChatTurn) {
        val storageKey = key(userId, courseId)
        val messages = DataStore.messages.computeIfAbsent(storageKey) { mutableListOf() }
        
        // Add messages to the beginning (like Redis leftPush)
        // Add assistant message first, then user message (to maintain correct order)
        messages.add(0, chatTurn.assistantMessage)
        messages.add(0, chatTurn.userMessage)

        // Keep only last 200 messages (consistent with MongoDB implementation)
        while (messages.size > 200) {
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
