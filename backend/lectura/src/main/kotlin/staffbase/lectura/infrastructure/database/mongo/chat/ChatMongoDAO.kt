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
        redisTemplate.opsForList().leftPush(redisKey, userMessageJson)
        redisTemplate.opsForList().leftPush(redisKey, assistantMessageJson)
        redisTemplate.opsForList().trim(redisKey, 0, 199) // Keep only the last 200 messages (100 turns)

        redisTemplate.expire(redisKey, CACHE_TTL_HOURS, TimeUnit.HOURS)

        // Save the chat turn in MongoDB
        chatRepo.save(chatTurn)
    }

    override fun getLastMessages(userId: String, courseId: String, limit: Int): List<ChatMessage> {
        val redisKey = key(userId, courseId)
        val jsonList = redisTemplate.opsForList().range(redisKey, 0, limit.toLong() - 1)

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
            val chatTurns = chatRepo.findByUserIdAndCourseId(userId, courseId)
                .sortedByDescending { it.timestamp }
                .take(limit / 2) // Since each turn has 2 messages

            val messages = chatTurns.flatMap { it.toChatMessages() }
                .take(limit)

            // Populate Redis cache with the messages from MongoDB
            if (messages.isNotEmpty()) {
                val messagesToCache = messages.reversed() // Reverse to maintain correct order in Redis
                messagesToCache.forEach { message ->
                    val messageJson = objectMapper.writeValueAsString(message)
                    redisTemplate.opsForList().rightPush(redisKey, messageJson)
                }
                redisTemplate.expire(redisKey, CACHE_TTL_HOURS, TimeUnit.HOURS)
            }

            messages
        }
    }

    override fun deleteAll(userId: String, courseId: String) {
        redisTemplate.delete(key(userId, courseId))
        // Also delete from MongoDB
        val chatTurns = chatRepo.findByUserIdAndCourseId(userId, courseId)
        chatRepo.deleteAll(chatTurns)
    }
}