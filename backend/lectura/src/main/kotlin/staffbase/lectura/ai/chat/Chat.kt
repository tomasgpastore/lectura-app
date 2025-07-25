package staffbase.lectura.ai.chat

import org.springframework.data.mongodb.core.mapping.Document
import staffbase.lectura.ai.Source
import java.time.Instant

@Document(collection = "chat")
data class ChatMessage(
    val role: String,
    val content: String,
    val sources : List<Source>? = null,
    val timestamp: Instant = Instant.now()
)