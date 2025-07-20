package staffbase.lectura.ai.chat

import java.time.LocalDateTime

data class ChatMessage(
    val role: String,
    val content: String,
    val timestamp: LocalDateTime = LocalDateTime.now()
)