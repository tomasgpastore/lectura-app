package staffbase.lectura.ai.chat

import org.springframework.data.mongodb.core.mapping.Document
import staffbase.lectura.dto.ai.RagSource
import staffbase.lectura.dto.ai.WebSource
import java.time.Instant

@Document(collection = "chat")
data class ChatMessage(
    val role: String,
    val content: String,
    val ragSources: List<RagSource> = emptyList(),
    val webSources: List<WebSource> = emptyList(),
    val timestamp: Instant = Instant.now()
)

data class MessageSources(
    val ragSources: List<RagSource> = emptyList(),
    val webSources: List<WebSource> = emptyList()
)