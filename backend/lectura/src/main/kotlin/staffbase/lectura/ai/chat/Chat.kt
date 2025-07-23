package staffbase.lectura.ai.chat

import staffbase.lectura.ai.Source
import java.time.LocalDateTime

data class ChatMessage(
    val role: String,
    val content: String,
    val sources : List<Source>? = null,
    val timestamp: LocalDateTime = LocalDateTime.now()
)