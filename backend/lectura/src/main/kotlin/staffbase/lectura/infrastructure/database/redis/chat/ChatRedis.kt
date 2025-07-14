package staffbase.lectura.infrastructure.database.redis.chat

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.context.annotation.Profile
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.dao.ChatDAO

@Component
@Profile("remote")
class ChatRedis(
    private val redisTemplate: StringRedisTemplate,
    private val objectMapper: ObjectMapper
) : ChatDAO {

    private fun key(userId: String, courseId: String): String =
        "chat:course_$courseId:user_$userId"

    override fun addMessage(userId: String, courseId: String, userMessage: ChatMessage, assistantMessage: ChatMessage) {
        val redisKey = key(userId, courseId)

        val userJson = objectMapper.writeValueAsString(userMessage)
        redisTemplate.opsForList().leftPush(redisKey, userJson)

        val assistantJson = objectMapper.writeValueAsString(assistantMessage)
        redisTemplate.opsForList().leftPush(redisKey, assistantJson)

        redisTemplate.opsForList().trim(redisKey, 0, 9) // keep last 10
    }

    override fun getLastMessages(userId: String, courseId: String, limit: Int): List<ChatMessage> {
        val redisKey = key(userId, courseId)
        val jsonList = redisTemplate.opsForList().range(redisKey, 0, limit.toLong() - 1)
        return jsonList?.mapNotNull { objectMapper.readValue(it, ChatMessage::class.java) } ?: emptyList()
    }

    override fun deleteAll(userId: String, courseId: String) {
        redisTemplate.delete(key(userId, courseId))
    }
}
