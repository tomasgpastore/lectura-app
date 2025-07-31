package staffbase.lectura.infrastructure.database.mongo.chat

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.context.annotation.Profile
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.ai.chat.ChatTurn
import staffbase.lectura.dao.ChatDAO
import java.util.concurrent.TimeUnit

@Component
@Profile("remote")
class ChatMongoDAO(
    private val redisTemplate: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
    private val chatRepo: ChatMongoRepository
) : ChatDAO {

    private val CACHE_TTL_HOURS = 1L // Define TTL as a constant

    private fun key(userId: String, courseId: String): String =
        "user:$userId:course$courseId:chat"

    override fun addMessage(userId: String, courseId: String, chatTurn: ChatTurn) {
        val redisKey = key(userId, courseId)

        // Create ChatTurn with userId and courseId
        val userMessageJson = objectMapper.writeValueAsString(chatTurn.userMessage)
        val assistantMessageJson = objectMapper.writeValueAsString(chatTurn.assistantMessage)

        // Store messages in Redis (store individual messages, not the full turn)
        // Use rightPush to maintain chronological order (oldest at end, newest at beginning)
        redisTemplate.opsForList().leftPush(redisKey, userMessageJson)
        redisTemplate.opsForList().leftPush(redisKey, assistantMessageJson)
        redisTemplate.opsForList().trim(redisKey, 0, 199) // Keep only the last 200 messages (100 turns)

        redisTemplate.expire(redisKey, CACHE_TTL_HOURS, TimeUnit.HOURS)

        // Save the chat turn in MongoDB
        chatRepo.save(chatTurn)
    }

    override fun getLastMessages(userId: String, courseId: String, limit: Int): List<ChatMessage> {
        val redisKey = key(userId, courseId)
        // Get messages from the end of the list (most recent messages)
        val jsonList = redisTemplate.opsForList().range(redisKey, -limit.toLong(), -1)

        return if (!jsonList.isNullOrEmpty()) {
            // Return messages from Redis cache
            jsonList.mapNotNull {
                try {
                    objectMapper.readValue(it, ChatMessage::class.java)
                } catch (_: Exception) {
                    null // Skip malformed JSON
                }
            }
        } else {
            // If Redis is empty, fetch from MongoDB and populate cache
            val allChatTurns = chatRepo.findByUserIdAndCourseId(userId, courseId)
                .sortedBy { it.timestamp }.reversed() // Sort ascending (oldest first)
            
            // Populate Redis with all messages in chronological order
            if (allChatTurns.isNotEmpty()) {
                allChatTurns.forEach { turn ->
                    val userMessageJson = objectMapper.writeValueAsString(turn.userMessage)
                    val assistantMessageJson = objectMapper.writeValueAsString(turn.assistantMessage)
                    redisTemplate.opsForList().rightPush(redisKey, assistantMessageJson)
                    redisTemplate.opsForList().rightPush(redisKey, userMessageJson)
                }
                redisTemplate.expire(redisKey, CACHE_TTL_HOURS, TimeUnit.HOURS)
                
                // Trim to keep only the last 200 messages
                val totalMessages = allChatTurns.size * 2
                if (totalMessages > 200) {
                    redisTemplate.opsForList().trim(redisKey, (totalMessages - 200).toLong(), -1)
                }
            }
            // Now get the requested messages from Redis
            val jsonList = redisTemplate.opsForList().range(redisKey, -limit.toLong(), -1)
            jsonList?.mapNotNull {
                try {
                    objectMapper.readValue(it, ChatMessage::class.java)
                } catch (_: Exception) {
                    null // Skip malformed JSON
                }
            } ?: emptyList()
        }
    }

    override fun deleteAll(userId: String, courseId: String) {
        redisTemplate.delete(key(userId, courseId))
        // Also delete from MongoDB
        val chatTurns = chatRepo.findByUserIdAndCourseId(userId, courseId)
        chatRepo.deleteAll(chatTurns)
    }
}