package staffbase.lectura.infrastructure.database.mongo.chat

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.JsonNode
import org.springframework.context.annotation.Profile
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.ai.chat.ChatTurn
import staffbase.lectura.dao.ChatDAO
import staffbase.lectura.dto.ai.RagSource
import staffbase.lectura.dto.ai.WebSource
import java.util.concurrent.TimeUnit
import java.time.Instant

@Component
@Profile("remote")
class ChatMongoDAO(
    private val redisTemplate: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
    private val chatRepo: ChatMongoRepository,
    private val agentStateRepo: AgentStateRepository
) : ChatDAO {

    private val CACHE_TTL_HOURS = 1L // Define TTL as a constant

    private fun key(userId: String, courseId: String): String =
        "user:$userId:course$courseId:chat"

    override fun addMessage(userId: String, courseId: String, chatTurn: ChatTurn) {
        // No longer saving messages - AI service handles persistence
        // This method is kept for backward compatibility but does nothing
    }

    override fun getLastMessages(userId: String, courseId: String, limit: Int): List<ChatMessage> {
        val redisKey = "agent_state:$userId:$courseId"
        val sourcesKey = "agent_sources:$userId:$courseId"
        
        // Try to get from Redis first
        val cachedState = redisTemplate.opsForValue().get(redisKey)
        
        val messages = if (cachedState != null) {
            // Parse cached messages from Redis format (only contains messages array)
            try {
                val jsonNode = objectMapper.readTree(cachedState)
                val messagesNode = jsonNode.get("messages")
                if (messagesNode != null && messagesNode.isArray) {
                    val agentMessages = messagesNode.map { node ->
                        AgentMessage(
                            type = node.get("type").asText(),
                            content = node.get("content").asText(),
                            id = node.get("id")?.asText()
                        )
                    }
                    convertAgentMessagesToChatMessages(agentMessages, sourcesKey)
                } else {
                    println("No messages array found in Redis cache")
                    fetchFromMongoAndCache(userId, courseId, redisKey, sourcesKey)
                }
            } catch (e: Exception) {
                println("Error parsing cached messages: ${e.message}")
                fetchFromMongoAndCache(userId, courseId, redisKey, sourcesKey)
            }
        } else {
            // Fetch from MongoDB and cache
            fetchFromMongoAndCache(userId, courseId, redisKey, sourcesKey)
        }
        
        // Return the requested number of messages (newest first)
        return messages.take(limit)
    }
    
    private fun fetchFromMongoAndCache(
        userId: String, 
        courseId: String, 
        redisKey: String,
        sourcesKey: String
    ): List<ChatMessage> {
        val threadId = "$userId:$courseId"
        println("Fetching from MongoDB with threadId: $threadId")
        val agentState = agentStateRepo.findByThreadId(threadId)
        
        return if (agentState != null) {
            println("Found agent state with ${agentState.messages.size} messages")
            // Cache only the messages in Redis format
            try {
                val messagesOnly = mapOf("messages" to agentState.messages)
                val stateJson = objectMapper.writeValueAsString(messagesOnly)
                redisTemplate.opsForValue().set(redisKey, stateJson, 24, TimeUnit.HOURS)
            } catch (e: Exception) {
                println("Error caching agent state: ${e.message}")
            }
            
            convertAgentMessagesToChatMessages(agentState.messages, sourcesKey)
        } else {
            println("No agent state found for threadId: $threadId")
            emptyList()
        }
    }
    
    private fun convertAgentMessagesToChatMessages(
        agentMessages: List<AgentMessage>,
        sourcesKey: String
    ): List<ChatMessage> {
        // Filter for human and ai messages only (exclude "tool" messages)
        val relevantMessages = agentMessages.filter { it.type == "human" || it.type == "ai" }
        
        // Convert to ChatMessage format and attach sources
        return relevantMessages.map { msg ->
            val role = if (msg.type == "human") "user" else "assistant"
            
            // Get sources for assistant messages
            val (ragSources, webSources) = if (role == "assistant" && msg.id != null) {
                getSourcesForMessage(sourcesKey, msg.id)
            } else {
                Pair(emptyList(), emptyList())
            }
            
            ChatMessage(
                role = role,
                content = msg.content,
                ragSources = ragSources,
                webSources = webSources,
                timestamp = Instant.now() // Use current time as messages don't have timestamps
            )
        }.reversed() // Reverse to get newest first
    }
    
    private fun getSourcesForMessage(
        sourcesKey: String,
        messageId: String
    ): Pair<List<RagSource>, List<WebSource>> {
        try {
            val sourcesJson = redisTemplate.opsForHash<String, String>().get(sourcesKey, messageId)
            if (sourcesJson != null) {
                val sourcesMap = objectMapper.readValue(sourcesJson, Map::class.java)
                
                val ragSources = (sourcesMap["rag_sources"] as? List<Map<String, Any>>)?.map { src ->
                    RagSource(
                        id = src["id"]?.toString() ?: "",
                        slide = src["slide"]?.toString() ?: "",
                        s3file = src["s3file"]?.toString() ?: "",
                        start = src["start"]?.toString() ?: "",
                        end = src["end"]?.toString() ?: "",
                        text = src["text"]?.toString() ?: ""
                    )
                } ?: emptyList()
                
                val webSources = (sourcesMap["web_sources"] as? List<Map<String, Any>>)?.map { src ->
                    WebSource(
                        id = src["id"]?.toString() ?: "",
                        title = src["title"]?.toString() ?: "",
                        url = src["url"]?.toString() ?: "",
                        text = src["text"]?.toString() ?: ""
                    )
                } ?: emptyList()
                
                return Pair(ragSources, webSources)
            }
        } catch (e: Exception) {
            println("Error getting sources for message $messageId: ${e.message}")
        }
        
        return Pair(emptyList(), emptyList())
    }

    override fun deleteAll(userId: String, courseId: String) {
        // Delete Redis caches
        redisTemplate.delete("agent_state:$userId:$courseId")
        redisTemplate.delete("agent_sources:$userId:$courseId")
        redisTemplate.delete("agent_images:$userId:$courseId")
        
        // Delete from MongoDB
        val threadId = "$userId:$courseId"
        try {
            val agentState = agentStateRepo.findByThreadId(threadId)
            if (agentState != null) {
                agentStateRepo.delete(agentState)
                println("Deleted agent state from MongoDB for threadId: $threadId")
            } else {
                println("No agent state found in MongoDB for threadId: $threadId")
            }
        } catch (e: Exception) {
            println("Error deleting from MongoDB: ${e.message}")
        }
    }
}