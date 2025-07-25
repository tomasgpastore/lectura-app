package staffbase.lectura.infrastructure.database.mongo.chat

import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.ai.chat.ChatTurn

fun ChatTurn.toChatMessages(): List<ChatMessage> {
    return listOf(this.userMessage, this.assistantMessage)
}
