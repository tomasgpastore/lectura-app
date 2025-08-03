package staffbase.lectura.infrastructure.database.mongo.chat

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty
import org.bson.types.ObjectId
import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.mapping.Document
import org.springframework.data.mongodb.core.mapping.Field

@Document(collection = "messages")
@JsonIgnoreProperties(ignoreUnknown = true)
data class AgentStateDocument(
    @Id
    val id: ObjectId? = null,
    @Field("thread_id")
    @JsonProperty("thread_id")
    val threadId: String,
    @Field("user_id") 
    @JsonProperty("user_id")
    val userId: String,
    @Field("course_id")
    @JsonProperty("course_id")
    val courseId: String,
    val messages: List<AgentMessage> = emptyList(),
    @Field("updated_at")
    @JsonProperty("updated_at")
    val updatedAt: String? = null,
    @Field("message_count")
    @JsonProperty("message_count")
    val messageCount: Int = 0
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class AgentMessage(
    val type: String, // "human", "ai", or "tool"
    val content: String,
    val id: String? = null, // Make id nullable since it might be missing
    val name: String? = null, // Tool name for tool messages
    @JsonProperty("rag_source_ids")
    val ragSourceIds: List<String>? = null, // References to tool messages with RAG sources
    @JsonProperty("web_source_ids")
    val webSourceIds: List<String>? = null, // References to tool messages with web sources
    @JsonProperty("image_source_ids")
    val imageSourceIds: List<String>? = null, // References to tool messages with image sources
    val sources: MessageSources? = null // Legacy: Sources embedded in AI messages
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class MessageSources(
    @JsonProperty("message_id")
    val messageId: String? = null,
    @JsonProperty("rag_sources")
    val ragSources: List<Map<String, Any>>? = null,
    @JsonProperty("web_sources")
    val webSources: List<Map<String, Any>>? = null,
    val timestamp: String? = null
)